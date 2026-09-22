const mongoose = require('mongoose');

const helpRequestSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  requiredItem: { type: String, required: true, trim: true, maxlength: 120 },
  quantity: { type: Number, required: true, min: 1, max: 100000 },
  images: [{ type: String, trim: true, maxlength: 500 }],
  location: { address: String, lat: Number, lng: Number },
  contactInformation: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ['open', 'fulfilled', 'closed'], default: 'open', index: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
