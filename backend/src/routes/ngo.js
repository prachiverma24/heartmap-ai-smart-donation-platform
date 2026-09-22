const express = require('express');
const { body } = require('express-validator');
const path = require('path');
const NGOProfile = require('../models/NGOProfile');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { upload, uploadDirectory } = require('../middleware/upload');

const router = express.Router();
const ngoFields = [
  body('name').optional().trim().isLength({ min: 2, max: 160 }),
  body('organizationName').optional().trim().isLength({ min: 2, max: 160 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('category').optional().trim().isLength({ max: 80 }),
  body('address').optional().trim().isLength({ max: 240 }),
  body('city').optional().trim().isLength({ max: 80 }),
  body('state').optional().trim().isLength({ max: 80 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('email').optional().isEmail(),
  body('website').optional().isURL(),
  body('officialDonationUrl').optional().isURL(),
  body('acceptedDonationTypes').optional().isArray({ max: 20 }),
  body('notAcceptedDonationTypes').optional().isArray({ max: 20 }),
  body('urgentlyNeededItems').optional().isArray({ max: 30 }),
  body('requirements').optional().isArray({ max: 30 }),
  body('pickupAreas').optional().isArray({ max: 30 }),
  body('images').optional().isArray({ max: 20 }),
  body('operatingHours').optional().isObject(),
  body('verificationInformation').optional().trim().isLength({ max: 2000 }),
  body('registrationInformation').optional().trim().isLength({ max: 2000 }),
  body('pickupAvailable').optional().isBoolean(),
  body('dropOffAvailable').optional().isBoolean(),
  body('officialWebsite').optional().isURL(),
  body('contact').optional().trim().isLength({ max: 200 }),
  body('registrationNumber').optional().trim().isLength({ max: 120 }),
  body('sourceUrl').optional().isURL(),
  body('verificationSource').optional().trim().isLength({ max: 300 }),
  body('lastVerifiedAt').optional().isISO8601(),
  handleValidation
];
const profileFields = ngoFields;

const publicProjection = '-documents -createdBy -user';
const normalizedPayload = (payload) => ({
  ...payload,
  ...(payload.name && !payload.organizationName ? { organizationName: payload.name } : {}),
  ...(payload.organizationName && !payload.name ? { name: payload.organizationName } : {}),
  ...(payload.officialWebsite && !payload.website ? { website: payload.officialWebsite } : {}),
  ...(payload.website && !payload.officialWebsite ? { officialWebsite: payload.website } : {}),
  ...(payload.contact && !payload.phone && /^[\d\s\-+()]+$/.test(payload.contact) ? { phone: payload.contact } : {}),
  ...(payload.latitude !== undefined || payload.longitude !== undefined ? { location: { lat: Number(payload.latitude), lng: Number(payload.longitude) } } : {})
});

router.get('/public', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const filter = { isPublished: true, verificationStatus: 'verified' };
  if (search) filter.$or = [{ organizationName: { $regex: search, $options: 'i' } }, { name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  if (req.query.category) filter.category = req.query.category;
  if (req.query.city) filter.city = new RegExp(`^${String(req.query.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (req.query.state) filter.state = new RegExp(`^${String(req.query.state).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (req.query.donationType) filter.acceptedDonationTypes = req.query.donationType;
  if (req.query.lat !== undefined && req.query.lng !== undefined) {
    const lat = Number(req.query.lat); const lng = Number(req.query.lng); const radius = Number(req.query.radiusKm || 25);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius)) {
      const latDelta = radius / 111; const lngDelta = radius / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
      filter.latitude = { $gte: lat - latDelta, $lte: lat + latDelta }; filter.longitude = { $gte: lng - lngDelta, $lte: lng + lngDelta };
    }
  }
  const profiles = await NGOProfile.find(filter).select(publicProjection).sort({ name: 1, organizationName: 1 }).lean();
  return res.json({ profiles });
}));

router.get('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const profiles = await NGOProfile.find().select('-documents').sort({ createdAt: -1 }).lean();
  return res.json({ profiles });
}));

router.post('/', authenticate, requireRoles('ngo', 'admin'), ngoFields, asyncHandler(async (req, res) => {
  const payload = normalizedPayload(req.body);
  if (req.user.role === 'ngo') payload.user = req.user._id;
  payload.createdBy = req.user._id;
  if (req.user.role === 'admin' && !payload.user) return res.status(400).json({ error: 'user is required when an admin creates an NGO' });
  const profile = await NGOProfile.create(payload);
  return res.status(201).json({ profile });
}));

router.patch('/:id', authenticate, requireRoles('ngo', 'admin'), ngoFields, asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.user._id };
  const profile = await NGOProfile.findOneAndUpdate(filter, { $set: normalizedPayload(req.body) }, { new: true, runValidators: true });
  if (!profile) return res.status(404).json({ error: 'NGO not found' });
  return res.json({ profile });
}));

router.delete('/:id', authenticate, requireRoles('ngo', 'admin'), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.user._id };
  const profile = await NGOProfile.findOneAndDelete(filter);
  if (!profile) return res.status(404).json({ error: 'NGO not found' });
  return res.status(204).send();
}));

router.get('/profile', authenticate, requireRoles('ngo'), asyncHandler(async (req, res) => {
  const profile = await NGOProfile.findOne({ user: req.user._id });
  return res.json({ profile });
}));

router.put('/profile', authenticate, requireRoles('ngo'), profileFields, asyncHandler(async (req, res) => {
  const profile = await NGOProfile.findOneAndUpdate({ user: req.user._id }, { $set: normalizedPayload(req.body), user: req.user._id, createdBy: req.user._id }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  return res.json({ profile });
}));

router.post('/documents', authenticate, requireRoles('ngo'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A JPEG, PNG, WebP, or PDF file up to 5 MB is required' });
  const profile = await NGOProfile.findOneAndUpdate({ user: req.user._id }, { $push: { documents: { url: req.file.filename, kind: req.body.kind || 'supporting-document', originalName: req.file.originalname } } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return res.status(201).json({ document: profile.documents[profile.documents.length - 1] });
}));

router.get('/documents/:filename', authenticate, requireRoles('ngo', 'admin'), asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  const profile = await NGOProfile.findOne({ 'documents.url': filename });
  if (!profile || (req.user.role !== 'admin' && profile.user.toString() !== req.user._id.toString())) return res.status(404).json({ error: 'Document not found' });
  return res.sendFile(path.join(uploadDirectory, filename));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const profile = await NGOProfile.findOne({ _id: req.params.id, isPublished: true, verificationStatus: 'verified' }).select(publicProjection).lean();
  if (!profile) return res.status(404).json({ error: 'NGO not found' });
  return res.json({ profile });
}));

module.exports = router;
