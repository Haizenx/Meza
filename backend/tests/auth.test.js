const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

describe('Auth API', () => {
  const testUser = {
    name: 'Test Owner',
    email: 'owner@test.com',
    password: 'password123',
    role: 'owner',
    pin: '1234'
  };

  let user;

  beforeEach(async () => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(testUser.password, salt);
    const pinHash = await bcrypt.hash(testUser.pin, salt);
    
    user = await User.create({
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
      passwordHash,
      pinHash
    });
  });

  it('POST /api/auth/login should authenticate user and return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('name', testUser.name);
  });

  it('POST /api/auth/login should fail with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    
    expect(res.statusCode).toEqual(400);
  });

  it('GET /api/auth/me should return logged in user profile', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('email', testUser.email);
  });
  
  it('POST /api/auth/verify-pin should verify a valid pin', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    
    const token = loginRes.body.token;

    const res = await request(app)
      .post('/api/auth/verify-pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ managerId: user._id, pin: testUser.pin });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
