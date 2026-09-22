const mongoose = require('mongoose');

const donationListingSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['Clothes', 'Food', 'Books', 'Toys', 'Electronics', 'Furniture', 'Money', 'Other'], trim: true },
  item: { type: String, required: true, trim: true, maxlength: 120 },
  quantity: { type: Number, required: true, min: 1, max: 100000 },
  condition: { type: String, required: true, enum: ['new', 'like-new', 'good', 'fair', 'used'] },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  images: [{ type: String, trim: true, maxlength: 500 }],
  location: { address: String, lat: Number, lng: Number },
  pickupAvailable: { type: Boolean, default: false },
  status: { type: String, enum: ['available', 'matched', 'closed'], default: 'available', index: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('DonationListing', donationListingSchema);
