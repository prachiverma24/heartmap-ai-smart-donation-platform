const express = require('express');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { upload, uploadDirectory } = require('../middleware/upload');
const NGOProfile = require('../models/NGOProfile');
const config = require('../config');
const donationDriveUploadDirectory = path.resolve(__dirname, '../../uploads/donation-drives');

const router = express.Router();
router.get('/donation-drives/:filename', authenticate, requireRoles('user', 'ngo', 'admin'), asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  return res.sendFile(path.join(donationDriveUploadDirectory, filename));
}));
const purposes = new Set(['logo', 'activity-image', 'verification-document', 'donation-image', 'help-image']);

router.post('/', authenticate, requireRoles('user', 'ngo', 'admin'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!purposes.has(req.body.purpose)) return res.status(400).json({ error: 'A valid upload purpose is required' });
  if (!req.file) return res.status(400).json({ error: 'A JPEG, PNG, WebP, or PDF file up to 5 MB is required' });
  const isPrivate = req.body.purpose === 'verification-document';
  if (isPrivate && !['ngo', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Only NGO users or admins can upload verification documents' });
  const url = `${config.publicApiOrigin}/api/uploads/${isPrivate ? 'private' : 'public'}/${req.file.filename}`;
  if (isPrivate && req.user.role === 'ngo') {
    await NGOProfile.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id, createdBy: req.user._id, organizationName: req.user.name || 'Pending NGO profile' }, $push: { documents: { url, kind: 'verification-document', originalName: req.file.originalname } } }, { upsert: true, setDefaultsOnInsert: true });
  }
  return res.status(201).json({ file: { url, filename: req.file.filename, purpose: req.body.purpose, originalName: req.file.originalname, contentType: req.file.mimetype } });
}));

router.get('/public/:filename', asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  return res.sendFile(path.join(uploadDirectory, filename));
}));

router.get('/private/:filename', authenticate, requireRoles('ngo', 'admin'), asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  const profile = await NGOProfile.findOne({ 'documents.url': { $regex: `${filename}$` } });
  if (!profile || (req.user.role !== 'admin' && profile.user.toString() !== req.user._id.toString())) return res.status(404).json({ error: 'Private file not found' });
  return res.sendFile(path.join(uploadDirectory, filename));
}));

module.exports = router;
