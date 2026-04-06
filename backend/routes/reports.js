const express = require('express');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [rows] = await db.query(
      `SELECT COUNT(*) AS total_sales, COALESCE(SUM(total_amount), 0) AS total_revenue
       FROM sales WHERE DATE(sale_date) = ?`,
      [date]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/weekly?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/weekly', async (req, res) => {
  try {
    const from = req.query.from || new Date().toISOString().slice(0, 10);
    const to = req.query.to || from;
    const [rows] = await db.query(
      `SELECT DATE(sale_date) AS date, COUNT(*) AS sales_count, SUM(total_amount) AS revenue
       FROM sales WHERE DATE(sale_date) >= ? AND DATE(sale_date) <= ?
       GROUP BY DATE(sale_date) ORDER BY date`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/product-performance?from= &to=
router.get('/product-performance', async (req, res) => {
  try {
    const from = req.query.from || '1970-01-01';
    const to = req.query.to || '9999-12-31';
    const [rows] = await db.query(
      `SELECT p.product_id, p.product_name, SUM(si.quantity) AS units_sold, SUM(si.subtotal) AS revenue
       FROM sales_items si
       JOIN products p ON si.product_id = p.product_id
       JOIN sales s ON si.sale_id = s.sale_id
       WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ?
       GROUP BY p.product_id ORDER BY units_sold DESC`,
      [from, to]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/cashier?user_id= &from= &to=
router.get('/cashier', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const from = req.query.from || '1970-01-01';
    const to = req.query.to || '9999-12-31';
    let sql = `
      SELECT u.user_id, u.username, u.full_name, COUNT(s.sale_id) AS sales_count, COALESCE(SUM(s.total_amount), 0) AS total_revenue
      FROM users u
      LEFT JOIN sales s ON u.user_id = s.user_id AND DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ?
      WHERE u.role IN ('cashier', 'manager', 'admin')
    `;
    const params = [from, to];
    if (userId) { sql += ' AND u.user_id = ?'; params.push(userId); }
    sql += ' GROUP BY u.user_id';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
