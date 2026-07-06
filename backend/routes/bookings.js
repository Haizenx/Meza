const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Rate limiter for public booking creation
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 bookings per IP per hour
  message: { message: 'Too many booking requests from this IP. Please try again later.' }
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation Error', errors: errors.array() });
  next();
};

// GET /api/bookings
// Owner & Manager
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).limit(100);
    res.json(bookings);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// PUT /api/bookings/:id/status
// Owner only
router.put('/:id/status', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'declined'].includes(status)) {
      return res.status(400).send('Invalid status');
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!booking) return res.status(404).send('Not found');

    // Here Nodemailer would trigger an email back to booking.email
    console.log(`[EMAIL] Booking ${booking._id} status updated to ${status}. Sending email to ${booking.email}`);

    res.json(booking);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/bookings
// Public endpoint for submitting bookings
router.post('/', bookingLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('contact').trim().notEmpty().withMessage('Contact is required').isLength({ max: 20 }),
  body('date').isISO8601().toDate(),
  body('time').trim().notEmpty(),
  body('guests').isInt({ min: 1, max: 100 }).withMessage('Guests must be between 1 and 100'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message must be under 500 characters'),
  validate
], async (req, res) => {
  try {
    const { name, email, contact, date, time, guests, message } = req.body;
    
    // Prevent booking in the past
    if (new Date(date) < new Date(new Date().setHours(0,0,0,0))) {
      return res.status(400).json({ message: 'Cannot book for a past date' });
    }

    const booking = new Booking({
      name, email, contact, date, time, guests, message
    });
    
    await booking.save();

    // Broadcast to dashboard
    if (req.io) {
      req.io.emit('booking:new', booking);
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
