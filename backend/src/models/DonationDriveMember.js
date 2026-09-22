const mongoose = require('mongoose');

const donationDriveMemberSchema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationDrive', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
  joinedAt: { type: Date, default: Date.now }
}, { versionKey: false });

donationDriveMemberSchema.index({ drive: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('DonationDriveMember', donationDriveMemberSchema);
