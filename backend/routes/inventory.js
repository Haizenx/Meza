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
    supplierName: z.string().max(100).optional(),
    invoiceId: z.string().max(100).optional()
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
    const { name, purchaseUnit, unitCost, currency, stockQuantity, lowStockThreshold, __v } = req.body;
    
    const existingItem = await Ingredient.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');
    
    // Optimistic Concurrency Control
    if (__v !== undefined && existingItem.__v > __v) {
      return res.status(409).json({ message: 'Conflict: This item was modified by another user. Please refresh and try again.' });
    }

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
// Owner & Manager - Receive delivery and calculate Moving Average Cost atomically
router.post('/purchase', authenticate, authorize('owner', 'manager'), validateZod(purchaseSchema), async (req, res) => {
  try {
    const PurchaseOrder = require('../models/PurchaseOrder');
    const { ingredientId, quantityReceived, totalCostPaid, supplierName, invoiceId } = req.body;
    
    const unitCostForBatch = totalCostPaid / quantityReceived;

    // Create Purchase Order Record
    const po = new PurchaseOrder({
      ingredientId,
      quantityReceived,
      totalCostPaid,
      unitCostForBatch,
      receivedBy: req.user.id,
      supplierName,
      invoiceId
    });
    await po.save();

    // Update Ingredient atomically using Aggregation Pipeline in Update (MongoDB 4.2+)
    const updatedIngredient = await Ingredient.findOneAndUpdate(
      { _id: ingredientId },
      [{
        $set: {
          movingAverageCost: {
            $divide: [
              { $add: [
                { $multiply: [
                  { $ifNull: ["$stockQuantity", 0] },
                  { $ifNull: ["$movingAverageCost", "$unitCost"] }
                ]},
                totalCostPaid
              ]},
              { $add: [{ $ifNull: ["$stockQuantity", 0] }, quantityReceived] }
            ]
          },
          unitCost: {
            $divide: [
              { $add: [
                { $multiply: [
                  { $ifNull: ["$stockQuantity", 0] },
                  { $ifNull: ["$movingAverageCost", "$unitCost"] }
                ]},
                totalCostPaid
              ]},
              { $add: [{ $ifNull: ["$stockQuantity", 0] }, quantityReceived] }
            ]
          },
          stockQuantity: {
            $add: [{ $ifNull: ["$stockQuantity", 0] }, quantityReceived]
          }
        }
      }],
      { new: true }
    );

    if (!updatedIngredient) {
      return res.status(404).send('Ingredient not found');
    }

    if (req.io) {
      req.io.emit('inventory:updated');
    }

    res.status(201).json({ purchaseOrder: po, updatedIngredient });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
// GET /api/inventory/history
// Owner & Manager - View unified restock and audit history
router.get('/history', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const PurchaseOrder = require('../models/PurchaseOrder');
    const AuditLog = require('../models/AuditLog');
    const User = require('../models/User'); 
    const Ingredient = require('../models/Ingredient');

    // Fetch Deliveries
    const deliveries = await PurchaseOrder.find().limit(200)
      .populate('ingredientId', 'name purchaseUnit')
      .populate('receivedBy', 'name email')
      .lean();

    // Fetch Manual Adjustments
    const audits = await AuditLog.find({ action: 'MANUAL_STOCK_ADJUSTMENT' }).limit(200)
      .populate('targetId', 'name purchaseUnit')
      .populate('actorId', 'name email')
      .lean();

    // Normalize and combine
    const unifiedHistory = [];
    
    for (const d of deliveries) {
      unifiedHistory.push({
        _id: d._id,
        type: 'DELIVERY',
        createdAt: d.receivedAt || d.createdAt,
        ingredientName: d.ingredientId?.name || 'Unknown Item',
        unit: d.ingredientId?.purchaseUnit || '',
        quantityReceived: d.quantityReceived,
        totalCostPaid: d.totalCostPaid,
        supplierName: d.supplierName || 'N/A',
        actorName: d.receivedBy?.name || 'Unknown User'
      });
    }

    for (const a of audits) {
      unifiedHistory.push({
        _id: a._id,
        type: 'ADJUSTMENT',
        createdAt: a.createdAt,
        ingredientName: a.targetId?.name || 'Unknown Item',
        unit: a.targetId?.purchaseUnit || '',
        oldValue: a.oldValue,
        newValue: a.newValue,
        reason: a.reason || 'Manual Update from Dashboard',
        actorName: a.actorId?.name || 'Unknown User'
      });
    }

    // Sort chronologically descending
    unifiedHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(unifiedHistory);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// DELETE /api/inventory/:id
// Owner & Manager - Delete an ingredient
router.delete('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const existingItem = await Ingredient.findById(req.params.id);
    if (!existingItem) return res.status(404).send('Not found');
    await Ingredient.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ingredient deleted successfully' });
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
        let existing = await Ingredient.findOne({ name }).collation({ locale: 'en', strength: 2 });
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
