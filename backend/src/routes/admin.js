const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const NGOProfile = require('../models/NGOProfile');
const DonationListing = require('../models/DonationListing');
const HelpRequest = require('../models/HelpRequest');
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate, requireRoles('admin'));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  return res.json({ users: users.map(({ passwordHash, ...user }) => user) });
}));

router.patch('/users/:id/role', [body('role').isIn(['user', 'ngo', 'admin']), handleValidation], asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true, runValidators: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: user.toSafeObject() });
}));

router.patch('/users/:id/status', [body('isActive').isBoolean(), handleValidation], asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: user.toSafeObject() });
}));

router.get('/donations', asyncHandler(async (req, res) => {
  const listings = await DonationListing.find().populate('owner', 'name email').sort({ createdAt: -1 }).lean();
  return res.json({ listings });
}));

router.patch('/donations/:id', [body('status').isIn(['available', 'matched', 'closed']), handleValidation], asyncHandler(async (req, res) => {
  const listing = await DonationListing.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!listing) return res.status(404).json({ error: 'Donation listing not found' });
  return res.json({ listing });
}));

router.delete('/donations/:id', asyncHandler(async (req, res) => {
  const listing = await DonationListing.findByIdAndDelete(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Donation listing not found' });
  return res.status(204).send();
}));

router.get('/help-requests', asyncHandler(async (req, res) => {
  const requests = await HelpRequest.find().populate('owner', 'name email').sort({ createdAt: -1 }).lean();
  return res.json({ requests });
}));

router.patch('/help-requests/:id', [body('status').isIn(['open', 'fulfilled', 'closed']), handleValidation], asyncHandler(async (req, res) => {
  const helpRequest = await HelpRequest.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!helpRequest) return res.status(404).json({ error: 'Help request not found' });
  return res.json({ request: helpRequest });
}));

router.delete('/help-requests/:id', asyncHandler(async (req, res) => {
  const helpRequest = await HelpRequest.findByIdAndDelete(req.params.id);
  if (!helpRequest) return res.status(404).json({ error: 'Help request not found' });
  return res.status(204).send();
}));

router.get('/ngos', asyncHandler(async (req, res) => res.json({ profiles: await NGOProfile.find().sort({ createdAt: -1 }).lean() })));
router.get('/verification-requests', asyncHandler(async (req, res) => {
  const status = req.query.status || 'pending';
  const profiles = await NGOProfile.find({ verificationStatus: status }).populate('user', 'name email').populate('reviewedBy', 'name email').sort({ updatedAt: -1 }).lean();
  return res.json({ profiles });
}));

router.get('/ngos/:id/verification', asyncHandler(async (req, res) => {
  const profile = await NGOProfile.findById(req.params.id).populate('user', 'name email').populate('reviewedBy', 'name email').lean();
  if (!profile) return res.status(404).json({ error: 'NGO profile not found' });
  return res.json({ profile });
}));

router.patch('/ngos/:id/verification', [body('verificationStatus').isIn(['pending', 'verified', 'rejected', 'flagged']), body('isPublished').optional().isBoolean(), body('reviewNotes').optional().trim().isLength({ max: 2000 }), handleValidation], asyncHandler(async (req, res) => {
  const profile = await NGOProfile.findByIdAndUpdate(req.params.id, { verificationStatus: req.body.verificationStatus, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNotes: req.body.reviewNotes || '', ...(req.body.isPublished === undefined ? {} : { isPublished: req.body.isPublished }) }, { new: true, runValidators: true });
  if (!profile) return res.status(404).json({ error: 'NGO profile not found' });
  return res.json({ profile });
}));

router.get('/analytics', asyncHandler(async (req, res) => {
  const [users, ngos, reviewedNgos, pendingVerifications, listings, activeHelpRequests, closedHelpRequests, reports, donationCategories, verificationStatuses] = await Promise.all([
    User.countDocuments(), NGOProfile.countDocuments(), NGOProfile.countDocuments({ reviewedAt: { $exists: true } }), NGOProfile.countDocuments({ verificationStatus: 'pending' }),
    DonationListing.countDocuments(), HelpRequest.countDocuments({ status: 'open' }), HelpRequest.countDocuments({ status: { $in: ['fulfilled', 'closed'] } }), Report.countDocuments(),
    DonationListing.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    NGOProfile.aggregate([{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }])
  ]);
  return res.json({ analytics: { users, ngos, reviewedNgos, pendingVerifications, listings, activeHelpRequests, closedHelpRequests, reports, donationCategories, verificationStatuses } });
}));

module.exports = router;
