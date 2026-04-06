const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/products — list with optional search & category
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const categoryId = req.query.category_id || null;
    let sql = `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE 1=1
    `;
    const params = [];
    if (search) {
      sql += ' AND (p.product_name LIKE ? OR p.barcode = ?)';
      params.push(`%${search}%`, search);
    }
    if (categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    sql += ' ORDER BY p.product_name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.category_id WHERE p.barcode = ?',
      [req.params.barcode]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.category_id WHERE p.product_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/products — add product (admin/manager)
router.post('/',
  requireRole('admin', 'manager'),
  body('product_name').trim().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('barcode').optional().trim(),
  body('category_id').optional().isInt(),
  body('supplier').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { product_name, category_id, price, quantity = 0, barcode, supplier } = req.body;
      const [result] = await db.query(
        'INSERT INTO products (product_name, category_id, price, quantity, barcode, supplier) VALUES (?, ?, ?, ?, ?, ?)',
        [product_name, category_id || null, price, quantity, barcode || null, supplier || null]
      );
      res.status(201).json({ product_id: result.insertId, message: 'Product added.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/products/:id — update product
router.put('/:id',
  requireRole('admin', 'manager'),
  body('product_name').optional().trim().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('barcode').optional().trim(),
  body('category_id').optional().isInt(),
  body('supplier').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const allowed = ['product_name', 'category_id', 'price', 'quantity', 'barcode', 'supplier'];
      const updates = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update.' });

      const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), req.params.id];
      await db.query(`UPDATE products SET ${setClause} WHERE product_id = ?`, values);
      res.json({ message: 'Product updated.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/products/:id
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  } catch (err) {
    console.error('Delete product:', err.code || err.message, err.sqlMessage || '');
    // MySQL: product referenced by sales_items (past sales) — FK blocks delete
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(409).json({
        error:
          'Cannot delete this product because it appears on past sales. Set stock to 0 or archive it instead, or remove sale history in the database.',
      });
    }
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
