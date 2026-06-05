const router = require('express').Router();
const pool = require('../config/db');

// POST report dispute
router.post('/', async (req, res) => {
  try {
    const { order_id, reported_by, reported_against, type, description } = req.body;
    const result = await pool.query(
      `INSERT INTO disputes (order_id, reported_by, reported_against, type, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [order_id, reported_by, reported_against, type, description]
    );

    // Update order status to disputed
    await pool.query(`UPDATE orders SET status = 'disputed' WHERE id = $1`, [order_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all disputes (admin)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, 
        u1.name as reporter_name, u1.email as reporter_email,
        u2.name as accused_name, u2.email as accused_email,
        o.total_amount, o.delivery_address
      FROM disputes d
      LEFT JOIN users u1 ON d.reported_by = u1.id
      LEFT JOIN users u2 ON d.reported_against = u2.id
      LEFT JOIN orders o ON d.order_id = o.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH resolve dispute + punish
router.patch('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, punish_user_id, punishment } = req.body;

    await pool.query(
      `UPDATE disputes SET status = 'resolved', resolution = $1 WHERE id = $2`,
      [resolution, id]
    );

    // Apply punishment if needed
    if (punish_user_id && punishment === 'suspend') {
      await pool.query(`UPDATE users SET status = 'suspended' WHERE id = $1`, [punish_user_id]);
    } else if (punish_user_id && punishment === 'ban') {
      await pool.query(`UPDATE users SET status = 'banned' WHERE id = $1`, [punish_user_id]);
    }

    res.json({ message: 'Dispute resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;