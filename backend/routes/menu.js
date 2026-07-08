const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItem');
const { authenticate, authorize } = require('../middleware/auth');
const { z } = require('zod');
const { validateZod } = require('../middleware/validate');

const sizeSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0)
});

const modifierOptionSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0).optional()
});

const modifierGroupSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(modifierOptionSchema)
});

const menuSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    category: z.string().min(1).max(50),
    price: z.number().min(0),
    photoUrl: z.string().url().optional().or(z.literal('')),
    isAvailable: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    sizes: z.array(sizeSchema).optional(),
    modifierGroups: z.array(modifierGroupSchema).optional()
  })
});


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
    const Recipe = require('../models/Recipe');
    const Ingredient = require('../models/Ingredient');

    // 1. Fetch all items (Query 1)
    const items = await MenuItem.find({ isArchived: false }).lean();
    const itemIds = items.map(i => i._id);
    
    // 2. Fetch all related recipes (Query 2)
    const allRecipes = await Recipe.find({ menuItemId: { $in: itemIds } }).lean();
    
    // 3. Extract unique ingredient IDs and fetch them (Query 3)
    const ingredientIds = new Set();
    allRecipes.forEach(r => {
      if (r.ingredients) r.ingredients.forEach(i => ingredientIds.add(i.ingredientId.toString()));
    });
    
    const allIngredients = await Ingredient.find({ _id: { $in: Array.from(ingredientIds) } }).lean();
    const ingredientMap = {};
    allIngredients.forEach(ing => {
      ingredientMap[ing._id.toString()] = ing;
    });

    // 4. Calculate real-time available stock purely in memory (O(1) lookups)
    for (let item of items) {
      const recipes = allRecipes.filter(r => r.menuItemId.toString() === item._id.toString());
      
      const calculateStockForRecipe = (recipe) => {
        if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) return null;
        let maxPortions = Infinity;
        for (let ri of recipe.ingredients) {
          const ing = ingredientMap[ri.ingredientId.toString()];
          if (ing && ri.quantity > 0) {
            let multiplier = 1;
            const recUnit = (ri.unit || '').toLowerCase();
            const purUnit = (ing.purchaseUnit || '').toLowerCase();
            if (recUnit === 'g' && purUnit === 'kg') multiplier = 0.001;
            if (recUnit === 'ml' && purUnit === 'l') multiplier = 0.001;
            if (recUnit === 'kg' && purUnit === 'g') multiplier = 1000;
            if (recUnit === 'l' && purUnit === 'ml') multiplier = 1000;
            
            const reqQty = ri.quantity * multiplier;
            const portions = Math.floor((ing.stockQuantity || 0) / reqQty);
            if (portions < maxPortions) maxPortions = portions;
          } else {
            maxPortions = 0;
          }
        }
        return maxPortions === Infinity ? 0 : Math.max(0, maxPortions);
      };

      if (item.sizes && item.sizes.length > 0) {
        item.calculatedStock = 0; 
        for (let size of item.sizes) {
          const sizeRecipe = recipes.find(r => r.size === size.name) || recipes[0];
          size.calculatedStock = calculateStockForRecipe(sizeRecipe);
          if (size.calculatedStock !== null && size.calculatedStock > item.calculatedStock) {
            item.calculatedStock = size.calculatedStock;
          }
        }
      } else {
        item.calculatedStock = calculateStockForRecipe(recipes[0]);
      }
    }

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST /api/menu
// Owner & Manager only
router.post('/', authenticate, authorize('owner', 'manager'), validateZod(menuSchema), async (req, res) => {
  try {
    const { name, category, price, photoUrl, isAvailable, sizes, modifierGroups } = req.body;
    const newItem = new MenuItem({ name, category, price, photoUrl, isAvailable, sizes, modifierGroups });
    await newItem.save();

    if (req.io) {
      req.io.emit('menu:updated', newItem);
      if (req.publicIo) req.publicIo.emit('menu:updated', newItem);
    }

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/menu/:id
// Owner & Manager only
router.put('/:id', authenticate, authorize('owner', 'manager'), validateZod(menuSchema), async (req, res) => {
  try {
    const { name, category, price, photoUrl, isAvailable, isArchived, sizes, modifierGroups } = req.body;
    
    const updateFields = { name, category, price, photoUrl, isAvailable, isArchived };
    if (sizes !== undefined) updateFields.sizes = sizes;
    if (modifierGroups !== undefined) updateFields.modifierGroups = modifierGroups;

    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    if (!item) return res.status(404).send('Not found');

    if (req.io) {
      req.io.emit('menu:updated', item);
      if (req.publicIo) req.publicIo.emit('menu:updated', item);
    }

    res.json(item);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// GET /api/menu/:id/recipe-costing
// Get costing details for a menu item
router.get('/:id/recipe-costing', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const MenuItem = require('../models/MenuItem');
    const Recipe = require('../models/Recipe');
    const Ingredient = require('../models/Ingredient');

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).send('Not found');

    let targetSize = req.query.size;
    if (!targetSize) {
      targetSize = (item.sizes && item.sizes.length > 0) ? item.sizes[0].name : 'Regular';
    }

    const recipe = await Recipe.findOne({ menuItemId: item._id, size: targetSize }).populate('ingredients.ingredientId');
    
    let cogs = 0;
    const ingredientsBreakdown = [];

    // Helper for unit conversion
    const convertToGramsOrMl = (val, unit) => {
      const u = unit.toLowerCase();
      if (['kg', 'l', 'liter', 'liters'].includes(u)) return val * 1000;
      if (['g', 'ml', 'pcs', 'each'].includes(u)) return val;
      if (['oz', 'ounce', 'ounces'].includes(u)) return val * 28.3495;
      if (['lb', 'lbs', 'pound', 'pounds'].includes(u)) return val * 453.592;
      return val; // Fallback or assume 1:1 if unknown, though ideally we'd throw
    };

    if (recipe && recipe.ingredients) {
      for (const ing of recipe.ingredients) {
        if (!ing.ingredientId) continue;
        const rawItem = ing.ingredientId;
        
        const rawCost = rawItem.movingAverageCost > 0 ? rawItem.movingAverageCost : rawItem.unitCost;
        
        const rawUnit = (rawItem.purchaseUnit || '').toLowerCase();
        const recipeUnit = (ing.unit || '').toLowerCase();
        
        // Calculate cost per base unit (g or ml)
        const rawBaseQty = convertToGramsOrMl(1, rawUnit); 
        const costPerBaseUnit = rawCost / rawBaseQty;
        
        // Calculate total base units needed for recipe
        const recipeBaseQty = convertToGramsOrMl(ing.quantity, recipeUnit);
        
        // Check for completely incompatible units (like weight to volume) as a sanity check if needed,
        // but for now we apply the standard formula.
        const costForQty = costPerBaseUnit * recipeBaseQty;

        cogs += costForQty;
        ingredientsBreakdown.push({
          name: rawItem.name,
          quantity: ing.quantity,
          unit: ing.unit,
          cost: costForQty
        });
      }
    }

    // Find the price for the specific size
    let price = item.price;
    if (item.sizes && item.sizes.length > 0) {
      const sizeObj = item.sizes.find(s => s.name === targetSize);
      if (sizeObj) price = sizeObj.price;
    }
    const marginPercent = price > 0 ? ((price - cogs) / price) * 100 : 0;

    res.json({
      cogs,
      marginPercent,
      ingredientsBreakdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// DELETE /api/menu/:id (Archive)
router.delete('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).send('Not found');
    
    const Recipe = require('../models/Recipe');
    // Remove orphaned recipes to preserve data integrity
    await Recipe.deleteMany({ menuItemId: item._id });
    
    item.isArchived = true;
    await item.save();
    res.json({ message: 'Item archived and recipes removed' });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/menu/:id/toggle-availability
// Cashier can quickly 86 an item
router.put('/:id/toggle-availability', authenticate, async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).send('Not found');
    item.isAvailable = !item.isAvailable;
    await item.save();
    
    // Broadcast update via socket
    if (req.io) {
      req.io.emit('menu:updated', item);
      if (req.publicIo) req.publicIo.emit('menu:updated', item);
    }
    
    res.json(item);
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
    const sizeName = req.query.size;

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).send('Menu item not found');

    let query = { menuItemId: item._id };
    if (sizeName) query.size = sizeName;
    else if (item.sizes && item.sizes.length > 0) query.size = item.sizes[0].name;

    const recipe = await Recipe.findOne(query).populate('ingredients.ingredientId');
    
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
            ingredientId: ri.ingredientId._id,
            name: ri.ingredientId.name,
            quantity: ri.quantity,
            unit: ri.unit,
            cost: costContribution
          });
        }
      }
    }

    const targetPrice = (sizeName && item.sizes) 
      ? (item.sizes.find(s => s.name === sizeName)?.price || item.price)
      : item.price;
      
    const marginPercent = targetPrice > 0 ? ((targetPrice - cogs) / targetPrice) * 100 : 0;

    res.json({
      menuItem: item,
      size: sizeName,
      cogs,
      marginPercent,
      ingredientsBreakdown
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
