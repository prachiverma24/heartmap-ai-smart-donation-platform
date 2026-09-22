const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { handleValidation } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/auth');

const router = express.Router();
const passwordRule = body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters').matches(/[A-Za-z]/).withMessage('Password must contain a letter').matches(/[0-9]/).withMessage('Password must contain a number');

router.post('/register', [body('name').trim().isLength({ min: 2, max: 80 }), body('email').isEmail().normalizeEmail(), passwordRule, body('role').optional().isIn(['user', 'ngo']), handleValidation], asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });
  const role = req.body.role === 'ngo' ? 'ngo' : 'user';
  const user = new User({ name: req.body.name, email, role });
  await user.setPassword(req.body.password);
  await user.save();
  const token = signToken(user);
  setAuthCookie(res, token);
  return res.status(201).json({ user: user.toSafeObject(), token });
}));

router.post('/login', [body('email').isEmail().normalizeEmail(), body('password').isString().isLength({ min: 1, max: 128 }), handleValidation], asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) return res.status(401).json({ error: 'Invalid email or password' });
  const token = signToken(user);
  setAuthCookie(res, token);
  return res.json({ user: user.toSafeObject(), token });
}));

router.post('/logout', (req, res) => { clearAuthCookie(res); return res.status(204).send(); });

router.get('/me', authenticate, (req, res) => res.json({ user: req.user.toSafeObject() }));

module.exports = router;
