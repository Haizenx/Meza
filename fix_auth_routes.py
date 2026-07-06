import re

with open('/Users/apple/Meza/backend/routes/auth.js', 'r') as f:
    content = f.read()

old_login = """    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });

    // Store JWT in httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });

    res.json({
      token,"""

new_login = """    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Store Refresh Token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      token: accessToken,"""

content = content.replace(old_login, new_login, 1)

old_logout = """// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});"""

new_logout = """// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});"""

content = content.replace(old_logout, new_logout, 1)


old_refresh = """// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isActive) return res.status(401).json({ message: 'User inactive' });
    
    const payload = { id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000
    });
    
    res.json({ message: 'Token refreshed', token, user: { id: user._id, role: user.role, name: user.name } });
  } catch (err) {
    res.status(500).send('Server error');
  }
});"""

new_refresh = """// POST /api/auth/refresh
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
});"""

content = content.replace(old_refresh, new_refresh, 1)

with open('/Users/apple/Meza/backend/routes/auth.js', 'w') as f:
    f.write(content)
