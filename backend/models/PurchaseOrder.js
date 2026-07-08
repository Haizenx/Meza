const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantityReceived: { type: Number, required: true },
  totalCostPaid: { type: Number, required: true }, // The total amount paid for this batch
  unitCostForBatch: { type: Number, required: true }, // Calculated: totalCostPaid / quantityReceived
  receivedAt: { type: Date, default: Date.now },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supplierName: { type: String },
  invoiceId: { type: String }
}, { timestamps: true });
// Guard: Enforce append-only at the application level
purchaseOrderSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'update'], function(next) {
  next(new Error('Purchase Orders (Restock History) are append-only and cannot be modified.'));
});

purchaseOrderSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany', 'remove'], function(next) {
  next(new Error('Purchase Orders cannot be deleted.'));
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
