const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: 2000
  },
  category: { type: String, trim: true, maxlength: 80, index: true },
  targetRegion: { type: String, trim: true, maxlength: 160, index: true },
  goal: { type: Number, min: 0 },
  coverImage: { type: String, trim: true, maxlength: 500 },
  isPublic: { type: Boolean, default: false, index: true },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

module.exports = mongoose.model('Project', projectSchema);
