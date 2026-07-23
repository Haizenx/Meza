const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Ingredient = require('../models/Ingredient');
const jwt = require('jsonwebtoken');

describe('Inventory API', () => {
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

  it('GET /api/inventory should list all ingredients', async () => {
    await Ingredient.create({
      name: 'Coffee Beans',
      purchaseUnit: 'kg',
      unitCost: 10,
      stockQuantity: 100,
      lowStockThreshold: 10
    });

    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
    expect(res.body[0]).toHaveProperty('name', 'Coffee Beans');
  });

  it('POST /api/inventory should create an ingredient', async () => {
    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Milk',
        purchaseUnit: 'L',
        unitCost: 2,
        stockQuantity: 50,
        lowStockThreshold: 5
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('name', 'Milk');
  });
});
