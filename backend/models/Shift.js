const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  startingCash: { type: Number, required: true },
  expectedCash: { type: Number },
  actualCash: { type: Number },
  status: { type: String, enum: ['open', 'closed'], default: 'open' }
}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);
