const express = require('express');
const { body } = require('express-validator');
const HelpRequest = require('../models/HelpRequest');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRoles } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();
const validation = [body('title').trim().isLength({ min: 2, max: 120 }), body('description').trim().isLength({ min: 2, max: 2000 }), body('category').trim().isLength({ min: 2, max: 40 }), body('requiredItem').trim().isLength({ min: 2, max: 120 }), body('quantity').isInt({ min: 1, max: 100000 }), body('images').optional().isArray({ max: 20 }), body('location').optional().isObject(), body('contactInformation').trim().isLength({ min: 2, max: 500 }), handleValidation];
const updateValidation = [body('title').optional().trim().isLength({ min: 2, max: 120 }), body('description').optional().trim().isLength({ min: 2, max: 2000 }), body('category').optional().trim().isLength({ min: 2, max: 40 }), body('requiredItem').optional().trim().isLength({ min: 2, max: 120 }), body('quantity').optional().isInt({ min: 1, max: 100000 }), body('images').optional().isArray({ max: 20 }), body('location').optional().isObject(), body('contactInformation').optional().trim().isLength({ min: 2, max: 500 }), body('status').optional().isIn(['open', 'fulfilled', 'closed']), handleValidation];

router.get('/', authenticate, requireRoles('user', 'ngo', 'admin'), asyncHandler(async (req, res) => {
  const filter = req.query.mine === 'true' || req.user.role === 'user' ? { owner: req.user._id } : { status: 'open' };
  const requests = await HelpRequest.find(filter).populate('owner', 'name').sort({ createdAt: -1 }).lean();
  return res.json({ requests });
}));

router.post('/', authenticate, requireRoles('user', 'ngo'), validation, asyncHandler(async (req, res) => {
  const request = await HelpRequest.create({ ...req.body, owner: req.user._id });
  return res.status(201).json({ request });
}));

router.patch('/:id', authenticate, requireRoles('user', 'ngo'), updateValidation, asyncHandler(async (req, res) => {
  const request = await HelpRequest.findOne({ _id: req.params.id, owner: req.user._id });
  if (!request) return res.status(404).json({ error: 'Help request not found' });
  const editableFields = ['title', 'description', 'category', 'requiredItem', 'quantity', 'images', 'location', 'contactInformation', 'status'];
  Object.assign(request, Object.fromEntries(editableFields.filter((field) => req.body[field] !== undefined).map((field) => [field, req.body[field]])));
  await request.save();
  return res.json({ request });
}));

router.delete('/:id', authenticate, requireRoles('user', 'ngo'), asyncHandler(async (req, res) => {
  const request = await HelpRequest.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!request) return res.status(404).json({ error: 'Help request not found' });
  return res.status(204).send();
}));

module.exports = router;
