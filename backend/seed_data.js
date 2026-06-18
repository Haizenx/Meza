const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const Ingredient = require('./models/Ingredient');
const Recipe = require('./models/Recipe');
const Order = require('./models/Order');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meza_cafe';

const seedRealisticData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB. Generating expanded realistic cafe data...');

    await MenuItem.deleteMany({});
    await Ingredient.deleteMany({});
    await Recipe.deleteMany({});
    await Order.deleteMany({});
    
    try { await mongoose.connection.collections['recipes'].dropIndexes(); } catch(e) {}
    try { await mongoose.connection.collections['orders'].dropIndexes(); } catch(e) {}
    try { await mongoose.connection.collections['menuitems'].dropIndexes(); } catch(e) {}
    try { await mongoose.connection.collections['ingredients'].dropIndexes(); } catch(e) {}

    // 2. Create Ingredients
    const ingredientsData = [
      { name: 'Coffee Beans', purchaseUnit: 'kg', unitCost: 800, stockQuantity: 15, lowStockThreshold: 3 },
      { name: 'Whole Milk', purchaseUnit: 'l', unitCost: 90, stockQuantity: 30, lowStockThreshold: 5 },
      { name: 'Oat Milk', purchaseUnit: 'l', unitCost: 150, stockQuantity: 10, lowStockThreshold: 2 },
      { name: 'Matcha Powder', purchaseUnit: 'g', unitCost: 5, stockQuantity: 500, lowStockThreshold: 100 },
      { name: 'Vanilla Syrup', purchaseUnit: 'ml', unitCost: 0.5, stockQuantity: 2000, lowStockThreshold: 500 },
      { name: 'Croissant Dough', purchaseUnit: 'pcs', unitCost: 45, stockQuantity: 100, lowStockThreshold: 20 },
      { name: 'Chocolate Chunks', purchaseUnit: 'kg', unitCost: 600, stockQuantity: 5, lowStockThreshold: 1 },
      { name: 'Penne Pasta', purchaseUnit: 'kg', unitCost: 120, stockQuantity: 10, lowStockThreshold: 3 },
      { name: 'Pesto Sauce', purchaseUnit: 'kg', unitCost: 450, stockQuantity: 5, lowStockThreshold: 1 },
      { name: 'Chicken Breast', purchaseUnit: 'kg', unitCost: 280, stockQuantity: 12, lowStockThreshold: 4 },
      { name: 'Sourdough Loaf', purchaseUnit: 'pcs', unitCost: 150, stockQuantity: 15, lowStockThreshold: 3 },
      { name: 'Avocado', purchaseUnit: 'pcs', unitCost: 60, stockQuantity: 30, lowStockThreshold: 10 },
      { name: 'Cheddar Cheese', purchaseUnit: 'kg', unitCost: 550, stockQuantity: 8, lowStockThreshold: 2 },
      { name: 'Romaine Lettuce', purchaseUnit: 'kg', unitCost: 180, stockQuantity: 5, lowStockThreshold: 2 },
      { name: 'Caesar Dressing', purchaseUnit: 'l', unitCost: 350, stockQuantity: 3, lowStockThreshold: 1 }
    ];
    
    const ingredients = await Ingredient.insertMany(ingredientsData);
    const getIngId = (name) => ingredients.find(i => i.name === name)._id;

    // 3. Create Menu Items
    const menuItemsData = [
      { name: 'Cafe Latte', category: 'Drinks', price: 150, stockQuantity: 50, photoUrl: 'https://images.unsplash.com/photo-1570968915860-54d5c3ea8acc?w=800' },
      { name: 'Vanilla Oat Latte', category: 'Drinks', price: 190, stockQuantity: 30, photoUrl: 'https://images.unsplash.com/photo-1551830820-330a71b99659?w=800' },
      { name: 'Americano', category: 'Drinks', price: 130, stockQuantity: 40, photoUrl: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=800' },
      { name: 'Matcha Latte', category: 'Drinks', price: 180, stockQuantity: 20, photoUrl: 'https://images.unsplash.com/photo-1536514072410-5019a3c69182?w=800' },
      
      { name: 'Butter Croissant', category: 'Pastries', price: 120, stockQuantity: 25, photoUrl: 'https://images.unsplash.com/photo-1555507036-ab1f40ce8877?w=800' },
      { name: 'Chocolate Croissant', category: 'Pastries', price: 140, stockQuantity: 15, photoUrl: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=800' },
      
      { name: 'Whole Sourdough Loaf', category: 'Breads', price: 350, stockQuantity: 5, photoUrl: 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?w=800' },
      
      { name: 'Chicken Pesto Pasta', category: 'Meals', price: 280, stockQuantity: 15, photoUrl: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800' },
      { name: 'Avocado Toast', category: 'Meals', price: 220, stockQuantity: 12, photoUrl: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=800' },
      { name: 'Grilled Cheese Sandwich', category: 'Meals', price: 190, stockQuantity: 10, photoUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800' },
      { name: 'Chicken Caesar Salad', category: 'Meals', price: 250, stockQuantity: 8, photoUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=800' }
    ];

    const menuItems = await MenuItem.insertMany(menuItemsData);
    const getMenuId = (name) => menuItems.find(m => m.name === name)._id;

    // 4. Create Recipes
    const recipesData = [
      {
        menuItemId: getMenuId('Cafe Latte'),
        ingredients: [
          { ingredientId: getIngId('Coffee Beans'), quantity: 18, unit: 'g' },
          { ingredientId: getIngId('Whole Milk'), quantity: 200, unit: 'ml' }
        ]
      },
      {
        menuItemId: getMenuId('Vanilla Oat Latte'),
        ingredients: [
          { ingredientId: getIngId('Coffee Beans'), quantity: 18, unit: 'g' },
          { ingredientId: getIngId('Oat Milk'), quantity: 200, unit: 'ml' },
          { ingredientId: getIngId('Vanilla Syrup'), quantity: 15, unit: 'ml' }
        ]
      },
      {
        menuItemId: getMenuId('Matcha Latte'),
        ingredients: [
          { ingredientId: getIngId('Matcha Powder'), quantity: 5, unit: 'g' },
          { ingredientId: getIngId('Whole Milk'), quantity: 200, unit: 'ml' }
        ]
      },
      {
        menuItemId: getMenuId('Butter Croissant'),
        ingredients: [
          { ingredientId: getIngId('Croissant Dough'), quantity: 1, unit: 'pcs' }
        ]
      },
      {
        menuItemId: getMenuId('Chocolate Croissant'),
        ingredients: [
          { ingredientId: getIngId('Croissant Dough'), quantity: 1, unit: 'pcs' },
          { ingredientId: getIngId('Chocolate Chunks'), quantity: 20, unit: 'g' }
        ]
      },
      {
        menuItemId: getMenuId('Chicken Pesto Pasta'),
        ingredients: [
          { ingredientId: getIngId('Penne Pasta'), quantity: 150, unit: 'g' },
          { ingredientId: getIngId('Pesto Sauce'), quantity: 50, unit: 'g' },
          { ingredientId: getIngId('Chicken Breast'), quantity: 100, unit: 'g' }
        ]
      },
      {
        menuItemId: getMenuId('Avocado Toast'),
        ingredients: [
          { ingredientId: getIngId('Sourdough Loaf'), quantity: 0.1, unit: 'pcs' },
          { ingredientId: getIngId('Avocado'), quantity: 1, unit: 'pcs' }
        ]
      },
      {
        menuItemId: getMenuId('Grilled Cheese Sandwich'),
        ingredients: [
          { ingredientId: getIngId('Sourdough Loaf'), quantity: 0.1, unit: 'pcs' },
          { ingredientId: getIngId('Cheddar Cheese'), quantity: 50, unit: 'g' }
        ]
      },
      {
        menuItemId: getMenuId('Chicken Caesar Salad'),
        ingredients: [
          { ingredientId: getIngId('Romaine Lettuce'), quantity: 150, unit: 'g' },
          { ingredientId: getIngId('Chicken Breast'), quantity: 100, unit: 'g' },
          { ingredientId: getIngId('Caesar Dressing'), quantity: 40, unit: 'ml' }
        ]
      }
    ];

    await Recipe.insertMany(recipesData);

    // 5. Generate Orders
    const cashierUser = await User.findOne({ role: 'cashier' });
    const cashierId = cashierUser ? cashierUser._id : null;

    if (!cashierId) {
      console.warn('No cashier found, skipping order generation.');
      process.exit(0);
    }

    const orders = [];
    const now = new Date();
    
    // Generate orders for the past 7 days
    for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
      const isToday = dayOffset === 0;
      const orderCount = isToday ? Math.floor(Math.random() * 15) + 25 : Math.floor(Math.random() * 30) + 40; 

      for (let i = 0; i < orderCount; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - dayOffset);
        date.setHours(7 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0);

        const numItems = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let subtotal = 0;

        for (let j = 0; j < numItems; j++) {
          const randItem = menuItems[Math.floor(Math.random() * menuItems.length)];
          const qty = Math.floor(Math.random() * 2) + 1;
          items.push({
            menuItemId: randItem._id,
            nameAtSale: randItem.name,
            priceAtSale: randItem.price,
            quantity: qty,
            note: ''
          });
          subtotal += (randItem.price * qty);
        }

        const paymentMethod = Math.random() > 0.4 ? 'cash' : (Math.random() > 0.5 ? 'gcash' : 'card');
        const cashTendered = paymentMethod === 'cash' ? subtotal + (Math.floor(Math.random() * 10) * 10) : 0;
        const changeDue = paymentMethod === 'cash' ? cashTendered - subtotal : 0;

        orders.push({
          localUUID: crypto.randomUUID(),
          items,
          subtotal,
          total: subtotal,
          discountAmount: 0,
          paymentMethod,
          cashTendered,
          changeDue,
          cashierId,
          status: 'completed',
          createdAt: date
        });
      }
    }

    await Order.insertMany(orders);
    console.log(`Successfully generated ${menuItems.length} menu items and ${orders.length} historical orders!`);
    
    mongoose.disconnect();
  } catch (err) {
    console.error('Seeding error:', err);
    mongoose.disconnect();
    process.exit(1);
  }
};

seedRealisticData();
