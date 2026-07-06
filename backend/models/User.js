const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['owner', 'manager', 'cashier'], required: true },
  pinHash: { type: String }, // bcrypt hash, only set for manager/owner
  pinFailedAttempts: { type: Number, default: 0 },
  pinLockedUntil: { type: Date },
  refreshToken: { type: String }, // Stored for revocation — cleared on logout
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
