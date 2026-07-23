const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const jwt = require('jsonwebtoken');

describe('Menu API', () => {
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

  it('GET /api/menu should list internal menu', async () => {
    await MenuItem.create({
      name: 'Latte',
      category: 'Drinks',
      price: 5,
      stockQuantity: 10
    });

    const res = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
  });

  it('GET /api/menu/public should list public menu', async () => {
    await MenuItem.create({
      name: 'Mocha',
      category: 'Drinks',
      price: 6,
      stockQuantity: 10,
      isAvailable: true
    });

    const res = await request(app).get('/api/menu/public');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
  });
});
