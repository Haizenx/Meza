const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/meza_cafe';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    const passwordHash = await bcrypt.hash('password123', 10);
    const ownerPinHash = await bcrypt.hash('1111', 10);
    const managerPinHash = await bcrypt.hash('2222', 10);

    const sampleUsers = [
      {
        name: 'Admin Owner',
        email: 'owner@meza.cafe',
        passwordHash,
        role: 'owner',
        pinHash: ownerPinHash,
        isActive: true
      },
      {
        name: 'Store Manager',
        email: 'manager@meza.cafe',
        passwordHash,
        role: 'manager',
        pinHash: managerPinHash,
        isActive: true
      },
      {
        name: 'Front Cashier',
        email: 'cashier@meza.cafe',
        passwordHash,
        role: 'cashier',
        isActive: true
      }
    ];

    await User.insertMany(sampleUsers);
    console.log('Sample accounts created successfully:');
    console.log('1. owner@meza.cafe | PW: password123 | PIN: 1111');
    console.log('2. manager@meza.cafe | PW: password123 | PIN: 2222');
    console.log('3. cashier@meza.cafe | PW: password123');

    mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding database:', error);
    mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();
