const mongoose = require('mongoose');

const donationDriveSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  category: { type: String, trim: true, maxlength: 80 },
  targetRegion: { type: String, trim: true, maxlength: 160 },
  goal: { type: Number, min: 0 },
  coverImage: { type: String, trim: true, maxlength: 500 },
  isPublic: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('DonationDrive', donationDriveSchema);
