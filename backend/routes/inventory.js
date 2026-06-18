const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/inventory
// Owner & Manager
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const items = await Ingredient.find();
    res.json(items);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/inventory/alerts
// Owner & Manager
router.get('/alerts', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    // MongoDB aggregation could be used, but since it's a simple condition we can just use $expr or $where
    const lowStockItems = await Ingredient.find({
      $expr: { $lte: ["$stockQuantity", "$lowStockThreshold"] }
    });
    res.json(lowStockItems);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/inventory
// Owner & Manager
router.post('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold } = req.body;
    const newItem = new Ingredient({ 
      name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold 
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/inventory/:id
// Owner & Manager
router.put('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold } = req.body;
    const item = await Ingredient.findByIdAndUpdate(
      req.params.id,
      { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold },
      { new: true }
    );
    if (!item) return res.status(404).send('Not found');
    res.json(item);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/inventory/purchase
// Owner & Manager - Receive delivery and calculate Moving Average Cost
router.post('/purchase', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const PurchaseOrder = require('../models/PurchaseOrder');
    const { ingredientId, quantityReceived, totalCostPaid, supplierName } = req.body;
    
    const ingredient = await Ingredient.findById(ingredientId);
    if (!ingredient) return res.status(404).send('Ingredient not found');

    const unitCostForBatch = totalCostPaid / quantityReceived;

    // Calculate Moving Average Cost
    const currentStock = ingredient.stockQuantity || 0;
    const currentUnitCost = ingredient.movingAverageCost || ingredient.unitCost;
    
    const currentTotalValue = currentStock * currentUnitCost;
    const newTotalValue = currentTotalValue + totalCostPaid;
    const newTotalStock = currentStock + quantityReceived;
    
    const newMovingAverageCost = newTotalValue / newTotalStock;

    // Create Purchase Order Record
    const po = new PurchaseOrder({
      ingredientId,
      quantityReceived,
      totalCostPaid,
      unitCostForBatch,
      receivedBy: req.user.id,
      supplierName
    });
    await po.save();

    // Update Ingredient
    ingredient.stockQuantity = newTotalStock;
    ingredient.movingAverageCost = newMovingAverageCost;
    ingredient.unitCost = newMovingAverageCost; // Also update base unitCost for backward compatibility
    await ingredient.save();

    if (req.io) {
      req.io.emit('inventory:updated');
    }

    res.status(201).json({ purchaseOrder: po, updatedIngredient: ingredient });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
module.exports = router;
