const express = require('express');
const crypto = require('crypto');
const { getDb, saveDb } = require('../db/database');
const { authenticateToken, requireMerchant } = require('../middleware/auth');

const router = express.Router();

// All merchant routes require authentication and merchant role
router.use(authenticateToken, requireMerchant);

// Generate a random 6-digit validation code
function generateValidationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const db = await getDb();
    const merchantId = req.user.id;

    const totalResult = db.exec('SELECT COUNT(*) as count FROM coupons WHERE merchant_id = ?', [merchantId]);
    const activeResult = db.exec('SELECT COUNT(*) as count FROM coupons WHERE merchant_id = ? AND is_redeemed = 0', [merchantId]);
    const scratchedResult = db.exec('SELECT COUNT(*) as count FROM coupons WHERE merchant_id = ? AND is_scratched = 1 AND is_redeemed = 0', [merchantId]);
    const redeemedResult = db.exec('SELECT COUNT(*) as count FROM coupons WHERE merchant_id = ? AND is_redeemed = 1', [merchantId]);
    const totalAmountResult = db.exec('SELECT COALESCE(SUM(amount), 0) as total FROM coupons WHERE merchant_id = ?', [merchantId]);
    const activeAmountResult = db.exec('SELECT COALESCE(SUM(amount), 0) as total FROM coupons WHERE merchant_id = ? AND is_redeemed = 0', [merchantId]);

    const getVal = (result) => (result.length > 0 && result[0].values.length > 0) ? result[0].values[0][0] : 0;

    res.json({
      stats: {
        total_coupons: getVal(totalResult),
        active_coupons: getVal(activeResult),
        scratched_coupons: getVal(scratchedResult),
        redeemed_coupons: getVal(redeemedResult),
        total_amount: getVal(totalAmountResult),
        active_amount: getVal(activeAmountResult)
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new coupon
router.post('/coupons', async (req, res) => {
  try {
    const { amount, description, customer_name, customer_phone, expires_in_days, currency } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const db = await getDb();
    const couponUuid = crypto.randomUUID();
    const validationCode = generateValidationCode();

    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(expires_in_days));
      expiresAt = expiryDate.toISOString();
    }

    db.run(
      `INSERT INTO coupons (uuid, merchant_id, amount, description, currency, customer_name, customer_phone, expires_at, validation_code) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        couponUuid,
        req.user.id,
        parseFloat(amount),
        description || null,
        currency || 'INR',
        customer_name || null,
        customer_phone || null,
        expiresAt,
        validationCode
      ]
    );

    saveDb();

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon: {
        uuid: couponUuid,
        amount: parseFloat(amount),
        description,
        currency: currency || 'INR',
        customer_name,
        customer_phone,
        expires_at: expiresAt,
        validation_code: validationCode,
        is_scratched: false,
        is_redeemed: false,
        created_at: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Create coupon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all coupons for the merchant
router.get('/coupons', async (req, res) => {
  try {
    const db = await getDb();
    const merchantId = req.user.id;

    const result = db.exec(
      `SELECT id, uuid, amount, description, currency, is_scratched, is_redeemed, 
              customer_name, customer_phone, expires_at, created_at, scratched_at, redeemed_at, validation_code 
       FROM coupons WHERE merchant_id = ? ORDER BY created_at DESC`,
      [merchantId]
    );

    if (result.length === 0) {
      return res.json({ coupons: [] });
    }

    const columns = result[0].columns;
    const coupons = result[0].values.map(row => {
      const coupon = {};
      columns.forEach((col, i) => { coupon[col] = row[i]; });
      coupon.is_scratched = !!coupon.is_scratched;
      coupon.is_redeemed = !!coupon.is_redeemed;
      return coupon;
    });

    res.json({ coupons });
  } catch (err) {
    console.error('Get coupons error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate and redeem a coupon
router.post('/coupons/validate', async (req, res) => {
  try {
    const { validation_code, uuid } = req.body;

    if (!validation_code && !uuid) {
      return res.status(400).json({ error: 'Validation code or coupon UUID required' });
    }

    const db = await getDb();
    let query, params;

    if (uuid) {
      query = 'SELECT * FROM coupons WHERE uuid = ? AND merchant_id = ?';
      params = [uuid, req.user.id];
    } else {
      query = 'SELECT * FROM coupons WHERE validation_code = ? AND merchant_id = ?';
      params = [validation_code, req.user.id];
    }

    const result = db.exec(query, params);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Coupon not found or does not belong to your account', valid: false });
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const coupon = {};
    columns.forEach((col, i) => { coupon[col] = values[i]; });

    // Check if already redeemed
    if (coupon.is_redeemed) {
      return res.status(400).json({ error: 'Coupon already redeemed', valid: false });
    }

    // Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      // Delete expired coupon
      db.run('DELETE FROM coupons WHERE id = ?', [coupon.id]);
      saveDb();
      return res.status(400).json({ error: 'Coupon has expired', valid: false });
    }

    // Check if scratched
    if (!coupon.is_scratched) {
      return res.status(400).json({ error: 'Coupon has not been scratched yet', valid: false });
    }

    res.json({
      valid: true,
      coupon: {
        uuid: coupon.uuid,
        amount: coupon.amount,
        currency: coupon.currency,
        description: coupon.description,
        customer_name: coupon.customer_name,
        customer_phone: coupon.customer_phone,
        created_at: coupon.created_at,
        scratched_at: coupon.scratched_at,
        validation_code: coupon.validation_code
      }
    });
  } catch (err) {
    console.error('Validate coupon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Redeem a validated coupon (and delete from DB)
router.post('/coupons/redeem', async (req, res) => {
  try {
    const { uuid } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: 'Coupon UUID required' });
    }

    const db = await getDb();
    const result = db.exec(
      'SELECT * FROM coupons WHERE uuid = ? AND merchant_id = ?',
      [uuid, req.user.id]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const coupon = {};
    columns.forEach((col, i) => { coupon[col] = values[i]; });

    if (coupon.is_redeemed) {
      return res.status(400).json({ error: 'Coupon already redeemed' });
    }

    // Delete the coupon from DB to save memory (as per requirement)
    db.run('DELETE FROM coupons WHERE id = ?', [coupon.id]);
    saveDb();

    res.json({
      message: 'Coupon redeemed and cleared successfully',
      redeemed_coupon: {
        uuid: coupon.uuid,
        amount: coupon.amount,
        currency: coupon.currency,
        description: coupon.description,
        customer_name: coupon.customer_name
      }
    });
  } catch (err) {
    console.error('Redeem coupon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a coupon
router.delete('/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const existing = db.exec('SELECT id FROM coupons WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    db.run('DELETE FROM coupons WHERE id = ? AND merchant_id = ?', [id, req.user.id]);
    saveDb();

    res.json({ message: 'Coupon deleted successfully' });
  } catch (err) {
    console.error('Delete coupon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
