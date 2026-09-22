const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ngo: { type: mongoose.Schema.Types.ObjectId, ref: 'NGOProfile', required: true, index: true },
  feedback: { type: String, required: true, trim: true, maxlength: 2000 },
  rating: { type: Number, min: 1, max: 5 },
  status: { type: String, enum: ['published', 'pending', 'hidden'], default: 'published', index: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('Feedback', feedbackSchema);

