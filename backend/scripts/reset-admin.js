/**
 * Creates or resets the admin user to: username=admin, password=admin123
 * Run from backend folder: node scripts/reset-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function run() {
  const hash = bcrypt.hashSync('admin123', 10);
  await db.query(
    `INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'admin', 'Administrator')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
    ['admin', hash]
  );
  console.log('');
  console.log('  Login with these EXACT credentials:');
  console.log('  Username:  admin');
  console.log('  Password:  admin123');
  console.log('  (Username is the word "admin", not your email.)');
  console.log('');
  process.exit(0);
}
run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
