const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Ingredient = require('../models/Ingredient');
const Shift = require('../models/Shift');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const AuditLog = require('../models/AuditLog');

const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: 'Too many orders from this device. Please wait a moment.' }
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation Error', errors: errors.array() });
  next();
};

// Fulfillment status transition map
const VALID_TRANSITIONS = {
  pending: ['preparing'],
  preparing: ['ready'],
  ready: ['served'],
  served: []
};

// Helper: Process items, compute prices server-side, return processedItems and subtotal
async function processOrderItems(items, menuItemDeductions) {
  let subtotal = 0;
  const processedItems = [];
  const ingredientDeductionsMap = new Map();

  for (const item of items) {
    if (!item.menuItemId || item.quantity <= 0 || item.quantity > 99) {
      throw new Error('Invalid item data');
    }

    const menuItem = await MenuItem.findById(item.menuItemId);
    if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);

    let basePrice = menuItem.price;
    if (item.size && menuItem.sizes && menuItem.sizes.length > 0) {
      const sizeObj = menuItem.sizes.find(s => s.name === item.size);
      if (sizeObj) basePrice = sizeObj.price;
    }

    let modifierSum = 0;
    const verifiedModifiers = [];
    if (Array.isArray(item.modifiers)) {
      for (const mod of item.modifiers) {
        let foundOption = null;
        if (menuItem.modifierGroups) {
          for (const group of menuItem.modifierGroups) {
            const opt = group.options.find(o => o.name === mod.name);
            if (opt) { foundOption = opt; break; }
          }
        }
        if (foundOption) {
          modifierSum += foundOption.price || 0;
          verifiedModifiers.push({ name: foundOption.name, price: foundOption.price || 0 });
        }
      }
    }

    const itemFinalPrice = basePrice + modifierSum;
    subtotal += itemFinalPrice * item.quantity;

    processedItems.push({
      menuItemId: menuItem._id,
      nameAtSale: menuItem.name || 'Unknown Item',
      priceAtSale: itemFinalPrice || 0,
      quantity: item.quantity || 1,
      size: item.size || null,
      note: item.note || '',
      modifiers: verifiedModifiers || []
    });

    // Queue menu item deductions
    menuItemDeductions.push({ menuItemId: menuItem._id, quantity: item.quantity });

    // Queue raw ingredient deductions based on recipe
    const recipe = await Recipe.findOne({ menuItemId: menuItem._id });
    if (recipe && recipe.ingredients) {
      for (const ri of recipe.ingredients) {
        const ingId = ri.ingredientId.toString();
        const deductAmount = ri.quantity * item.quantity;
        ingredientDeductionsMap.set(ingId, (ingredientDeductionsMap.get(ingId) || 0) + deductAmount);
      }
    }
  }

  return { processedItems, subtotal, ingredientDeductionsMap };
}

// Helper: Execute atomic inventory deductions and emit low-stock alerts
async function executeDeductions(menuItemDeductions, ingredientDeductionsMap, io) {
  const ingredientDeductions = [];

  // Deduct finished goods atomically
  for (const { menuItemId, quantity } of menuItemDeductions) {
    const updated = await MenuItem.findOneAndUpdate(
      { _id: menuItemId },
      { $inc: { stockQuantity: -quantity } },
      { returnDocument: 'after' }
    );
    if (updated && updated.stockQuantity <= (updated.lowStockThreshold || 5)) {
      if (io) io.emit('inventory:low_stock', { ingredientId: updated._id, name: updated.name, stockQuantity: updated.stockQuantity });
    }
  }

  // Deduct raw ingredients atomically
  for (const [ingId, amount] of ingredientDeductionsMap.entries()) {
    const updated = await Ingredient.findOneAndUpdate(
      { _id: ingId },
      { $inc: { stockQuantity: -amount } },
      { returnDocument: 'after' }
    );
    ingredientDeductions.push({ ingredientId: ingId, quantity: amount });
    if (updated && updated.stockQuantity <= updated.lowStockThreshold) {
      if (io) io.emit('inventory:low_stock', { ingredientId: updated._id, name: updated.name, stockQuantity: updated.stockQuantity });
    }
  }

  return ingredientDeductions;
}

// POST /api/orders/audit-void
router.post('/audit-void', authenticate, [
  body('reason').isString().notEmpty(),
  body('cartTotal').isNumeric()
], async (req, res) => {
  try {
    const { reason, cartTotal, items } = req.body;
    const log = new AuditLog({
      action: 'CART_VOID',
      actorId: req.user.id,
      targetModel: 'Order',
      oldValue: { cartTotal, items },
      newValue: null,
      reason
    });
    await log.save();
    res.status(200).json({ message: 'Void audited successfully' });
  } catch (err) {
    console.error('Audit Void Error:', err);
    res.status(500).send('Server error');
  }
});

// POST /api/orders — POS order creation
router.post('/', authenticate, [
  body('localUUID').isString().notEmpty().withMessage('localUUID is required'),
  body('items').isArray({ min: 1 }).withMessage('Order must contain items'),
  body('items.*.menuItemId').isMongoId().withMessage('Valid menuItemId is required'),
  body('items.*.quantity').isInt({ gt: 0 }).withMessage('Quantity must be greater than 0'),
  body('paymentMethod').isIn(['cash', 'gcash', 'card', 'online', 'split']).withMessage('Invalid payment method'),
  body('cashTendered').optional().isNumeric(),
  body('shiftId').optional().isMongoId(),
  validate
], async (req, res) => {
  try {
    const { localUUID, items, paymentMethod, splitPayments, cashTendered, customerName, shiftId, fulfillmentStatus } = req.body;

    if (!localUUID) return res.status(400).json({ message: 'localUUID is required' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'Order must contain items' });
    if (!shiftId) return res.status(400).json({ message: 'Active shift ID is required' });

    const menuItemDeductions = [];
    const { processedItems, subtotal, ingredientDeductionsMap } = await processOrderItems(items, menuItemDeductions);

    // Execute inventory deductions immediately (POS orders are paid at the counter)
    const ingredientDeductions = await executeDeductions(menuItemDeductions, ingredientDeductionsMap, req.io);

    const discountAmount = 0;
    const total = Math.max(0, subtotal - discountAmount);

    let changeDue = 0;
    if (paymentMethod === 'cash' && cashTendered >= total) {
      changeDue = cashTendered - total;
    } else if (paymentMethod === 'split' && Array.isArray(splitPayments)) {
      const totalTendered = splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (totalTendered >= total) changeDue = totalTendered - total;
    }

    const newOrder = new Order({
      localUUID, items: processedItems, subtotal, discountAmount, total,
      paymentMethod, splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered, changeDue, customerName,
      cashierId: req.user.id, shiftId,
      status: 'completed', fulfillmentStatus: fulfillmentStatus || 'pending',
      ingredientDeductions, menuItemDeductions
    });

    await newOrder.save();

    await new Transaction({
      orderId: newOrder._id, type: 'sale',
      subtotal: newOrder.subtotal, discountAmount: newOrder.discountAmount,
      total: newOrder.total, paymentMethod: newOrder.paymentMethod,
      cashTendered: newOrder.cashTendered, changeDue: newOrder.changeDue,
      cashierId: newOrder.cashierId
    }).save();

    if (req.io) {
      req.io.emit('order:created', newOrder);
      req.io.emit('shift:updated');
      req.io.emit('kds:new_order', newOrder);
    }

    res.status(201).json(newOrder);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.localUUID) {
      const existingOrder = await Order.findOne({ localUUID: req.body.localUUID });
      return res.status(200).json(existingOrder);
    }
    console.error('Order creation failed:', err.message);
    res.status(400).json({ message: err.message || 'Failed to process order' });
  }
});

// POST /api/orders/qr — QR order (NO inventory deduction until paid)
router.post('/qr', qrLimiter, async (req, res) => {
  try {
    const { localUUID, items, paymentMethod, tableNumber } = req.body;

    if (!localUUID) return res.status(400).json({ message: 'localUUID is required' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'Order must contain items' });
    if (!tableNumber) return res.status(400).json({ message: 'Table number is required' });

    const menuItemDeductions = [];
    const { processedItems, subtotal, ingredientDeductionsMap } = await processOrderItems(items, menuItemDeductions);

    // QR orders do NOT deduct inventory until a cashier confirms payment.
    // Store the deduction snapshots so they can be applied when paid.

    const ingredientDeductions = [];
    for (const [ingId, amount] of ingredientDeductionsMap.entries()) {
      ingredientDeductions.push({ ingredientId: ingId, quantity: amount });
    }

    const newOrder = new Order({
      localUUID, items: processedItems, subtotal, total: subtotal,
      paymentMethod: paymentMethod || 'cash',
      orderType: 'qr', tableNumber,
      status: 'unpaid', fulfillmentStatus: 'pending',
      ingredientDeductions, menuItemDeductions
    });

    await newOrder.save();

    if (req.io) {
      req.io.emit('order:created', newOrder);
      req.io.emit('order:updated', newOrder);
    }

    res.status(201).json(newOrder);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && err.keyPattern.localUUID) {
      const existingOrder = await Order.findOne({ localUUID: req.body.localUUID });
      return res.status(200).json(existingOrder);
    }
    console.error('QR Order creation failed:', err.message);
    res.status(400).json({ message: err.message || 'Failed to process order' });
  }
});

// GET /api/orders (History)
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const orders = await Order.find().populate('cashierId', 'name').sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (err) { res.status(500).send('Server error'); }
});

// GET /api/orders/kds/active
router.get('/kds/active', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({
      status: 'completed',
      fulfillmentStatus: { $in: ['pending', 'preparing', 'ready'] }
    }).sort({ createdAt: 1 });
    res.json(orders);
  } catch (err) { res.status(500).send('Server error'); }
});

// GET /api/orders/unpaid
router.get('/unpaid', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ status: 'unpaid' }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).send('Server error'); }
});

// GET /api/orders/:id
router.get('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('cashierId', 'name').populate('items.menuItemId', 'name photoUrl');
    if (!order) return res.status(404).send('Order not found');
    res.json(order);
  } catch (err) { res.status(500).send('Server error'); }
});

// PUT /api/orders/:id/void
router.put('/:id/void', authenticate, async (req, res) => {
  try {
    const { voidReason, managerPin, managerId } = req.body;

    if (!managerPin || !managerId) return res.status(400).json({ message: 'Manager PIN and ID are required.' });

    const authorizedManager = await User.findById(managerId);
    if (!authorizedManager || !['manager', 'owner'].includes(authorizedManager.role) || !authorizedManager.pinHash) {
      return res.status(400).json({ message: 'Invalid manager account' });
    }

    if (authorizedManager.pinLockedUntil && authorizedManager.pinLockedUntil > new Date()) {
      return res.status(403).json({ message: 'This manager account is temporarily locked.' });
    }

    const isMatch = await bcrypt.compare(managerPin, authorizedManager.pinHash);
    if (isMatch) {
      authorizedManager.pinFailedAttempts = 0;
      authorizedManager.pinLockedUntil = null;
      await authorizedManager.save();
    } else {
      authorizedManager.pinFailedAttempts = (authorizedManager.pinFailedAttempts || 0) + 1;
      if (authorizedManager.pinFailedAttempts >= 5) {
        authorizedManager.pinLockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      }
      await authorizedManager.save();
      return res.status(403).json({ message: 'Invalid Manager PIN' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('Order not found');
    if (order.status === 'voided') return res.status(400).json({ message: 'Order already voided' });

    order.status = 'voided';
    order.voidedBy = authorizedManager._id;
    order.voidReason = voidReason;
    await order.save();

    // Create void transaction
    const originalTx = await Transaction.findOne({ orderId: order._id, type: 'sale' });
    await new Transaction({
      orderId: order._id,
      originalTransactionId: originalTx ? originalTx._id : undefined,
      type: 'void',
      subtotal: -order.subtotal,
      discountAmount: -order.discountAmount,
      total: -order.total,
      paymentMethod: order.paymentMethod,
      managerId: authorizedManager._id,
      reason: voidReason
    }).save();

    // RESTORE INVENTORY using the exact snapshot from sale time
    if (order.menuItemDeductions && order.menuItemDeductions.length > 0) {
      for (const d of order.menuItemDeductions) {
        await MenuItem.findOneAndUpdate({ _id: d.menuItemId }, { $inc: { stockQuantity: d.quantity } });
      }
    }
    if (order.ingredientDeductions && order.ingredientDeductions.length > 0) {
      for (const d of order.ingredientDeductions) {
        await Ingredient.findOneAndUpdate({ _id: d.ingredientId }, { $inc: { stockQuantity: d.quantity } });
      }
    }

    if (req.io) req.io.emit('order:updated', order);
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// PUT /api/orders/:id/kds — Update fulfillment status with transition guard
router.put('/:id/kds', authenticate, async (req, res) => {
  try {
    const { fulfillmentStatus } = req.body;
    const order = await Order.findOne({ _id: req.params.id, status: { $ne: 'voided' } });
    if (!order) return res.status(404).json({ message: 'Order not found or has been voided' });

    // Validate state transition
    const allowed = VALID_TRANSITIONS[order.fulfillmentStatus];
    if (!allowed || !allowed.includes(fulfillmentStatus)) {
      return res.status(400).json({ message: `Cannot transition from '${order.fulfillmentStatus}' to '${fulfillmentStatus}'` });
    }

    order.fulfillmentStatus = fulfillmentStatus;
    await order.save();

    if (req.io) req.io.emit('kds:update_status', order);
    res.json(order);
  } catch (err) { res.status(500).send('Server error'); }
});

// PUT /api/orders/:id/pay — Cashier confirms payment for QR/unpaid orders
router.put('/:id/pay', authenticate, async (req, res) => {
  try {
    const { paymentMethod } = req.body;

    const activeShift = await Shift.findOne({ status: 'open' }).sort({ createdAt: -1 });

    const existingOrder = await Order.findOne({ _id: req.params.id, status: 'unpaid' });
    if (!existingOrder) return res.status(400).json({ message: 'Order not found, already paid, or voided' });

    const updateFields = {
      status: 'completed',
      paymentMethod: paymentMethod || 'cash',
      cashierId: req.user.id
    };
    if (activeShift) updateFields.shiftId = activeShift._id;
    if (existingOrder.fulfillmentStatus === 'pending') updateFields.fulfillmentStatus = 'preparing';

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: 'unpaid' },
      { $set: updateFields },
      { new: true }
    );
    if (!order) return res.status(400).json({ message: 'Order was paid by another transaction' });

    // NOW deduct inventory (QR orders defer deduction to payment)
    if (order.menuItemDeductions && order.menuItemDeductions.length > 0) {
      for (const d of order.menuItemDeductions) {
        const updated = await MenuItem.findOneAndUpdate(
          { _id: d.menuItemId },
          { $inc: { stockQuantity: -d.quantity } },
          { returnDocument: 'after' }
        );
        if (updated && updated.stockQuantity <= (updated.lowStockThreshold || 5)) {
          if (req.io) req.io.emit('inventory:low_stock', { ingredientId: updated._id, name: updated.name, stockQuantity: updated.stockQuantity });
        }
      }
    }
    if (order.ingredientDeductions && order.ingredientDeductions.length > 0) {
      for (const d of order.ingredientDeductions) {
        const updated = await Ingredient.findOneAndUpdate(
          { _id: d.ingredientId },
          { $inc: { stockQuantity: -d.quantity } },
          { returnDocument: 'after' }
        );
        if (updated && updated.stockQuantity <= updated.lowStockThreshold) {
          if (req.io) req.io.emit('inventory:low_stock', { ingredientId: updated._id, name: updated.name, stockQuantity: updated.stockQuantity });
        }
      }
    }

    await new Transaction({
      orderId: order._id, type: 'sale',
      subtotal: order.subtotal, discountAmount: order.discountAmount,
      total: order.total, paymentMethod: order.paymentMethod,
      cashTendered: order.cashTendered, changeDue: order.changeDue,
      cashierId: req.user.id
    }).save();

    if (req.io) {
      req.io.emit('order:updated', order);
      req.io.emit('shift:updated');
      req.io.emit('kds:new_order', order);
    }

    res.json(order);
  } catch (err) { res.status(500).send('Server error'); }
});

module.exports = router;
