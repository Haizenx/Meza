const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const Order = require('../models/Order');
const { authenticate, authorize } = require('../middleware/auth');

// Get current open shift for user
router.get('/current', authenticate, async (req, res) => {
  try {
    const shift = await Shift.findOne({ staff: req.user.id, status: 'open' });
    res.json(shift); // Returns null if no active shift
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Start a new shift
router.post('/start', authenticate, async (req, res) => {
  try {
    const existing = await Shift.findOne({ staff: req.user.id, status: 'open' });
    if (existing) return res.status(400).json({ message: 'Shift already open' });

    const newShift = new Shift({
      staff: req.user.id,
      startingCash: req.body.startingCash
    });
    await newShift.save();
    if (req.io) req.io.emit('shift:updated');
    res.status(201).json(newShift);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// End the shift
router.post('/end', authenticate, async (req, res) => {
  try {
    const shift = await Shift.findOne({ staff: req.user.id, status: 'open' });
    if (!shift) return res.status(404).json({ message: 'No open shift found' });

    // Calculate expected cash (Starting Cash + Cash Orders)
    // Note: The frontend is sending "Cash" (capital C) so we match that, though previously 'cash' might have been lowercase. We'll search case-insensitively or just 'Cash'.
    const orders = await Order.find({ shiftId: shift._id, status: { $ne: 'voided' } });
    let cashSales = 0;
    orders.forEach(order => {
      const pm = (order.paymentMethod || '').toLowerCase();
      if (pm === 'cash') {
        cashSales += order.total;
      } else if (pm === 'split' && Array.isArray(order.splitPayments)) {
        order.splitPayments.forEach(p => {
          if ((p.method || '').toLowerCase() === 'cash') {
            cashSales += (p.amount || 0);
          }
        });
      }
    });
    
    shift.expectedCash = shift.startingCash + cashSales;
    shift.actualCash = req.body.actualCash;
    shift.endTime = new Date();
    shift.status = 'closed';

    await shift.save();
    if (req.io) req.io.emit('shift:updated');
    res.json(shift);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get all historical shifts (Admin only)
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const shifts = await Shift.find().populate('staff', 'name').sort({ startTime: -1 }).lean();
    
    // Calculate live expectedCash for open shifts
    for (let shift of shifts) {
      if (shift.status === 'open') {
        const cashOrders = await Order.find({ shiftId: shift._id, paymentMethod: { $regex: /^cash$/i } });
        const cashSales = cashOrders.reduce((sum, order) => sum + order.total, 0);
        shift.expectedCash = shift.startingCash + cashSales;
      }
    }
    
    res.json(shifts);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get analytics for a specific shift
router.get('/:id/analytics', authenticate, async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('staff', 'name').lean();
    if (!shift) return res.status(404).json({ message: 'Shift not found' });

    const orders = await Order.find({ shiftId: shift._id }).populate('items.menuItemId', 'name').lean();
    
    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let gcashSales = 0;
    const itemCounts = {};

    orders.forEach(order => {
      totalSales += order.total;
      const pm = (order.paymentMethod || '').toLowerCase();
      if (pm === 'split' && Array.isArray(order.splitPayments)) {
        order.splitPayments.forEach(p => {
          if (p.method === 'cash') cashSales += p.amount;
          else if (p.method === 'card') cardSales += p.amount;
          else if (p.method === 'gcash') gcashSales += p.amount;
        });
      } else {
        if (pm === 'cash') cashSales += order.total;
        else if (pm === 'card') cardSales += order.total;
        else if (pm === 'gcash') gcashSales += order.total;
      }

      order.items.forEach(item => {
        const itemName = item.nameAtSale || (item.menuItemId ? item.menuItemId.name : 'Unknown Item');
        if (!itemCounts[itemName]) itemCounts[itemName] = { name: itemName, qty: 0, revenue: 0 };
        itemCounts[itemName].qty += item.quantity || 1;
        itemCounts[itemName].revenue += ((item.quantity || 1) * (item.priceAtSale || 0));
      });
    });

    const topItems = Object.values(itemCounts).sort((a, b) => b.qty - a.qty);

    res.json({
      shift,
      analytics: {
        totalOrders: orders.length,
        totalSales,
        cashSales,
        cardSales,
        gcashSales,
        topItems,
        orders
      }
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
