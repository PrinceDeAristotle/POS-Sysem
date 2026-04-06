const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/inventory — low stock alert (products below threshold or quantity < 10)
router.get('/low-stock', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT product_id, product_name, quantity, barcode
       FROM products WHERE quantity < 10 ORDER BY quantity ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/inventory/adjust — stock adjustment (admin/manager)
router.post('/adjust',
  requireRole('admin', 'manager'),
  body('product_id').isInt(),
  body('quantity_delta').isInt(), // positive = add, negative = subtract
  body('reason').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { product_id, quantity_delta } = req.body;
      const [rows] = await db.query('SELECT quantity FROM products WHERE product_id = ?', [product_id]);
      if (!rows.length) return res.status(404).json({ error: 'Product not found.' });

      const newQty = rows[0].quantity + quantity_delta;
      if (newQty < 0) return res.status(400).json({ error: 'Resulting quantity cannot be negative.' });

      await db.query('UPDATE products SET quantity = ? WHERE product_id = ?', [newQty, product_id]);
      res.json({ product_id, new_quantity: newQty, message: 'Stock adjusted.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

module.exports = router;
