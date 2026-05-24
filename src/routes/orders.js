const router = require('express').Router();
const pool = require('../config/db');

// GET orders by customer
router.get('/customer/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    const result = await pool.query(
      `SELECT o.*, s.name as store_name 
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       WHERE o.customer_id = $1
       ORDER BY o.created_at DESC`,
      [customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET orders by store
router.get('/store/:store_id', async (req, res) => {
  try {
    const { store_id } = req.params;
    const result = await pool.query(
      `SELECT o.*, u.name as customer_name, u.phone as customer_phone
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       WHERE o.store_id = $1
       ORDER BY o.created_at DESC`,
      [store_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
    const items = await pool.query(
      `SELECT oi.*, p.name as product_name, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create order
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, store_id, items, total_amount, delivery_address, delivery_phone, payment_method } = req.body;

    // create order
    const order = await client.query(
      `INSERT INTO orders (customer_id, store_id, total_amount, delivery_address, delivery_phone, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customer_id, store_id, total_amount, delivery_address, delivery_phone, payment_method]
    );

    // create order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, size, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.rows[0].id, item.product_id, item.quantity, item.size, item.price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(order.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;