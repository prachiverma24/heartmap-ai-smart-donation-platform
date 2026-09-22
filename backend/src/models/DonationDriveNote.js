const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  drive: { type: mongoose.Schema.Types.ObjectId, ref: 'DonationDrive', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  content: { type: String, default: '', maxlength: 50000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });
module.exports = mongoose.model('DonationDriveNote', schema);
