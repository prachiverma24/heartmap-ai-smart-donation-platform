const express = require('express');
const { body } = require('express-validator');
const DonationListing = require('../models/DonationListing');
const NGOProfile = require('../models/NGOProfile');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();
const types = ['Clothes', 'Food', 'Books', 'Toys', 'Electronics', 'Furniture', 'Money', 'Other'];
const conditions = ['new', 'like-new', 'good', 'fair', 'used'];
const listingValidation = [
  body('type').isIn(types), body('item').trim().isLength({ min: 2, max: 120 }), body('quantity').isInt({ min: 1, max: 100000 }),
  body('condition').isIn(conditions), body('title').optional().trim().isLength({ min: 2, max: 120 }), body('description').trim().isLength({ min: 2, max: 2000 }),
  body('images').optional().isArray({ max: 20 }), body('location').optional().isObject(), body('pickupAvailable').optional().isBoolean(), handleValidation
];
const updateListingValidation = [
  body('type').optional().isIn(types), body('item').optional().trim().isLength({ min: 2, max: 120 }), body('quantity').optional().isInt({ min: 1, max: 100000 }),
  body('condition').optional().isIn(conditions), body('title').optional().trim().isLength({ min: 2, max: 120 }), body('description').optional().trim().isLength({ min: 2, max: 2000 }),
  body('images').optional().isArray({ max: 20 }), body('location').optional().isObject(), body('pickupAvailable').optional().isBoolean(), body('status').optional().isIn(['available', 'matched', 'closed']), handleValidation
];

const distanceKm = (lat1, lng1, lat2, lng2) => {
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const radians = (value) => value * Math.PI / 180;
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', authenticate, requireRoles('user', 'ngo', 'admin'), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'user' ? { owner: req.user._id } : { status: 'available' };
  const listings = await DonationListing.find(filter).populate('owner', 'name').sort({ createdAt: -1 }).lean();
  return res.json({ listings });
}));

router.post('/', authenticate, requireRoles('user'), listingValidation, asyncHandler(async (req, res) => {
  const listing = await DonationListing.create({ ...req.body, owner: req.user._id, title: req.body.title || req.body.item });
  return res.status(201).json({ listing });
}));

router.get('/:id/matches', authenticate, requireRoles('user', 'ngo', 'admin'), asyncHandler(async (req, res) => {
  const listing = await DonationListing.findById(req.params.id).lean();
  if (!listing) return res.status(404).json({ error: 'Donation listing not found' });
  if (req.user.role === 'user' && listing.owner.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'You do not own this donation listing' });
  if (listing.type === 'Money') return res.json({ listingId: listing._id, matches: [], message: 'Money donations use each NGO\'s official external donation link.' });

  const typePattern = new RegExp(`^${escapeRegex(listing.type)}$`, 'i');
  const itemPattern = new RegExp(escapeRegex(listing.item), 'i');
  const ngos = await NGOProfile.find({ isPublished: true, verificationStatus: 'verified', acceptedDonationTypes: typePattern }).select('-documents -createdBy -user').lean();
  const matches = ngos.filter((ngo) => !(ngo.notAcceptedDonationTypes || []).some((item) => item.toLowerCase() === listing.type.toLowerCase() || item.toLowerCase() === listing.item.toLowerCase())).map((ngo) => {
    const urgentMatch = (ngo.urgentlyNeededItems || []).some((item) => itemPattern.test(item) || itemPattern.test(listing.description));
    const distance = distanceKm(Number(listing.location?.lat), Number(listing.location?.lng), Number(ngo.latitude ?? ngo.location?.lat), Number(ngo.longitude ?? ngo.location?.lng));
    const pickupMatch = listing.pickupAvailable ? Boolean(ngo.pickupAvailable) : Boolean(ngo.dropOffAvailable || ngo.pickupAvailable);
    let score = 50;
    const reasons = ['Accepts this donation type'];
    if (urgentMatch) { score += 30; reasons.push('Item appears in current urgent needs'); }
    if (distance !== null && distance <= 50) { score += 15; reasons.push(`${Math.round(distance)} km away`); }
    if (pickupMatch) { score += 5; reasons.push(listing.pickupAvailable ? 'Pickup compatibility available' : 'Drop-off or pickup available'); }
    return { ngo, score, distanceKm: distance === null ? null : Math.round(distance * 10) / 10, reasons };
  }).sort((a, b) => b.score - a.score || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return res.json({ listingId: listing._id, matches });
}));

router.patch('/:id', authenticate, requireRoles('user', 'admin'), updateListingValidation, asyncHandler(async (req, res) => {
  const listing = await DonationListing.findOne({ _id: req.params.id, ...(req.user.role === 'admin' ? {} : { owner: req.user._id }) });
  if (!listing) return res.status(404).json({ error: 'Donation listing not found' });
  const editableFields = ['type', 'item', 'quantity', 'condition', 'title', 'description', 'images', 'location', 'pickupAvailable', 'status'];
  Object.assign(listing, Object.fromEntries(editableFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]])));
  await listing.save();
  return res.json({ listing });
}));

router.delete('/:id', authenticate, requireRoles('user', 'admin'), asyncHandler(async (req, res) => {
  const listing = await DonationListing.findOneAndDelete({ _id: req.params.id, ...(req.user.role === 'admin' ? {} : { owner: req.user._id }) });
  if (!listing) return res.status(404).json({ error: 'Donation listing not found' });
  return res.status(204).send();
}));

module.exports = router;
