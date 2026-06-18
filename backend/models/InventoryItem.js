const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unitCost: { type: Number, required: true },
  purchaseUnit: { type: String, required: true }, // e.g. kg, L, pcs
  currentStock: { type: Number, required: true, default: 0 },
  alertThreshold: { type: Number, required: true, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
