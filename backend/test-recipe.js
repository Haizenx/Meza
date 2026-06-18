const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });

async function test() {
  await mongoose.connect('mongodb://localhost:27017/meza_cafe');
  const User = require('./models/User');
  const MenuItem = require('./models/MenuItem');
  
  const user = await User.findOne({ role: 'owner' });
  if (!user) { console.log('No owner found'); return; }
  
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'meza_secret_key');
  
  const item = await MenuItem.findOne();
  if (!item) { console.log('No menu item found'); return; }
  
  console.log(`Fetching recipe for item: ${item.name} (${item._id})`);
  
  const res = await fetch(`http://localhost:5001/api/inventory/recipe/${item._id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);
  
  process.exit(0);
}
test();
