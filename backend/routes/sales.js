const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /api/sales — create sale (cart items, discount, payment)
router.post('/',
  body('customer_id').optional().isInt(),
  body('items').isArray({ min: 1 }),
  body('items.*.product_id').isInt(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.price').isFloat({ min: 0 }),
  body('discount_amount').optional().isFloat({ min: 0 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
  body('payment_method').isIn(['cash', 'mobile_money', 'card', 'split']),
  body('payments').optional().isArray(),
  body('notes').optional().trim(),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { customer_id, items, discount_amount = 0, tax_rate = 0, payment_method, payments, notes } = req.body;
      const userId = req.user.userId;

      let subtotalAmount = 0;
      for (const item of items) {
        subtotalAmount += item.price * item.quantity;
      }
      const taxable = Math.max(0, subtotalAmount - discount_amount);
      const taxAmount = Math.max(0, taxable * (tax_rate / 100));
      const totalAmount = taxable + taxAmount;

      await conn.beginTransaction();

      const [saleResult] = await conn.query(
        `INSERT INTO sales (user_id, customer_id, total_amount, discount_amount, tax_amount, payment_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, customer_id || null, totalAmount, discount_amount, taxAmount, payment_method, notes || null]
      );
      const saleId = saleResult.insertId;

      for (const item of items) {
        const subtotal = item.price * item.quantity;
        // Ensure enough stock (prevent negative inventory)
        const [pRows] = await conn.query(
          'SELECT quantity, product_name FROM products WHERE product_id = ? FOR UPDATE',
          [item.product_id]
        );
        if (!pRows.length) {
          throw new Error(`Product not found: ${item.product_id}`);
        }
        if (pRows[0].quantity < item.quantity) {
          const e = new Error(`Insufficient stock for ${pRows[0].product_name}. Available: ${pRows[0].quantity}`);
          e.statusCode = 400;
          throw e;
        }
        await conn.query(
          'INSERT INTO sales_items (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
          [saleId, item.product_id, item.quantity, item.price, subtotal]
        );
        await conn.query(
          'UPDATE products SET quantity = quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }

      const payList = payments && payments.length ? payments : [{ method: payment_method, amount: totalAmount }];
      if (payment_method === 'cash') {
        const cashPay = payList.find(p => (p.method || payment_method) === 'cash');
        if (cashPay && cashPay.cash_received != null) {
          const received = Number(cashPay.cash_received);
          if (Number.isNaN(received) || received < totalAmount) {
            const e = new Error('Cash received is less than the total amount.');
            e.statusCode = 400;
            throw e;
          }
        }
      }
      for (const p of payList) {
        const method = p.method || payment_method;
        const amount = Number(p.amount);
        if (Number.isNaN(amount) || amount < 0) {
          const e = new Error('Invalid payment amount.');
          e.statusCode = 400;
          throw e;
        }
        let changeGiven = 0;
        let reference = p.reference || null;
        if (method === 'cash' && p.cash_received != null) {
          const received = Number(p.cash_received);
          changeGiven = Math.max(0, received - totalAmount);
        }
        await conn.query(
          'INSERT INTO payments (sale_id, method, amount, change_given, reference) VALUES (?, ?, ?, ?, ?)',
          [saleId, method, amount, changeGiven, reference]
        );
      }

      await conn.commit();
      conn.release();
      res.status(201).json({ sale_id: saleId, total_amount: totalAmount, message: 'Sale completed.' });
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error(err);
      res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Server error.' });
    }
  }
);

// GET /api/sales — list sales (date range optional)
router.get('/', async (req, res) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;
    let sql = `
      SELECT s.*, u.username, u.full_name,
             c.name AS customer_name
      FROM sales s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      WHERE 1=1
    `;
    const params = [];
    if (from) { sql += ' AND s.sale_date >= ?'; params.push(from); }
    if (to) { sql += ' AND s.sale_date <= ?'; params.push(to); }
    sql += ' ORDER BY s.sale_date DESC LIMIT 500';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/sales/:id — single sale with items (for receipt)
router.get('/:id', async (req, res) => {
  try {
    const [sales] = await db.query(
      `SELECT s.*, u.username, u.full_name, c.name AS customer_name, c.phone AS customer_phone
       FROM sales s JOIN users u ON s.user_id = u.user_id
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       WHERE s.sale_id = ?`,
      [req.params.id]
    );
    if (!sales.length) return res.status(404).json({ error: 'Sale not found.' });

    const [items] = await db.query(
      `SELECT si.*, p.product_name, p.barcode FROM sales_items si
       JOIN products p ON si.product_id = p.product_id
       WHERE si.sale_id = ?`,
      [req.params.id]
    );
    const [payRows] = await db.query(
      'SELECT method, amount, change_given, reference FROM payments WHERE sale_id = ?',
      [req.params.id]
    );
    res.json({ ...sales[0], items, payments: payRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
