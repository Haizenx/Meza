const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'MANUAL_STOCK_ADJUSTMENT', 'PRICE_OVERRIDE'
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetModel: { type: String }, // e.g., 'Ingredient'
  targetId: { type: mongoose.Schema.Types.ObjectId },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Guard: Enforce append-only at the application level
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'update'], function(next) {
  next(new Error('Audit Logs are append-only and cannot be modified.'));
});

auditLogSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany', 'remove'], function(next) {
  next(new Error('Audit Logs cannot be deleted.'));
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
