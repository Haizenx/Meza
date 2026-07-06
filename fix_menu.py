import re

with open('/Users/apple/Meza/backend/routes/menu.js', 'r') as f:
    content = f.read()

old_menu = """// GET /api/menu
// Accessible by all authenticated roles
router.get('/', authenticate, async (req, res) => {
  try {
    const Recipe = require('../models/Recipe');
    const Ingredient = require('../models/Ingredient');

    const items = await MenuItem.find({ isArchived: false }).lean();
    
    // Calculate real-time available stock
    for (let item of items) {
      const recipes = await Recipe.find({ menuItemId: item._id }).lean();
      
      const calculateStockForRecipe = async (recipe) => {
        if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) return null;
        let maxPortions = Infinity;
        for (let ri of recipe.ingredients) {
          const ing = await Ingredient.findById(ri.ingredientId).lean();
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
        // Calculate stock for each size
        item.calculatedStock = 0; // Total stock could be max or 0, but usually we just want it per size
        for (let size of item.sizes) {
          const sizeRecipe = recipes.find(r => r.size === size.name) || recipes[0];
          size.calculatedStock = await calculateStockForRecipe(sizeRecipe);
          // Set base item calculated stock to the sum or max? 
          // Let's set the base calculatedStock to the maximum available among sizes so it shows "Available" if at least one size is.
          if (size.calculatedStock !== null && size.calculatedStock > item.calculatedStock) {
            item.calculatedStock = size.calculatedStock;
          }
        }
      } else {
        // No sizes, just calculate for the first recipe
        item.calculatedStock = await calculateStockForRecipe(recipes[0]);
      }
    }

    res.json(items);
  } catch (err) {
    res.status(500).send('Server error');
  }
});"""

new_menu = """// GET /api/menu
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
});"""

if old_menu in content:
    content = content.replace(old_menu, new_menu, 1)
    with open('/Users/apple/Meza/backend/routes/menu.js', 'w') as f:
        f.write(content)
    print("Successfully replaced menu query.")
else:
    print("Could not find old_menu block in file.")

