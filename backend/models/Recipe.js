const mongoose = require('mongoose');

const recipeIngredientSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true }
});

const recipeSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  size: { type: String, default: 'Regular' }, // e.g. Regular, Large. Allows size-specific recipes.
  ingredients: [recipeIngredientSchema],
  updatedAt: { type: Date, default: Date.now }
});

// Ensure a menu item can only have one recipe per size
recipeSchema.index({ menuItemId: 1, size: 1 }, { unique: true });

recipeSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Recipe', recipeSchema);
