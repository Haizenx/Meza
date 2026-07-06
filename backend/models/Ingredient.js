const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  purchaseUnit: { type: String, required: true },
  unitCost: { type: Number, required: true },
  movingAverageCost: { type: Number },
  currency: { type: String, default: 'PHP' },
  stockQuantity: { type: Number, required: true },
  lowStockThreshold: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { optimisticConcurrency: true });

// Add case-insensitive unique index for name
ingredientSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

ingredientSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Ingredient', ingredientSchema);
