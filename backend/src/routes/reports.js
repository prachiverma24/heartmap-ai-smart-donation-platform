const express = require('express');
const { body } = require('express-validator');
const Report = require('../models/Report');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();
const validation = [body('targetType').isIn(['user', 'ngo', 'story', 'listing']), body('targetId').isMongoId(), body('reason').isIn(['Incorrect information', 'Suspicious activity', 'Wrong contact information', 'Suspicious donation link', 'Other']), body('details').optional().trim().isLength({ max: 1000 }), handleValidation];

router.post('/', authenticate, requireRoles('user', 'ngo'), validation, asyncHandler(async (req, res) => {
  const report = await Report.create({ ...req.body, reporter: req.user._id });
  return res.status(201).json({ report });
}));

router.get('/', authenticate, requireRoles('admin'), asyncHandler(async (req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).lean();
  return res.json({ reports });
}));

router.patch('/:id', authenticate, requireRoles('admin'), [body('status').isIn(['open', 'reviewed', 'dismissed', 'actioned']), body('adminNotes').optional().trim().isLength({ max: 2000 }), handleValidation], asyncHandler(async (req, res) => {
  const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status, adminNotes: req.body.adminNotes || '', reviewedBy: req.user._id, reviewedAt: new Date() }, { new: true, runValidators: true });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  return res.json({ report });
}));

module.exports = router;
