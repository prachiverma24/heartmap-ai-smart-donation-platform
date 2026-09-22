const mongoose = require('mongoose');

const donationInterestSchema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationDrive', required: true, index: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationItem', required: true, index: true },
  ngo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true }
}, { timestamps: true, versionKey: false });
donationInterestSchema.index({ item: 1, ngo: 1 }, { unique: true });

module.exports = mongoose.model('DonationInterest', donationInterestSchema);
