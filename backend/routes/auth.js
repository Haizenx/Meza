const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10, // 10 attempts per IP
  message: { message: 'Too many attempts from this IP, please try again after 15 minutes' }
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation error', errors: errors.array() });
  }
  next();
};

// POST /api/auth/login
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !user.isActive) {
      return res.status(400).json({ message: 'Invalid credentials or inactive account' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const payload = {
      id: user._id,
      role: user.role
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Store Refresh Token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ message: 'User inactive' });
    
    const payload = { id: user._id, role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    
    res.json({ message: 'Token refreshed', token: accessToken, user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// POST /api/auth/verify-pin (Rate limited to 10 attempts per 15 mins)
// GET /api/auth/managers
// Returns a safe list of managers for the PIN selection dropdown
router.get('/managers', authenticate, async (req, res) => {
  try {
    const managers = await User.find({ role: { $in: ['manager', 'owner'] }, isActive: true }).select('_id name');
    res.json(managers);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/auth/verify-pin (Rate limited to 10 attempts per 15 mins)
router.post('/verify-pin', authenticate, authLimiter, [
  body('managerId').notEmpty().withMessage('Manager ID is required'),
  body('pin').isString().isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits'),
  validate
], async (req, res) => {
  try {
    const { managerId, pin } = req.body;
    
    const manager = await User.findById(managerId);
    if (!manager || !['manager', 'owner'].includes(manager.role) || !manager.pinHash) {
      return res.status(400).json({ message: 'Invalid manager account' });
    }

    if (manager.pinLockedUntil && manager.pinLockedUntil > new Date()) {
      return res.status(403).json({ message: 'This manager account is temporarily locked due to too many failed PIN attempts.' });
    }
    
    const isMatch = await bcrypt.compare(pin, manager.pinHash);
    
    if (isMatch) {
      manager.pinFailedAttempts = 0;
      manager.pinLockedUntil = null;
      await manager.save();
      return res.json({ success: true, approvedBy: manager._id });
    } else {
      manager.pinFailedAttempts = (manager.pinFailedAttempts || 0) + 1;
      if (manager.pinFailedAttempts >= 5) {
        manager.pinLockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Lock for 10 mins
      }
      await manager.save();
      return res.status(400).json({ message: 'Invalid PIN' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash -pinHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
