const express = require('express');
const { body } = require('express-validator');
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const NGOProfile = require('../models/NGOProfile');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /api/feedback/ngo/:ngoId
 * Returns published feedback for a verified NGO.
 */
router.get('/ngo/:ngoId', asyncHandler(async (req, res) => {
  const { ngoId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(ngoId)) {
    return res.status(400).json({ success: false, error: 'Valid ngoId is required' });
  }

  const feedbackList = await Feedback.find({ ngo: ngoId, status: 'published' })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return res.status(200).json({
    success: true,
    feedback: feedbackList
  });
}));

/**
 * POST /api/feedback/ngo/:ngoId
 * Allows authenticated donors/users to submit feedback about their experience with an NGO.
 */
router.post(
  '/ngo/:ngoId',
  authenticate,
  requireRoles('user', 'ngo', 'admin'),
  [
    body('feedback')
      .isString()
      .trim()
      .isLength({ min: 3, max: 2000 })
      .withMessage('Feedback must be between 3 and 2000 characters.'),
    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be an integer between 1 and 5.'),
    handleValidation
  ],
  asyncHandler(async (req, res) => {
    const { ngoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(ngoId)) {
      return res.status(400).json({ success: false, error: 'Valid ngoId is required' });
    }

    const ngo = await NGOProfile.findById(ngoId);
    if (!ngo) {
      return res.status(404).json({ success: false, error: 'NGO not found' });
    }

    const newFeedback = await Feedback.create({
      user: req.user._id,
      ngo: ngoId,
      feedback: req.body.feedback.trim(),
      rating: req.body.rating || null,
      status: 'published'
    });

    return res.status(201).json({
      success: true,
      feedback: newFeedback
    });
  })
);

/**
 * GET /api/feedback/:id
 * Fetches a single feedback document with authorization check.
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: 'Valid feedback ID is required' });
  }

  const record = await Feedback.findById(id).populate('user', 'name');
  if (!record) {
    return res.status(404).json({ success: false, error: 'Feedback not found' });
  }

  // Authorization check: User must be owner, admin, or target NGO owner
  const isOwner = req.user && record.user && (record.user._id ? record.user._id.equals(req.user._id) : record.user.equals(req.user._id));
  const isAdmin = req.user && req.user.role === 'admin';
  const ngo = await NGOProfile.findById(record.ngo);
  const isTargetNgo = req.user && ngo && ngo.user && ngo.user.equals(req.user._id);

  if (!isOwner && !isAdmin && !isTargetNgo) {
    return res.status(403).json({ success: false, error: 'You do not have permission to view this feedback.' });
  }

  return res.status(200).json({
    success: true,
    feedback: record
  });
}));

module.exports = router;

