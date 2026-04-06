const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login',
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const [rows] = await db.query(
        'SELECT user_id, username, password_hash, role, full_name FROM users WHERE username = ?',
        [req.body.username]
      );
      if (!rows.length) return res.status(401).json({ error: 'Invalid username or password.' });

      const user = rows[0];
      const valid = await bcrypt.compare(req.body.password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({
        token,
        user: { id: user.user_id, username: user.username, role: user.role, fullName: user.full_name },
      });
    } catch (err) {
      console.error('Login error:', err.message || err);
      let message = 'Server error.';
      if (err.code === 'ECONNREFUSED') message = 'Database connection refused. Is MySQL running?';
      else if (err.code === 'ER_ACCESS_DENIED_ERROR') message = 'Database access denied. Check DB_USER and DB_PASSWORD in .env';
      else if (err.code === 'ER_BAD_DB_ERROR') message = 'Database not found. Create the database and run schema.sql';
      else if (err.code === 'ER_NO_SUCH_TABLE') message = 'Users table missing. Run backend/database/schema.sql';
      res.status(500).json({ error: message });
    }
  }
);

// GET /api/auth/me (current user)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT user_id, username, role, full_name FROM users WHERE user_id = ?',
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
