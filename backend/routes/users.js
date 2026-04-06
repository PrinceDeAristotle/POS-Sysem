const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

// GET /api/users — list users (no password)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, username, role, full_name, created_at FROM users ORDER BY role, username'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, username, role, full_name, created_at FROM users WHERE user_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/users — create user
router.post('/',
  body('username').trim().isLength({ min: 2, max: 50 }),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'manager', 'cashier']),
  body('full_name').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { username, password, role, full_name } = req.body;
      const hash = bcrypt.hashSync(password, 10);
      const [result] = await db.query(
        'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
        [username, hash, role, full_name || null]
      );
      res.status(201).json({ user_id: result.insertId, message: 'User created.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username already exists.' });
      }
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// PUT /api/users/:id
router.put('/:id',
  body('username').optional().trim().isLength({ min: 2, max: 50 }),
  body('password').optional().isLength({ min: 6 }),
  body('role').optional().isIn(['admin', 'manager', 'cashier']),
  body('full_name').optional().trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const id = parseInt(req.params.id, 10);
      const updates = {};
      if (req.body.username !== undefined) updates.username = req.body.username;
      if (req.body.role !== undefined) updates.role = req.body.role;
      if (req.body.full_name !== undefined) updates.full_name = req.body.full_name;
      if (req.body.password) updates.password_hash = bcrypt.hashSync(req.body.password, 10);

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
      }

      const [admins] = await db.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
      if (updates.role && updates.role !== 'admin') {
        const [target] = await db.query('SELECT role FROM users WHERE user_id = ?', [id]);
        if (target.length && target[0].role === 'admin' && admins[0].c <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last administrator.' });
        }
      }

      const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), id];
      const [result] = await db.query(`UPDATE users SET ${setClause} WHERE user_id = ?`, values);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
      res.json({ message: 'User updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username already exists.' });
      }
      console.error(err);
      res.status(500).json({ error: 'Server error.' });
    }
  }
);

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    const [target] = await db.query('SELECT role FROM users WHERE user_id = ?', [id]);
    if (!target.length) return res.status(404).json({ error: 'User not found.' });
    if (target[0].role === 'admin') {
      const [admins] = await db.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
      if (admins[0].c <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last administrator.' });
      }
    }
    await db.query('DELETE FROM users WHERE user_id = ?', [id]);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
