const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  originalTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }, // Used for voids/refunds linking back
  type: { type: String, enum: ['sale', 'void', 'refund'], required: true },
  
  // Financial details at the time of the event
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  cashTendered: { type: Number },
  changeDue: { type: Number },
  
  // Actor tracking
  cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For voids/refunds
  reason: { type: String }, // E.g., void reason
  
  timestamp: { type: Date, default: Date.now }
});

// Guard: Enforce append-only at the application level
// Note: This block is at the Mongoose level. Users with direct MongoDB shell/Compass access
// can still modify records. The DB itself is not append-only without Atlas Enterprise roles.
transactionSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'update'], function(next) {
  next(new Error('Transactions are append-only and cannot be modified.'));
});

transactionSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany', 'remove'], function(next) {
  next(new Error('Transactions cannot be deleted.'));
});

transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ orderId: 1, type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
