const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

// Create a new merchant
router.post('/merchants', async (req, res) => {
  try {
    const { merchant_number, org_name, name, email, phone, password, address } = req.body;

    if (!merchant_number || !org_name || !name || !email || !password) {
      return res.status(400).json({ 
        error: 'Required fields: merchant_number, org_name, name, email, password' 
      });
    }

    const db = await getDb();

    // Check if merchant_number or email already exists
    const existingMerchant = db.exec(
      'SELECT id FROM merchants WHERE merchant_number = ? OR email = ?',
      [merchant_number, email]
    );

    if (existingMerchant.length > 0 && existingMerchant[0].values.length > 0) {
      return res.status(409).json({ error: 'Merchant number or email already exists' });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    db.run(
      `INSERT INTO merchants (merchant_number, org_name, name, email, phone, password_hash, address, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [merchant_number, org_name, name, email, phone || null, password_hash, address || null, req.user.id]
    );

    saveDb();

    // Get the created merchant
    const result = db.exec(
      'SELECT id, merchant_number, org_name, name, email, phone, address, is_active, created_at FROM merchants WHERE email = ?',
      [email]
    );

    const columns = result[0].columns;
    const values = result[0].values[0];
    const merchant = {};
    columns.forEach((col, i) => { merchant[col] = values[i]; });

    res.status(201).json({ message: 'Merchant created successfully', merchant });
  } catch (err) {
    console.error('Create merchant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all merchants
router.get('/merchants', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec(
      'SELECT id, merchant_number, org_name, name, email, phone, address, is_active, created_at FROM merchants ORDER BY created_at DESC'
    );

    if (result.length === 0) {
      return res.json({ merchants: [] });
    }

    const columns = result[0].columns;
    const merchants = result[0].values.map(row => {
      const merchant = {};
      columns.forEach((col, i) => { merchant[col] = row[i]; });
      return merchant;
    });

    res.json({ merchants });
  } catch (err) {
    console.error('Get merchants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a merchant
router.put('/merchants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { org_name, name, email, phone, address, password, is_active } = req.body;

    const db = await getDb();

    // Check merchant exists
    const existing = db.exec('SELECT id FROM merchants WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (org_name !== undefined) { updates.push('org_name = ?'); params.push(org_name); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    db.run(`UPDATE merchants SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDb();

    const result = db.exec(
      'SELECT id, merchant_number, org_name, name, email, phone, address, is_active, created_at FROM merchants WHERE id = ?',
      [id]
    );

    const columns = result[0].columns;
    const values = result[0].values[0];
    const merchant = {};
    columns.forEach((col, i) => { merchant[col] = values[i]; });

    res.json({ message: 'Merchant updated successfully', merchant });
  } catch (err) {
    console.error('Update merchant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete (deactivate) a merchant
router.delete('/merchants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const existing = db.exec('SELECT id FROM merchants WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    db.run('UPDATE merchants SET is_active = 0 WHERE id = ?', [id]);
    saveDb();

    res.json({ message: 'Merchant deactivated successfully' });
  } catch (err) {
    console.error('Delete merchant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
