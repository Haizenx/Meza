const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const jwt = require('jsonwebtoken');

describe('Recipes API', () => {
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

  it('GET /api/recipes should list recipes for owner', async () => {
    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });
});
