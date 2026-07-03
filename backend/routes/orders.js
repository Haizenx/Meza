const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
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

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation Error', errors: errors.array() });
  next();
};

// POST /api/orders
// Create an order with idempotency, server-side calculation, and atomic inventory deduction
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
    const { localUUID, items, paymentMethod, cashTendered, shiftId, customerName, splitPayments, fulfillmentStatus } = req.body;

    if (!localUUID) return res.status(400).json({ message: 'localUUID is required' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'Order must contain items' });

    // Idempotency check
    const existingOrder = await Order.findOne({ localUUID });
    if (existingOrder) {
      return res.status(200).json(existingOrder);
    }

    let subtotal = 0;
    const processedItems = [];
    const inventoryDeductions = new Map(); // ingredientId -> quantity to deduct

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (let item of items) {
        if (!item.menuItemId || item.quantity <= 0) {
          throw new Error('Invalid item data');
        }

        // 1. Fetch current price from DB (do NOT trust client price)
        const menuItem = await MenuItem.findById(item.menuItemId).session(session);
        if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);
      
      let basePrice = menuItem.price;
      if (item.size && menuItem.sizes && menuItem.sizes.length > 0) {
        const sizeObj = menuItem.sizes.find(s => s.name === item.size);
        if (sizeObj) basePrice = sizeObj.price;
      }

      let modifierSum = 0;
      const verifiedModifiers = [];
      
      if (Array.isArray(item.modifiers)) {
        item.modifiers.forEach(mod => {
          let foundOption = null;
          if (menuItem.modifierGroups) {
            for (let group of menuItem.modifierGroups) {
              const opt = group.options.find(o => o.name === mod.name);
              if (opt) { foundOption = opt; break; }
            }
          }
          if (foundOption) {
            modifierSum += foundOption.price || 0;
            verifiedModifiers.push({ name: foundOption.name, price: foundOption.price || 0 });
          }
        });
      }

      const itemFinalPrice = basePrice + modifierSum;
      const itemTotal = itemFinalPrice * item.quantity;
      subtotal += itemTotal;

      processedItems.push({
        menuItemId: menuItem._id,
        nameAtSale: menuItem.name || 'Unknown Item',
        priceAtSale: itemFinalPrice || 0, // Snapshotted at moment of sale (includes modifiers)
        quantity: item.quantity || 1,
        size: item.size || null,
        note: item.note || '',
        modifiers: verifiedModifiers || []
      });

      // 2. Deduct Finished Goods Stock directly from MenuItem
      await MenuItem.updateOne({ _id: menuItem._id }, { $inc: { stockQuantity: -item.quantity } }, { session });
      menuItem.stockQuantity = (menuItem.stockQuantity || 0) - item.quantity;

      // Low Stock Alert for Finished Good
      if (menuItem.stockQuantity <= (menuItem.lowStockThreshold || 5)) {
        if (req.io) {
          req.io.emit('inventory:low_stock', {
            ingredientId: menuItem._id,
            name: menuItem.name,
            stockQuantity: menuItem.stockQuantity
          });
        }
      }

      // 3. Queue Raw Inventory Deductions based on Recipe
      const recipe = await Recipe.findOne({ menuItemId: menuItem._id });
      if (recipe && recipe.ingredients) {
        for (let ri of recipe.ingredients) {
          const ingId = ri.ingredientId.toString();
          const deductAmount = ri.quantity * item.quantity;
          
          if (inventoryDeductions.has(ingId)) {
            inventoryDeductions.set(ingId, inventoryDeductions.get(ingId) + deductAmount);
          } else {
            inventoryDeductions.set(ingId, deductAmount);
          }
        }
      }
    }

    // Calculate Final Total
    // Constants re-declared later in the file for split payment logic

    // 4. Execute Atomic Raw Inventory Deductions
    for (let [ingId, amount] of inventoryDeductions.entries()) {
      await Ingredient.updateOne({ _id: ingId }, { $inc: { stockQuantity: -amount } }, { session });
      const ingredient = await Ingredient.findById(ingId).session(session);
      if (ingredient) {

        // Low Stock Alert for Raw Ingredient
        if (ingredient.stockQuantity <= ingredient.lowStockThreshold) {
          if (req.io) {
            req.io.emit('inventory:low_stock', {
              ingredientId: ingredient._id,
              name: ingredient.name,
              stockQuantity: ingredient.stockQuantity
            });
          }
        }
      }
    }

    // We are no longer trusting client total.
    // If you have a discount system, you should compute it here.
    // For now, no discount is applied server-side.
    const discountAmount = 0; 
    const total = Math.max(0, subtotal - discountAmount);
    
    // Calculate Change
    let changeDue = 0;
    if (paymentMethod === 'cash' && cashTendered >= total) {
      changeDue = cashTendered - total;
    } else if (paymentMethod === 'split' && Array.isArray(splitPayments)) {
      const totalTendered = splitPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      if (totalTendered >= total) {
        changeDue = totalTendered - total;
      }
    }

    const newOrder = new Order({
      localUUID,
      items: processedItems,
      subtotal,
      discountAmount,
      total,
      paymentMethod,
      splitPayments: paymentMethod === 'split' ? splitPayments : [],
      cashTendered,
      changeDue,
      customerName,
      cashierId: req.user.id,
      shiftId: shiftId,
      status: 'completed',
      fulfillmentStatus: fulfillmentStatus || 'pending'
    });

    await newOrder.save({ session });

    if (newOrder.status === 'completed') {
      const transaction = new Transaction({
        orderId: newOrder._id,
        type: 'sale',
        subtotal: newOrder.subtotal,
        discountAmount: newOrder.discountAmount,
        total: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        cashTendered: newOrder.cashTendered,
        changeDue: newOrder.changeDue,
        cashierId: newOrder.cashierId
      });
      await transaction.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Broadcast new order to Dashboard and KDS
    if (req.io) {
      req.io.emit('order:created', newOrder);
      req.io.emit('shift:updated'); // Force ShiftHistory to recalculate live totals
      req.io.emit('kds:new_order', newOrder);
    }

    res.status(201).json(newOrder);
    
    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }

  } catch (err) {
    console.error('Order creation failed:', err.message);
    
    // Check if error is due to non-replica set
    if (err.message.includes('Transaction numbers are only allowed on a replica set member')) {
      return res.status(500).json({ 
        message: 'Database Configuration Error: MongoDB Transactions require a Replica Set. If running locally, you must run MongoDB as a single-node replica set.' 
      });
    }

    res.status(400).json({ message: err.message || 'Failed to process order' });
  }
});

// POST /api/orders/qr
// Public endpoint for Table-Side QR Ordering
router.post('/qr', async (req, res) => {
  try {
    const { localUUID, items, paymentMethod, tableNumber, isPaidOnline } = req.body;

    if (!localUUID) return res.status(400).json({ message: 'localUUID is required' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'Order must contain items' });
    if (!tableNumber) return res.status(400).json({ message: 'Table number is required' });

    const existingOrder = await Order.findOne({ localUUID });
    if (existingOrder) {
      return res.status(200).json(existingOrder);
    }

    let subtotal = 0;
    const processedItems = [];
    const inventoryDeductions = new Map(); 

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (let item of items) {
        if (!item.menuItemId || item.quantity <= 0) {
          throw new Error('Invalid item data');
        }

        const menuItem = await MenuItem.findById(item.menuItemId).session(session);
        if (!menuItem) throw new Error(`MenuItem not found: ${item.menuItemId}`);
      if (!menuItem.isAvailable) throw new Error(`Item ${menuItem.name} is currently unavailable`);

      const itemTotal = menuItem.price * item.quantity;
      subtotal += itemTotal;

      processedItems.push({
        menuItemId: menuItem._id,
        nameAtSale: menuItem.name || 'Unknown Item',
        priceAtSale: menuItem.price || 0,
        quantity: item.quantity || 1,
        size: item.size || null,
        note: item.note || ''
      });

      await MenuItem.updateOne({ _id: menuItem._id }, { $inc: { stockQuantity: -item.quantity } }, { session });
      menuItem.stockQuantity = (menuItem.stockQuantity || 0) - item.quantity;

      if (menuItem.stockQuantity <= (menuItem.lowStockThreshold || 5)) {
        if (req.io) {
          req.io.emit('inventory:low_stock', {
            ingredientId: menuItem._id,
            name: menuItem.name,
            stockQuantity: menuItem.stockQuantity
          });
        }
      }

      const recipe = await Recipe.findOne({ menuItemId: menuItem._id });
      if (recipe && recipe.ingredients) {
        for (let ri of recipe.ingredients) {
          const ingId = ri.ingredientId.toString();
          const deductAmount = ri.quantity * item.quantity;
          
          if (inventoryDeductions.has(ingId)) {
            inventoryDeductions.set(ingId, inventoryDeductions.get(ingId) + deductAmount);
          } else {
            inventoryDeductions.set(ingId, deductAmount);
          }
        }
      }
    }

    const total = subtotal;

    for (let [ingId, amount] of inventoryDeductions.entries()) {
      await Ingredient.updateOne({ _id: ingId }, { $inc: { stockQuantity: -amount } }, { session });
      const ingredient = await Ingredient.findById(ingId).session(session);
      if (ingredient) {

        if (ingredient.stockQuantity <= ingredient.lowStockThreshold) {
          if (req.io) {
            req.io.emit('inventory:low_stock', {
              ingredientId: ingredient._id,
              name: ingredient.name,
              stockQuantity: ingredient.stockQuantity
            });
          }
        }
      }
    }

    const status = isPaidOnline ? 'completed' : 'unpaid';
    const finalPaymentMethod = isPaidOnline ? 'online' : (paymentMethod || 'cash');

    const newOrder = new Order({
      localUUID,
      items: processedItems,
      subtotal,
      total,
      paymentMethod: finalPaymentMethod,
      orderType: 'qr',
      tableNumber: tableNumber,
      status: status,
      fulfillmentStatus: 'pending'
    });

    await newOrder.save({ session });
    
    if (status === 'completed') {
      const transaction = new Transaction({
        orderId: newOrder._id,
        type: 'sale',
        subtotal: newOrder.subtotal,
        discountAmount: 0,
        total: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        cashTendered: newOrder.total,
        changeDue: 0
      });
      await transaction.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    if (req.io) {
      req.io.emit('order:created', newOrder);
      if (status === 'completed') {
        req.io.emit('kds:new_order', newOrder);
      } else {
        // Unpaid order, just notify cashier
        req.io.emit('order:updated', newOrder);
      }
    }

    res.status(201).json(newOrder);

    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }

  } catch (err) {
    console.error('QR Order creation failed:', err.message);
    res.status(400).json({ message: err.message || 'Failed to process order' });
  }
});

// GET /api/orders (History)
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('cashierId', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(orders);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('cashierId', 'name')
      .populate('items.menuItemId', 'name photoUrl');
    if (!order) return res.status(404).send('Order not found');
    res.json(order);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/orders/:id/void
router.put('/:id/void', authenticate, async (req, res) => {
  try {
    const { voidReason, managerPin } = req.body;
    
    // Authenticate manager via PIN
    if (!managerPin) return res.status(400).json({ message: 'Manager PIN is required to authorize void.' });
    
    const managers = await User.find({ role: { $in: ['manager', 'owner'] }, pinHash: { $exists: true } });
    let authorizedManager = null;
    for (let m of managers) {
      if (await bcrypt.compare(managerPin, m.pinHash)) {
        authorizedManager = m;
        break;
      }
    }
    
    if (!authorizedManager) {
      return res.status(403).json({ message: 'Invalid Manager PIN' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('Order not found');
    if (order.status === 'voided') return res.status(400).json({ message: 'Order already voided' });

    order.status = 'voided';
    order.voidedBy = authorizedManager._id;
    order.voidReason = voidReason;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await order.save({ session });

      // Create a void transaction
      const originalTx = await Transaction.findOne({ orderId: order._id, type: 'sale' }).session(session);
      
      const transaction = new Transaction({
        orderId: order._id,
        originalTransactionId: originalTx ? originalTx._id : undefined,
        type: 'void',
        subtotal: -order.subtotal, // Negate for analytics summing
        discountAmount: -order.discountAmount,
        total: -order.total,
        paymentMethod: order.paymentMethod,
        managerId: authorizedManager._id,
        reason: voidReason
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }

    if (req.io) {
      req.io.emit('order:updated', order);
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// GET /api/orders/kds/active (Fetch active orders for KDS)
router.get('/kds/active', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ 
      status: 'completed', 
      fulfillmentStatus: { $in: ['pending', 'preparing', 'ready'] } 
    }).sort({ createdAt: 1 }); // Oldest first
    
    res.json(orders);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/orders/:id/kds (Update KDS status)
router.put('/:id/kds', authenticate, async (req, res) => {
  try {
    const { fulfillmentStatus } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('Order not found');

    order.fulfillmentStatus = fulfillmentStatus;
    await order.save();

    if (req.io) {
      req.io.emit('kds:update_status', order);
    }

    res.json(order);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/orders/unpaid
router.get('/unpaid', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ status: 'unpaid' }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/orders/:id/pay
router.put('/:id/pay', authenticate, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send('Order not found');

    order.status = 'completed';
    order.fulfillmentStatus = 'preparing';
    order.paymentMethod = paymentMethod || 'cash';
    order.cashierId = req.user.id; // Record who processed the payment
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await order.save({ session });

      const transaction = new Transaction({
        orderId: order._id,
        type: 'sale',
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        paymentMethod: order.paymentMethod,
        cashTendered: order.cashTendered,
        changeDue: order.changeDue,
        cashierId: req.user.id
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (transactionErr) {
      await session.abortTransaction();
      session.endSession();
      throw transactionErr;
    }

    if (req.io) {
      req.io.emit('order:updated', order);
      req.io.emit('shift:updated'); // Updates the shift stats with this new paid revenue
      req.io.emit('kds:new_order', order); // Now that it's paid, send to Kitchen!
    }

    res.json(order);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
