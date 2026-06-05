const router = require('express').Router();
const pool = require('../config/db');

// GET all products
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT p.*, s.name as store_name 
      FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE p.available = true
    `;
    const params = [];

    if (category && category !== 'All') {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND p.name ILIKE $${params.length}`;
    }
  query += ' ORDER BY p.rating DESC, p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET product by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, s.name as store_name, s.id as store_id
       FROM products p
       JOIN stores s ON p.store_id = s.id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const { store_id, name, description, price, category, image_url, emoji } = req.body;
    const result = await pool.query(
      `INSERT INTO products (store_id, name, description, price, category, image_url, emoji)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [store_id, name, description, price, category, image_url, emoji]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH update product
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, category, image_url, available } = req.body;
    const result = await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, 
       category=$4, image_url=$5, available=$6
       WHERE id=$7 RETURNING *`,
      [name, description, price, category, image_url, available, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;