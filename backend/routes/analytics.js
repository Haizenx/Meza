const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const Transaction = require('../models/Transaction');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/analytics/sales
// Owner & Manager
router.get('/sales', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);

    // Compute from immutable Transaction ledger for BIR compliance
    const salesData = await Transaction.aggregate([
      { $match: { timestamp: { $gte: today } } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          orderCount: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, 1, 0] } }, // Only count sales, not voids
          avgOrderValue: { $avg: '$total' } // Note: this will factor in negatives, which is technically correct net AOV
      }}
    ]);

    res.json(salesData.length > 0 ? salesData[0] : { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/analytics/top-items
// Owner & Manager
router.get('/top-items', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const topItems = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      { $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.nameAtSale' },
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceAtSale', '$items.quantity'] } }
      }},
      { $sort: { quantitySold: -1 } },
      { $limit: 10 }
    ]);
    res.json(topItems);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/analytics/margins
// OWNER ONLY
router.get('/margins', authenticate, authorize('owner'), async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ isArchived: false });
    const recipes = await Recipe.find().populate('ingredients.ingredientId');
    
    // Get quantities sold
    const topItems = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.menuItemId', quantitySold: { $sum: '$items.quantity' } } }
    ]);

    const salesMap = {};
    topItems.forEach(item => {
      salesMap[item._id.toString()] = item.quantitySold;
    });

    const marginsData = menuItems.map(item => {
      const recipe = recipes.find(r => r.menuItemId && r.menuItemId.toString() === item._id.toString());
      let cogs = 0;
      const ingredientsBreakdown = [];
      
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
            const actualCost = ri.ingredientId.movingAverageCost || ri.ingredientId.unitCost;
            const ingredientCost = convertedQuantity * actualCost;
            cogs += ingredientCost;

            ingredientsBreakdown.push({
              name: ri.ingredientId.name,
              quantity: ri.quantity,
              unit: ri.unit,
              cost: ingredientCost
            });
          }
        }
      }

      const marginPercent = item.price > 0 ? ((item.price - cogs) / item.price) * 100 : 0;
      const volume = salesMap[item._id.toString()] || 0;

      return {
        _id: item._id,
        name: item.name,
        category: item.category,
        sellPrice: item.price,
        cogs,
        marginPercent,
        volume,
        ingredientsBreakdown
      };
    });

    res.json(marginsData);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/analytics/dashboard
// Comprehensive system-wide analytics for the new Dashboard UI
router.get('/dashboard', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const Shift = require('../models/Shift');
    const Ingredient = require('../models/Ingredient');
    const { toZonedTime, format } = require('date-fns-tz');
    const { startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, subYears, endOfDay } = require('date-fns');

    const timeframe = req.query.timeframe || 'daily'; // daily, weekly, monthly
    
    // Always calculate boundaries relative to Manila time
    const timeZone = 'Asia/Manila';
    const nowInManila = toZonedTime(new Date(), timeZone);
    let currentStart, previousStart, previousEnd, trendStart, trendDays, trendFormat, trendGroupBy;

    if (timeframe === 'yearly') {
      currentStart = startOfYear(nowInManila);
      previousStart = startOfYear(subYears(nowInManila, 1));
      previousEnd = endOfDay(subDays(currentStart, 1));
      trendStart = startOfYear(subYears(nowInManila, 4)); // 5 years trend
      trendDays = 5;
      trendFormat = '%Y';
      trendGroupBy = { year: { $year: { date: '$createdAt', timezone: 'Asia/Manila' } } };
    } else if (timeframe === 'monthly') {
      currentStart = startOfMonth(nowInManila);
      previousStart = startOfMonth(subMonths(nowInManila, 1));
      previousEnd = endOfDay(subDays(currentStart, 1));
      trendStart = startOfMonth(subMonths(nowInManila, 5)); // 6 months trend
      trendDays = 6;
      trendFormat = '%Y-%m';
      trendGroupBy = { year: { $year: { date: '$createdAt', timezone: 'Asia/Manila' } }, month: { $month: { date: '$createdAt', timezone: 'Asia/Manila' } } };
    } else if (timeframe === 'weekly') {
      // Assuming week starts on Sunday
      currentStart = startOfWeek(nowInManila, { weekStartsOn: 0 });
      previousStart = startOfWeek(subWeeks(nowInManila, 1), { weekStartsOn: 0 });
      previousEnd = endOfDay(subDays(currentStart, 1));
      trendStart = startOfWeek(subWeeks(nowInManila, 4), { weekStartsOn: 0 }); // 5 weeks trend
      trendDays = 5;
      trendFormat = '%Y-%U'; // week number
      trendGroupBy = { year: { $year: { date: '$createdAt', timezone: 'Asia/Manila' } }, week: { $week: { date: '$createdAt', timezone: 'Asia/Manila' } } };
    } else { // daily
      currentStart = startOfDay(nowInManila);
      previousStart = startOfDay(subDays(nowInManila, 1));
      previousEnd = endOfDay(subDays(nowInManila, 1));
      trendStart = startOfDay(subDays(nowInManila, 6)); // 7 days trend
      trendDays = 7;
      trendFormat = '%Y-%m-%d';
      trendGroupBy = { year: { $year: { date: '$createdAt', timezone: 'Asia/Manila' } }, month: { $month: { date: '$createdAt', timezone: 'Asia/Manila' } }, day: { $dayOfMonth: { date: '$createdAt', timezone: 'Asia/Manila' } } };
    }

    // 1. Current & Previous Stats (from Transaction Ledger)
    const currentStatsPromise = Transaction.aggregate([
      { $match: { timestamp: { $gte: currentStart } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, 1, 0] } }, aov: { $avg: '$total' } } }
    ]);

    const previousStatsPromise = Transaction.aggregate([
      { $match: { timestamp: { $gte: previousStart, $lte: previousEnd } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: { $cond: [{ $eq: ['$type', 'sale'] }, 1, 0] } }, aov: { $avg: '$total' } } }
    ]);

    // 2. Trend (from Transaction Ledger)
    const trendGroupByTx = { 
      year: { $year: { date: '$timestamp', timezone: 'Asia/Manila' } }, 
      month: { $month: { date: '$timestamp', timezone: 'Asia/Manila' } }, 
      day: { $dayOfMonth: { date: '$timestamp', timezone: 'Asia/Manila' } } 
    };
    if (timeframe === 'yearly') {
      trendGroupByTx.month = undefined;
      trendGroupByTx.week = undefined;
      trendGroupByTx.day = undefined;
    } else if (timeframe === 'monthly') {
      trendGroupByTx.week = undefined;
      trendGroupByTx.day = undefined;
    } else if (timeframe === 'weekly') {
      trendGroupByTx.week = { $week: { date: '$timestamp', timezone: 'Asia/Manila' } };
      trendGroupByTx.day = undefined;
    }
    
    const trendPromise = Transaction.aggregate([
      { $match: { timestamp: { $gte: trendStart } } },
      {
        $group: {
          _id: trendGroupByTx,
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } }
    ]);

    // 3. Top Items
    const topItemsPromise = Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: trendStart } } },
      { $unwind: '$items' },
      { $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.nameAtSale' },
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.priceAtSale', '$items.quantity'] } }
      }},
      { $sort: { quantity: -1 } },
      { $limit: 6 }
    ]);

    // 4. Low Stock (Only ingredients now, menu items are derived)
    const lowIngredientsPromise = Ingredient.find({ $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] } }).lean();

    // 5. Active Shifts
    const activeShiftsPromise = Shift.find({ status: 'open' }).populate('staff', 'name').lean();

    const [
      currentRes, previousRes, trendRes, topItems, lowIng, activeShifts
    ] = await Promise.all([
      currentStatsPromise, previousStatsPromise, trendPromise, topItemsPromise, lowIngredientsPromise, activeShiftsPromise
    ]);

    const today = currentRes[0] || { revenue: 0, orders: 0, aov: 0 }; // using 'today' key for frontend compatibility
    const yesterday = previousRes[0] || { revenue: 0, orders: 0, aov: 0 };

    // Format trend data (just return the raw grouped data and let frontend handle empty periods or formatting)
    // For simplicity, we'll map the grouped _id to a string date/label.
    const sevenDayTrend = trendRes.map(t => {
      let label = '';
      if (timeframe === 'yearly') {
        label = `${t._id.year}`;
      } else if (timeframe === 'monthly') {
        label = `${t._id.year}-${String(t._id.month).padStart(2, '0')}`;
      } else if (timeframe === 'weekly') {
        label = `Week ${t._id.week}, ${t._id.year}`;
      } else {
        label = `${t._id.year}-${String(t._id.month).padStart(2, '0')}-${String(t._id.day).padStart(2, '0')}`;
      }
      return {
        date: label,
        day: label, // fallback
        revenue: t.revenue
      };
    });

    const lowStockItems = lowIng.map(i => ({ _id: i._id, name: i.name, stock: i.stockQuantity || 0, type: 'Raw Ingredient' }))
      .sort((a,b) => a.stock - b.stock).slice(0, 5); // top 5 lowest

    res.json({
      today,
      yesterday,
      sevenDayTrend,
      topItems,
      lowStockItems,
      activeShifts: activeShifts.map(s => ({ staffName: s.staff?.name || 'Unknown', expectedCash: s.expectedCash }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
