const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/recipes
// Owner only
router.get('/', authenticate, authorize('owner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.menuItemId) filter.menuItemId = req.query.menuItemId;
    
    const recipes = await Recipe.find(filter).populate('ingredients.ingredientId');
    res.json(recipes);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/recipes
// Owner only
router.post('/', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { menuItemId, size, ingredients } = req.body;
    const recipeSize = size || 'Regular';
    
    // UPSERT logic
    const existing = await Recipe.findOne({ menuItemId, size: recipeSize });
    if (existing) {
      existing.ingredients = ingredients;
      await existing.save();
      return res.json(existing);
    }

    const recipe = new Recipe({ menuItemId, size: recipeSize, ingredients });
    await recipe.save();
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
