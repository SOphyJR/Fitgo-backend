const router = require('express').Router();
const pool = require('../config/db');

// GET all users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET user by firebase_uid
router.get('/:firebase_uid', async (req, res) => {
  try {
    const { firebase_uid } = req.params;
    const result = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [firebase_uid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create user
router.post('/', async (req, res) => {
  try {
    const { firebase_uid, name, email, phone, role } = req.body;
    const result = await pool.query(
      `INSERT INTO users (firebase_uid, name, email, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (firebase_uid) DO UPDATE SET name=$2, email=$3, phone=$4
       RETURNING *`,
      [firebase_uid, name, email, phone, role, role === 'customer' ? 'active' : 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update user status (approve seller/driver)
// PATCH update store_id
router.patch('/:firebase_uid/store', async (req, res) => {
  try {
    const { firebase_uid } = req.params;
    const { store_id } = req.body;
    const result = await pool.query(
      'UPDATE users SET store_id=$1 WHERE firebase_uid=$2 RETURNING *',
      [store_id, firebase_uid]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// GET user by email
router.get('/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE user
router.delete('/:firebase_uid', async (req, res) => {
  try {
    const { firebase_uid } = req.params;
    await pool.query('DELETE FROM users WHERE firebase_uid = $1', [firebase_uid]);
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;