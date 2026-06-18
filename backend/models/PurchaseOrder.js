const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantityReceived: { type: Number, required: true },
  totalCostPaid: { type: Number, required: true }, // The total amount paid for this batch
  unitCostForBatch: { type: Number, required: true }, // Calculated: totalCostPaid / quantityReceived
  receivedAt: { type: Date, default: Date.now },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supplierName: { type: String }
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
