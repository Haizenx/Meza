const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/bookings
// Owner & Manager
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
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

module.exports = router;
