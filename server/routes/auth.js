const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { generateToken, blacklistToken, authenticateToken } = require('../middleware/auth');
const { validateFields, patterns } = require('../middleware/sanitize');

const router = express.Router();

// Helper to convert sql.js result to object
function rowToObj(result) {
  if (!result || result.length === 0 || result[0].values.length === 0) return null;
  const columns = result[0].columns;
  const values = result[0].values[0];
  const obj = {};
  columns.forEach((col, i) => { obj[col] = values[i]; });
  return obj;
}

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = await getDb();
    const result = await db.exec('SELECT * FROM admins WHERE username = ?', [username]);
    const admin = rowToObj(result);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: admin.id, username: admin.username, role: 'admin' }, '8h');

    res.json({
      token,
      user: { id: admin.id, username: admin.username, role: 'admin' }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Merchant login
router.post('/merchant/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await getDb();
    const result = await db.exec('SELECT * FROM merchants WHERE email = ? AND is_active = 1', [email]);
    const merchant = rowToObj(result);

    if (!merchant) {
      return res.status(401).json({ error: 'Invalid credentials or account deactivated' });
    }

    const validPassword = bcrypt.compareSync(password, merchant.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({
      id: merchant.id,
      email: merchant.email,
      merchant_number: merchant.merchant_number,
      org_name: merchant.org_name,
      name: merchant.name,
      role: 'merchant'
    }, '24h');

    res.json({
      token,
      user: {
        id: merchant.id,
        email: merchant.email,
        merchant_number: merchant.merchant_number,
        org_name: merchant.org_name,
        name: merchant.name,
        role: 'merchant'
      }
    });
  } catch (err) {
    console.error('Merchant login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (blacklist the current token)
router.post('/logout', authenticateToken, (req, res) => {
  try {
    blacklistToken(req.token);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
