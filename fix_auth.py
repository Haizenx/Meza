import re

with open('/Users/apple/Meza/backend/routes/auth.js', 'r') as f:
    content = f.read()

old_verify = """router.post('/verify-pin', authenticate, authLimiter, [
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
    return res.status(400).json({ message: 'Invalid PIN or too many attempts' });"""

new_verify = """// GET /api/auth/managers
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
    }"""

content = content.replace(old_verify, new_verify, 1)

with open('/Users/apple/Meza/backend/routes/auth.js', 'w') as f:
    f.write(content)
