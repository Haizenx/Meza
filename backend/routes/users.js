const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

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
router.post('/', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { name, email, password, role, pin } = req.body;
    
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
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email, password, pin } = req.body;
    
    // req.user.id comes from the authenticate middleware
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

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
router.put('/:id', authenticate, authorize('owner'), async (req, res) => {
  try {
    const { name, email, role, isActive, password, pin } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    if (pin && (user.role === 'manager' || user.role === 'owner')) {
      const salt = await bcrypt.genSalt(10);
      user.pinHash = await bcrypt.hash(pin, salt);
    } else if (user.role === 'cashier') {
      user.pinHash = undefined; // Cashiers don't have PINs
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
