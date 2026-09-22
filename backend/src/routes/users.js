const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

router.get('/me', authenticate, (req, res) => res.json({ user: req.user.toSafeObject() }));

router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.json({ users: [] });
  }
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const users = await User.find({
    $or: [{ name: regex }, { email: regex }],
    isActive: true
  }).limit(10);
  return res.json({ users: users.map(u => u.toSafeObject()) });
}));

module.exports = router;
