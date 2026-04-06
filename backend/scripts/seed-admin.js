require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  const hash = bcrypt.hashSync('admin123', 10);
  await db.query(
    `INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'admin', 'Administrator')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['admin', hash]
  );
  console.log('Admin user ready: username=admin, password=admin123');
  process.exit(0);
}
seed().catch(err => { console.error(err); process.exit(1); });
