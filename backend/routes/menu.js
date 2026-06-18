const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/menu/public
// Accessible without token for QR Ordering
router.get('/public', async (req, res) => {
  try {
    const items = await MenuItem.find({ isArchived: false, isAvailable: true }).select('name category price photoUrl isAvailable');
    res.json(items);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/menu
// Accessible by all authenticated roles
router.get('/', authenticate, async (req, res) => {
  try {
    const items = await MenuItem.find({ isArchived: false });
    res.json(items);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/menu
// Owner & Manager only
router.post('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { name, category, price, photoUrl, isAvailable, stockQuantity, lowStockThreshold } = req.body;
    const newItem = new MenuItem({ name, category, price, photoUrl, isAvailable, stockQuantity, lowStockThreshold });
    await newItem.save();

    if (req.app.locals.io) {
      req.app.locals.io.emit('menu:updated', newItem);
    }

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/menu/:id
// Owner & Manager only
router.put('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { name, category, price, photoUrl, isAvailable, isArchived, stockQuantity, lowStockThreshold } = req.body;
    
    const updateFields = { name, category, price, photoUrl, isAvailable, isArchived };
    if (stockQuantity !== undefined) updateFields.stockQuantity = stockQuantity;
    if (lowStockThreshold !== undefined) updateFields.lowStockThreshold = lowStockThreshold;

    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    if (!item) return res.status(404).send('Not found');

    if (req.app.locals.io) {
      req.app.locals.io.emit('menu:updated', item);
    }

    res.json(item);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// DELETE /api/menu/:id
// Owner & Manager only (Soft delete via isArchived)
router.delete('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
    if (!item) return res.status(404).send('Not found');

    if (req.app.locals.io) {
      req.app.locals.io.emit('menu:updated', item);
    }

    res.json({ message: 'Item archived' });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/menu/:id/cost
// Owner & Manager
router.get('/:id/cost', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const Recipe = require('../models/Recipe');
    const Ingredient = require('../models/Ingredient');

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).send('Menu item not found');

    const recipe = await Recipe.findOne({ menuItemId: item._id }).populate('ingredients.ingredientId');
    
    let cogs = 0;
    let ingredientsBreakdown = [];
    if (recipe && recipe.ingredients) {
      for (let ri of recipe.ingredients) {
        if (ri.ingredientId) {
          let multiplier = 1;
          const recUnit = ri.unit.toLowerCase();
          const purUnit = ri.ingredientId.purchaseUnit.toLowerCase();

          if (recUnit === 'g' && purUnit === 'kg') multiplier = 0.001;
          if (recUnit === 'ml' && purUnit === 'l') multiplier = 0.001;
          if (recUnit === 'kg' && purUnit === 'g') multiplier = 1000;
          if (recUnit === 'l' && purUnit === 'ml') multiplier = 1000;

          const convertedQuantity = ri.quantity * multiplier;
          const costContribution = convertedQuantity * (ri.ingredientId.movingAverageCost || ri.ingredientId.unitCost);
          cogs += costContribution;
          
          ingredientsBreakdown.push({
            name: ri.ingredientId.name,
            quantity: ri.quantity,
            unit: ri.unit,
            cost: costContribution
          });
        }
      }
    }

    const marginPercent = ((item.price - cogs) / item.price) * 100;

    res.json({
      menuItem: item,
      cogs,
      marginPercent,
      ingredientsBreakdown
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
