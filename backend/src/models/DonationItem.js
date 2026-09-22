const mongoose = require('mongoose');

const donationItemSchema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationDrive', required: true, index: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  image: { type: String, trim: true, maxlength: 500 },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  quantity: { type: Number, required: true, min: 1, max: 100000 },
  condition: { type: String, required: true, enum: ['new', 'like-new', 'good', 'fair', 'used'] }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('DonationItem', donationItemSchema);
