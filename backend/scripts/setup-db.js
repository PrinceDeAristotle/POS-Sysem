/**
 * Creates pos_db and runs schema.sql + seed.sql.
 * Run from backend folder: node scripts/setup-db.js
 * Requires .env with correct DB_PASSWORD (root password).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || 'pos_db';

async function run() {
  // Connect without database first (to create it)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('Creating database', DB_NAME, '...');
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB_NAME}\``);

  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');

  if (fs.existsSync(schemaPath)) {
    console.log('Running schema.sql ...');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema.replace(/USE\s+pos_db\s*;/i, '').trim();
    await conn.query(schema);
    console.log('Schema applied.');
  }

  if (fs.existsSync(seedPath)) {
    console.log('Running seed.sql ...');
    let seed = fs.readFileSync(seedPath, 'utf8');
    seed = seed.replace(/USE\s+pos_db\s*;/i, '').trim();
    await conn.query(seed);
    console.log('Seed applied.');
  }

  await conn.end();
  console.log('Done. Run: node scripts/seed-admin.js (to create admin user), then npm start');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
