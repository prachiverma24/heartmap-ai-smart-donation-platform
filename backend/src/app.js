const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const authRoutes = require('./routes/auth');
const ngoRoutes = require('./routes/ngo');
const donationRoutes = require('./routes/donations');
const helpRequestRoutes = require('./routes/helpRequests');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/uploads');
const aiRoutes = require('./routes/ai');
const feedbackRoutes = require('./routes/feedback');
const projectRoutes = require('./routes/projects');

const donationDriveRoutes = require('./routes/donationDrives');
const publicDonationDriveRoutes = require('./routes/publicDonationDrives');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => process.env.NODE_ENV === 'test' }), authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/ai', aiRoutes);
// Keep the project README endpoint available at the documented top-level path.
app.use('/api/gemini', aiRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/ngo', ngoRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/help-requests', helpRequestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
// Donation drives have their own domain model and authorization boundary.
app.use('/api/donation-drives', donationDriveRoutes);
app.use('/api/public', publicDonationDriveRoutes);
app.use(notFound);
app.use(errorHandler);
module.exports = app;
