const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Recipe = require('../models/Recipe');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/analytics/sales
// Owner & Manager
router.get('/sales', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);

    // MongoDB Aggregation Pipeline for server-side computing
    const salesData = await Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: today } } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total' }
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
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // 1. Today & Yesterday Stats
    const todayStatsPromise = Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: todayStart } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 }, aov: { $avg: '$total' } } }
    ]);

    const yesterdayStatsPromise = Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: yesterdayStart, $lt: todayStart } } },
      { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 }, aov: { $avg: '$total' } } }
    ]);

    // 2. 7-Day Trend
    const sevenDayTrendPromise = Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Top Items (Last 7 days)
    const topItemsPromise = Order.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
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

    // 4. Low Stock
    const lowMenuItemsPromise = MenuItem.find({ $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }, isArchived: false }).lean();
    const lowIngredientsPromise = Ingredient.find({ $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] } }).lean();

    // 5. Active Shifts
    const activeShiftsPromise = Shift.find({ status: 'open' }).populate('staff', 'name').lean();

    const [
      todayRes, yesterdayRes, trendRes, topItems, lowMenu, lowIng, activeShifts
    ] = await Promise.all([
      todayStatsPromise, yesterdayStatsPromise, sevenDayTrendPromise, topItemsPromise, lowMenuItemsPromise, lowIngredientsPromise, activeShiftsPromise
    ]);

    const today = todayRes[0] || { revenue: 0, orders: 0, aov: 0 };
    const yesterday = yesterdayRes[0] || { revenue: 0, orders: 0, aov: 0 };

    // Format trend data (fill in missing days with 0)
    const sevenDayTrend = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const match = trendRes.find(t => t._id === dateStr);
      
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      sevenDayTrend.push({
        date: dateStr,
        day: dayName,
        revenue: match ? match.revenue : 0
      });
    }

    const lowStockItems = [
      ...lowMenu.map(m => ({ _id: m._id, name: m.name, stock: m.stockQuantity || 0, type: 'Finished Good' })),
      ...lowIng.map(i => ({ _id: i._id, name: i.name, stock: i.stockQuantity || 0, type: 'Raw Ingredient' }))
    ].sort((a,b) => a.stock - b.stock).slice(0, 5); // top 5 lowest

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
