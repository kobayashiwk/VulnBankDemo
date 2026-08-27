'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');
const { hashPassword } = require('./password');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const db = new DatabaseSync(config.databasePath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      is_verified INTEGER NOT NULL DEFAULT 1,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      daily_limit_cents INTEGER NOT NULL DEFAULT 20000000,
      government_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      to_user_id INTEGER NOT NULL REFERENCES users(id),
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      memo TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      internal_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      credit_cents INTEGER NOT NULL CHECK(credit_cents > 0),
      redeemed_by INTEGER REFERENCES users(id),
      redeemed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (row.count === 0) seedDatabase();
}

function seedDatabase() {
  const insert = db.prepare(`INSERT INTO users
    (username, password_hash, full_name, email, role, is_verified, balance_cents, daily_limit_cents, government_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run('alice', hashPassword('Spring2026!'), 'Alice Tanaka', 'alice@asteria.local', 'customer', 1, 25000000, 10000000, 'JP-A1-834921');
  insert.run('bob', hashPassword('River2026!'), 'Bob Suzuki', 'bob@asteria.local', 'customer', 1, 8000000, 5000000, 'JP-B7-441205');
  insert.run('ops', hashPassword('Operations2026!'), 'Morgan Ito', 'ops@asteria.local', 'operations', 1, 1000000, 1000000, 'JP-O9-772104');
  db.prepare('INSERT INTO transactions (reference, from_user_id, to_user_id, amount_cents, memo) VALUES (?, ?, ?, ?, ?)')
    .run('AST-SEED-001', 2, 1, 1200000, 'August rent');
  db.prepare('INSERT INTO coupons (code, credit_cents) VALUES (?, ?)').run('ASTERIA-WELCOME', 250000);
  db.prepare('INSERT INTO support_tickets (user_id, subject, message, internal_note) VALUES (?, ?, ?, ?)')
    .run(2, 'International transfer', 'Please confirm the expected processing time.', 'Verify enhanced due diligence before responding.');
  logActivity(1, 'account.opened', 'Everyday account activated');
}

function resetDatabase() {
  db.exec(`DELETE FROM audit_log; DELETE FROM support_tickets; DELETE FROM transactions; DELETE FROM coupons; DELETE FROM users; DELETE FROM sqlite_sequence;`);
  seedDatabase();
}

function logActivity(userId, action, details = '') {
  db.prepare('INSERT INTO audit_log (actor_user_id, action, details) VALUES (?, ?, ?)').run(userId || null, action, details);
}

initializeDatabase();

module.exports = { db, initializeDatabase, resetDatabase, logActivity };
