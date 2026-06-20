const mongoose = require('mongoose');

const recipeIngredientSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true }
});

const recipeSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', unique: true, required: true },
  ingredients: [recipeIngredientSchema],
  updatedAt: { type: Date, default: Date.now }
});

recipeSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Recipe', recipeSchema);
