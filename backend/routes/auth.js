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

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    // Store JWT in httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    res.json({
      token,
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
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) return res.status(401).json({ message: 'User inactive' });
    
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000
    });
    
    res.json({ message: 'Token refreshed', token, user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST /api/auth/verify-pin (Rate limited to 10 attempts per 15 mins)
router.post('/verify-pin', authenticate, authLimiter, [
  body('pin').isString().isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits'),
  validate
], async (req, res) => {
  try {
    const { pin } = req.body;
    
    // We check the PIN against the current user, or an admin/manager overriding?
    // The prompt says "Manager PIN security... lock after 5 failed attempts".
    // Wait, typically the cashier enters the manager's PIN, not their own. 
    // Let's find any user with role 'manager' or 'owner' whose PIN matches.
    // However, rate limiting should ideally be by the user requesting or the PIN itself? 
    // Let's find all managers/owners and check the PIN. Since PIN is hashed, we have to fetch them all.
    // That's inefficient. Instead, maybe the cashier selects the manager, OR we just check all managers.
    // Let's assume the cashier provides the PIN, and we check all users with pinHash.
    
    const privilegedUsers = await User.find({ role: { $in: ['manager', 'owner'] }, pinHash: { $exists: true, $ne: null } });
    
    let matchedUser = null;
    let lockedUser = null;

    for (let pUser of privilegedUsers) {
      if (pUser.pinLockedUntil && pUser.pinLockedUntil > new Date()) {
        lockedUser = pUser;
        continue;
      }
      
      const isMatch = await bcrypt.compare(pin, pUser.pinHash);
      if (isMatch) {
        matchedUser = pUser;
        break;
      } else {
        // Increment attempts
        pUser.pinFailedAttempts += 1;
        if (pUser.pinFailedAttempts >= 5) {
          pUser.pinLockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Lock for 10 mins
        }
        await pUser.save();
      }
    }

    if (matchedUser) {
      // Reset attempts on success
      matchedUser.pinFailedAttempts = 0;
      matchedUser.pinLockedUntil = null;
      await matchedUser.save();
      return res.json({ success: true, approvedBy: matchedUser._id });
    }

    // Generic error
    return res.status(400).json({ message: 'Invalid PIN or too many attempts' });
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
