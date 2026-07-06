const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', errors: errors.array() });
  next();
};

// Get all users (Admin/Manager only)
router.get('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash -pinHash');
    res.json(users);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Create a new user (Owner only)
router.post('/', authenticate, authorize('owner'), [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').isIn(['cashier', 'manager', 'owner']),
  body('pin').optional().isString().isLength({ min: 4, max: 6 }).withMessage('PIN must be 4-6 digits'),
  validate
], async (req, res) => {
  try {
    const { name, email, password, role, pin } = req.body;
    
    if (role === 'owner') {
      return res.status(403).json({ message: 'Owner accounts cannot create other owners for security reasons.' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    let pinHash;
    if (pin && (role === 'manager' || role === 'owner')) {
      pinHash = await bcrypt.hash(pin, salt);
    }

    user = new User({
      name,
      email,
      passwordHash,
      pinHash,
      role
    });

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.passwordHash;
    delete userResponse.pinHash;
    res.status(201).json(userResponse);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update own profile (Any authenticated user)
router.put('/profile', authenticate, [
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  validate
], async (req, res) => {
  try {
    const { name, email, password, pin, currentPassword } = req.body;
    
    // req.user.id comes from the authenticate middleware
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Require current password for sensitive changes
    if (email || password || pin) {
      if (!currentPassword) {
        return res.status(401).json({ message: 'Current password is required to change sensitive profile details' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect current password' });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    if (pin && (user.role === 'manager' || user.role === 'owner')) {
      const salt = await bcrypt.genSalt(10);
      user.pinHash = await bcrypt.hash(pin, salt);
    }

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.passwordHash;
    delete userResponse.pinHash;
    
    res.json(userResponse);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update user (Owner only)
router.put('/:id', authenticate, authorize('owner'), [
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['cashier', 'manager', 'owner']),
  validate
], async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    
    // Explicitly forbidding admins from setting plaintext passwords/pins 
    // They must trigger a secure reset flow instead of manually backdooring accounts
    if (user.role === 'cashier') {
      user.pinHash = undefined;
    }

    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.passwordHash;
    delete userResponse.pinHash;
    
    res.json(userResponse);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
