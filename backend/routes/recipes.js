const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/recipes
// Owner only
router.get('/', authenticate, authorize('owner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.menuItemId) filter.menuItemId = String(req.query.menuItemId);
    
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
    
    // UPSERT logic using atomic findOneAndUpdate to prevent race conditions
    const recipe = await Recipe.findOneAndUpdate(
      { menuItemId, size: recipeSize },
      { $set: { ingredients } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    res.status(201).json(recipe);
  } catch (err) {
    console.error('Recipe Save Error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});
// POST /api/recipes/batch
// Owner only
router.post('/batch', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { recipes } = req.body;
    if (!Array.isArray(recipes)) {
      return res.status(400).send('Expected recipes array');
    }

    const bulkOps = recipes.map(r => ({
      updateOne: {
        filter: { menuItemId: r.menuItemId, size: r.size || 'Regular' },
        update: { $set: { ingredients: r.ingredients } },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await Recipe.bulkWrite(bulkOps);
    }
    
    res.status(200).json({ message: 'Batch save successful' });
  } catch (err) {
    console.error('Batch Recipe Save Error:', err);
    res.status(500).send('Server error: ' + err.message);
  }
});

module.exports = router;
