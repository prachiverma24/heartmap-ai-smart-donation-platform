const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationDrive', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalName: { type: String, required: true, trim: true },
  filename: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, required: true, min: 0 },
  url: { type: String, required: true },
  secureUrl: { type: String, trim: true },
  publicId: { type: String, default: '' },
  resourceType: { type: String, trim: true },
  format: { type: String, trim: true },
  folder: { type: String, trim: true },
  isPublic: { type: Boolean, default: false },
  provider: { type: String, enum: ['cloudinary', 'local'], required: true },
  note: { type: String, trim: true, maxlength: 2000, default: '' }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('DonationDriveFile', schema);
