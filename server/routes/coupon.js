const express = require('express');
const { getDb, saveDb } = require('../db/database');

const router = express.Router();

// Get coupon details by UUID (public - no auth required)
router.get('/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const db = await getDb();

    const result = await db.exec(
      `SELECT c.uuid, c.amount, c.description, c.currency, c.is_scratched, c.is_redeemed,
              c.customer_name, c.expires_at, c.created_at, c.scratched_at, c.validation_code,
              m.org_name, m.name as merchant_name, m.merchant_number
       FROM coupons c
       JOIN merchants m ON c.merchant_id = m.id
       WHERE c.uuid = ?`,
      [uuid]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Coupon not found or already redeemed' });
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const coupon = {};
    columns.forEach((col, i) => { coupon[col] = values[i]; });

    // Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      // Delete expired coupon
      await db.run('DELETE FROM coupons WHERE uuid = ?', [uuid]);
      saveDb();
      return res.status(410).json({ error: 'This coupon has expired' });
    }

    coupon.is_scratched = !!coupon.is_scratched;
    coupon.is_redeemed = !!coupon.is_redeemed;

    // If not scratched, don't reveal the amount and validation code
    if (!coupon.is_scratched) {
      delete coupon.amount;
      delete coupon.validation_code;
    }

    res.json({ coupon });
  } catch (err) {
    console.error('Get coupon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Scratch a coupon (public - no auth required)
router.post('/:uuid/scratch', async (req, res) => {
  try {
    const { uuid } = req.params;
    const db = await getDb();

    const result = await db.exec(
      `SELECT c.*, m.org_name, m.name as merchant_name, m.merchant_number
       FROM coupons c
       JOIN merchants m ON c.merchant_id = m.id
       WHERE c.uuid = ?`,
      [uuid]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Coupon not found or already redeemed' });
    }

    const columns = result[0].columns;
    const values = result[0].values[0];
    const coupon = {};
    columns.forEach((col, i) => { coupon[col] = values[i]; });

    // Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      await db.run('DELETE FROM coupons WHERE uuid = ?', [uuid]);
      saveDb();
      return res.status(410).json({ error: 'This coupon has expired' });
    }

    // Check if already redeemed
    if (coupon.is_redeemed) {
      return res.status(400).json({ error: 'This coupon has already been redeemed' });
    }

    // Mark as scratched if not already
    if (!coupon.is_scratched) {
      await db.run(
        'UPDATE coupons SET is_scratched = 1, scratched_at = ? WHERE uuid = ?',
        [new Date().toISOString(), uuid]
      );
      saveDb();
    }

    res.json({
      coupon: {
        uuid: coupon.uuid,
        amount: coupon.amount,
        currency: coupon.currency,
        description: coupon.description,
        customer_name: coupon.customer_name,
        org_name: coupon.org_name,
        merchant_name: coupon.merchant_name,
        merchant_number: coupon.merchant_number,
        expires_at: coupon.expires_at,
        created_at: coupon.created_at,
        scratched_at: coupon.scratched_at || new Date().toISOString(),
        validation_code: coupon.validation_code,
        is_scratched: true,
        is_redeemed: false
      }
    });
  } catch (err) {
    console.error('Scratch coupon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
