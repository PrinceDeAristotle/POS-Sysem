-- Seed: run after schema.sql. Sample categories only.
-- For admin user run: node scripts/seed-admin.js (creates admin / admin123)

USE pos_db;

INSERT INTO categories (name) VALUES
('Beverages'),
('Snacks'),
('Dairy'),
('Bakery'),
('General');
