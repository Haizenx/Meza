const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  // Extract from cookie or Authorization header for fallback (during dev/migration)
  let token = req.cookies?.token;
  
  if (!token && req.header('Authorization')?.startsWith('Bearer ')) {
    token = req.header('Authorization').split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
