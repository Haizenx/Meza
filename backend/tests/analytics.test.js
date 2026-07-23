const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const jwt = require('jsonwebtoken');

describe('Analytics API', () => {
  let ownerToken;

  beforeEach(async () => {
    const owner = await User.create({
      name: 'Owner',
      email: 'owner@test.com',
      role: 'owner',
      passwordHash: 'hash'
    });
    
    ownerToken = jwt.sign({ id: owner._id, role: owner.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('GET /api/analytics/sales should return sales data', async () => {
    const res = await request(app)
      .get('/api/analytics/sales')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totalRevenue');
  });

  it('GET /api/analytics/dashboard should return dashboard stats', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.today).toHaveProperty('revenue');
    expect(res.body.today).toHaveProperty('orders');
  });
});
