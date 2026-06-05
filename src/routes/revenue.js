const router = require('express').Router();
const pool = require('../config/db');

// Calculate and record revenue when order is placed
router.post('/calculate', async (req, res) => {
  try {
    const { order_id, store_id, order_total, delivery_fee } = req.body;

    // Get store commission rate
    const storeResult = await pool.query('SELECT commission_rate FROM stores WHERE id = $1', [store_id]);
    const commission_rate = storeResult.rows[0]?.commission_rate || 10.00;
    const commission_amount = (order_total * commission_rate) / 100;
    const fitgo_revenue = commission_amount + (delivery_fee * 0.30);
    const store_payout = order_total - commission_amount;
    const driver_payout = delivery_fee * 0.70;

    await pool.query(
      `INSERT INTO revenue (order_id, store_id, order_total, commission_rate, commission_amount, delivery_fee, fitgo_revenue, store_payout, driver_payout)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [order_id, store_id, order_total, commission_rate, commission_amount, delivery_fee, fitgo_revenue, store_payout, driver_payout]
    );

    res.json({ fitgo_revenue, store_payout, driver_payout, commission_amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET total revenue summary (admin)
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(order_total) as gross_revenue,
        SUM(fitgo_revenue) as fitgo_total,
        SUM(store_payout) as store_payouts,
        SUM(driver_payout) as driver_payouts,
        SUM(commission_amount) as total_commissions
      FROM revenue
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET check if seller/driver trial expired
router.get('/check-trial/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      'SELECT trial_ends_at, registration_fee_paid, role FROM users WHERE id = $1',
      [user_id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const trialExpired = new Date() > new Date(user.trial_ends_at);
    const requiresPayment = (user.role === 'seller' || user.role === 'driver') 
      && trialExpired && !user.registration_fee_paid;

    res.json({ trialExpired, requiresPayment, trial_ends_at: user.trial_ends_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST mark registration fee paid
router.post('/pay-registration/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    await pool.query('UPDATE users SET registration_fee_paid = true WHERE id = $1', [user_id]);
    res.json({ message: 'Registration fee marked as paid' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;