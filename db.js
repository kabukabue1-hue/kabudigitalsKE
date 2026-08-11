const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const databasePath = process.env.DB_PATH || path.join(__dirname, 'data', 'kabu.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, company TEXT, email TEXT NOT NULL, phone TEXT,
    service TEXT NOT NULL, budget TEXT NOT NULL, details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@kabudigitals.local').toLowerCase().trim();
  if (!db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email)) {
    db.prepare('INSERT INTO admin_users (email, name, password_hash) VALUES (?, ?, ?)')
      .run(email, process.env.ADMIN_NAME || 'KABU Admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 12));
    console.log(`Admin created for ${email}. Set ADMIN_EMAIL and ADMIN_PASSWORD before deployment.`);
  }
}

module.exports = db;
module.exports.ensureAdmin = ensureAdmin;