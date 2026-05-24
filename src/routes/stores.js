const router = require('express').Router();
const pool = require('../config/db');

// GET all approved stores
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as owner_name 
       FROM stores s 
       JOIN users u ON s.owner_id = u.id
       WHERE s.status = 'approved'
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET store by id with products
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const store = await pool.query('SELECT * FROM stores WHERE id=$1', [id]);
    const products = await pool.query(
      'SELECT * FROM products WHERE store_id=$1 AND available=true',
      [id]
    );
    if (store.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json({ ...store.rows[0], products: products.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create store
router.post('/', async (req, res) => {
  try {
    const { owner_id, name, description, location, logo_url } = req.body;
    const result = await pool.query(
      `INSERT INTO stores (owner_id, name, description, location, logo_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [owner_id, name, description, location, logo_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH approve store
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE stores SET status='approved' WHERE id=$1 RETURNING *`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;