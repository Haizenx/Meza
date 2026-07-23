const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Shift = require('../models/Shift');
const jwt = require('jsonwebtoken');

describe('Shifts API', () => {
  let cashierToken;

  beforeEach(async () => {
    const cashier = await User.create({
      name: 'Cashier',
      email: 'cashier@test.com',
      role: 'cashier',
      passwordHash: 'hash'
    });
    cashierToken = jwt.sign({ id: cashier._id, role: cashier.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('POST /api/shifts/start should start a new shift', async () => {
    const res = await request(app)
      .post('/api/shifts/start')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ startingCash: 100 });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('status', 'open');
  });
});
