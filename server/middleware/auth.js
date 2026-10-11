const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'coupon-system-secret-key-change-in-production';

// In-memory token blacklist (tokens invalidated on logout)
const tokenBlacklist = new Set();

// Clean up expired tokens from blacklist every 30 minutes
setInterval(() => {
  for (const token of tokenBlacklist) {
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Token expired, remove from blacklist
      tokenBlacklist.delete(token);
    }
  }
}, 30 * 60 * 1000);

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if token has been blacklisted (user logged out)
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.token = token; // Store token reference for logout
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware to check merchant role
function requireMerchant(req, res, next) {
  if (req.user.role !== 'merchant') {
    return res.status(403).json({ error: 'Merchant access required' });
  }
  next();
}

// Generate JWT token
function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Blacklist a token (called on logout)
function blacklistToken(token) {
  tokenBlacklist.add(token);
}

module.exports = { authenticateToken, requireAdmin, requireMerchant, generateToken, blacklistToken };
