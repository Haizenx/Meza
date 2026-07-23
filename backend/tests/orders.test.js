const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

describe('Orders API', () => {
  let ownerToken;
  let cashierToken;
  let menuItemId;

  beforeEach(async () => {
    const owner = await User.create({
      name: 'Owner',
      email: 'owner@test.com',
      role: 'owner',
      passwordHash: 'hash'
    });
    
    ownerToken = jwt.sign({ id: owner._id, role: owner.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const cashier = await User.create({
      name: 'Cashier',
      email: 'cashier@test.com',
      role: 'cashier',
      passwordHash: 'hash'
    });
    cashierToken = jwt.sign({ id: cashier._id, role: cashier.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const menuItem = await require('../models/MenuItem').create({
      name: 'Test Item',
      category: 'Drinks',
      price: 10,
      stockQuantity: 100
    });
    menuItemId = menuItem._id.toString();
  });

  it('GET /api/orders should list orders for owner', async () => {
    await Order.create({
      localUUID: crypto.randomUUID(),
      items: [],
      subtotal: 10,
      total: 10,
      paymentMethod: 'cash',
      status: 'completed'
    });

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
  });

  it('POST /api/orders should create a new order as cashier', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        localUUID: crypto.randomUUID(),
        shiftId: '507f1f77bcf86cd799439011',
        items: [{ menuItemId, nameAtSale: 'Test', priceAtSale: 10, quantity: 1 }],
        subtotal: 10,
        total: 10,
        paymentMethod: 'cash'
      });
    
    expect(res.statusCode).toEqual(201);
  });
});
