const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Users API', () => {
  let ownerToken;
  let ownerId;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    
    const owner = await User.create({
      name: 'Owner',
      email: 'owner@test.com',
      role: 'owner',
      passwordHash
    });
    
    ownerId = owner._id;
    ownerToken = jwt.sign({ id: owner._id, role: owner.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('GET /api/users should list all users for owner', async () => {
    await User.create({
      name: 'Cashier 1',
      email: 'cashier@test.com',
      role: 'cashier',
      passwordHash: 'hash'
    });

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(2); // Owner + Cashier
  });

  it('POST /api/users should create a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'New Cashier',
        email: 'newcashier@test.com',
        role: 'cashier',
        password: 'password123'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('name', 'New Cashier');
  });

  it('PUT /api/users/profile should update my own profile', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Owner Updated'
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('name', 'Owner Updated');
  });
});
