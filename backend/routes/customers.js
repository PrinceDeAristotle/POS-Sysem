const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/customers — list with optional search
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    sql += ' ORDER BY name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/customers — register customer
router.post('/',
  body('name').trim().notEmpty(),
  body('phone').optional().trim(),
  body('email').optional().trim().isEmail(),
  body('address').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, phone, email, address } = req.body;
      const [result] = await db.query(
        'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
        [name, phone || null, email || null, address || null]
      );
      res.status(201).json({ customer_id: result.insertId, message: 'Customer registered.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/customers/:id
router.put('/:id',
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('email').optional().trim().isEmail(),
  body('address').optional().trim(),
  body('loyalty_points').optional().isInt({ min: 0 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const allowed = ['name', 'phone', 'email', 'address', 'loyalty_points'];
      const updates = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update.' });

      const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), req.params.id];
      await db.query(`UPDATE customers SET ${setClause} WHERE customer_id = ?`, values);
      res.json({ message: 'Customer updated.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

module.exports = router;
