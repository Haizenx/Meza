const express = require('express');
const router = express.Router();
const Ingredient = require('../models/Ingredient');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');
const { z } = require('zod');
const { validateZod } = require('../middleware/validate');

const ingredientSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    purchaseUnit: z.string().min(1).max(20),
    unitCost: z.number().min(0),
    currency: z.string().max(10).optional(),
    stockQuantity: z.number().min(0),
    lowStockThreshold: z.number().min(0).optional()
  })
});

const purchaseSchema = z.object({
  body: z.object({
    ingredientId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo ID"),
    quantityReceived: z.number().positive(),
    totalCostPaid: z.number().nonnegative(),
    supplierName: z.string().max(100).optional()
  })
});


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
router.post('/', authenticate, authorize('owner', 'manager'), validateZod(ingredientSchema), async (req, res) => {
  try {
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold } = req.body;
    const newItem = new Ingredient({ 
      name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold 
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'An ingredient with this name already exists.' });
    }
    res.status(500).send('Server error');
  }
});

// PUT /api/inventory/:id
// Owner & Manager
router.put('/:id', authenticate, authorize('owner', 'manager'), validateZod(ingredientSchema), async (req, res) => {
  try {
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold } = req.body;
    
    const existingItem = await Ingredient.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');

    // Check if stock is manually adjusted
    if (stockQuantity !== undefined && stockQuantity !== existingItem.stockQuantity) {
      const log = new AuditLog({
        action: 'MANUAL_STOCK_ADJUSTMENT',
        actorId: req.user.id,
        targetModel: 'Ingredient',
        targetId: existingItem._id,
        oldValue: existingItem.stockQuantity,
        newValue: stockQuantity,
        reason: req.body.reason || 'Manual Update from Dashboard'
      });
      await log.save();
    }

    existingItem.name = name;
    existingItem.purchaseUnit = purchaseUnit;
    existingItem.unitCost = unitCost;
    existingItem.currency = currency;
    existingItem.stockQuantity = stockQuantity;
    existingItem.lowStockThreshold = lowStockThreshold;

    await existingItem.save();

    res.json(existingItem);
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'An ingredient with this name already exists.' });
    }
    res.status(500).send('Server error');
  }
});

// POST /api/inventory/purchase
// Owner & Manager - Receive delivery and calculate Moving Average Cost
router.post('/purchase', authenticate, authorize('owner', 'manager'), validateZod(purchaseSchema), async (req, res) => {
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
// GET /api/inventory/history
// Owner & Manager - View restock history
router.get('/history', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const PurchaseOrder = require('../models/PurchaseOrder');
    const User = require('../models/User'); // ensure populated
    const history = await PurchaseOrder.find()
      .populate('ingredientId', 'name')
      .populate('receivedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST /api/inventory/import
// Owner & Manager - Bulk import ingredients
router.post('/import', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { items } = req.body; // Array of ingredient objects
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided for import.' });
    }

    const results = { added: 0, updated: 0, errors: [] };

    for (const item of items) {
      try {
        const { name, purchaseUnit, unitCost, stockQuantity, lowStockThreshold } = item;
        if (!name || !purchaseUnit || unitCost === undefined || stockQuantity === undefined) {
          results.errors.push({ name: name || 'Unknown', error: 'Missing required fields' });
          continue;
        }

        // Check if exists
        let existing = await Ingredient.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        if (existing) {
          existing.purchaseUnit = purchaseUnit;
          existing.unitCost = unitCost;
          existing.stockQuantity = stockQuantity;
          if (lowStockThreshold !== undefined) existing.lowStockThreshold = lowStockThreshold;
          await existing.save();
          results.updated++;
        } else {
          const newIng = new Ingredient({ name, purchaseUnit, unitCost, stockQuantity, lowStockThreshold: lowStockThreshold || 5 });
          await newIng.save();
          results.added++;
        }
      } catch (e) {
        results.errors.push({ name: item.name, error: e.message });
      }
    }

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
