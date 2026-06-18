const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/recipes
// Owner only
router.get('/', authenticate, authorize('owner'), async (req, res) => {
  try {
    const recipes = await Recipe.find().populate('ingredients.ingredientId');
    res.json(recipes);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/recipes
// Owner only
router.post('/', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { menuItemId, ingredients } = req.body;
    
    // UPSERT logic
    const existing = await Recipe.findOne({ menuItemId });
    if (existing) {
      existing.ingredients = ingredients;
      await existing.save();
      return res.json(existing);
    }

    const recipe = new Recipe({ menuItemId, ingredients });
    await recipe.save();
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
