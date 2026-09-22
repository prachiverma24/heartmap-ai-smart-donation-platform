const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cookieName } = require('../utils/auth');
const config = require('../config');

const authenticate = async (req, res, next) => {
  let token = req.cookies?.[cookieName];

  if (!token && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Authentication required' });
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired authentication' });
  }
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  return next();
};

const requireOwner = (field = 'owner') => (req, res, next) => {
  if (!req.user || req.user.role === 'admin') return next();
  if (!req.resource || req.resource[field].toString() !== req.user._id.toString()) return res.status(403).json({ error: 'You do not own this resource' });
  return next();
};

module.exports = { authenticate, requireRoles, requireOwner };
