import re

with open('/Users/apple/Meza/backend/routes/orders.js', 'r') as f:
    content = f.read()

old_void = """router.put('/:id/void', authenticate, async (req, res) => {
  try {
    const { voidReason, managerPin } = req.body;
    
    // Authenticate manager via PIN
    if (!managerPin) return res.status(400).json({ message: 'Manager PIN is required to authorize void.' });
    
    const managers = await User.find({ role: { $in: ['manager', 'owner'] }, pinHash: { $exists: true } });
    let authorizedManager = null;
    for (let m of managers) {
      if (await bcrypt.compare(managerPin, m.pinHash)) {
        authorizedManager = m;
        break;
      }
    }
    
    if (!authorizedManager) {
      return res.status(403).json({ message: 'Invalid Manager PIN' });
    }"""

new_void = """router.put('/:id/void', authenticate, async (req, res) => {
  try {
    const { voidReason, managerPin, managerId } = req.body;
    
    if (!managerPin || !managerId) return res.status(400).json({ message: 'Manager PIN and ID are required to authorize void.' });
    
    const authorizedManager = await User.findById(managerId);
    if (!authorizedManager || !['manager', 'owner'].includes(authorizedManager.role) || !authorizedManager.pinHash) {
      return res.status(400).json({ message: 'Invalid manager account' });
    }

    if (authorizedManager.pinLockedUntil && authorizedManager.pinLockedUntil > new Date()) {
      return res.status(403).json({ message: 'This manager account is temporarily locked.' });
    }

    const isMatch = await bcrypt.compare(managerPin, authorizedManager.pinHash);
    
    if (isMatch) {
      authorizedManager.pinFailedAttempts = 0;
      authorizedManager.pinLockedUntil = null;
      await authorizedManager.save();
    } else {
      authorizedManager.pinFailedAttempts = (authorizedManager.pinFailedAttempts || 0) + 1;
      if (authorizedManager.pinFailedAttempts >= 5) {
        authorizedManager.pinLockedUntil = new Date(Date.now() + 10 * 60 * 1000); // Lock for 10 mins
      }
      await authorizedManager.save();
      return res.status(403).json({ message: 'Invalid Manager PIN' });
    }"""

content = content.replace(old_void, new_void, 1)

with open('/Users/apple/Meza/backend/routes/orders.js', 'w') as f:
    f.write(content)
