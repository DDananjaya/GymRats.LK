const path = require('path');
const { createClient } = require('@libsql/client');
require('dotenv').config();

const localDbPath = path.join(__dirname, 'gymrats-local.db');
const url = process.env.TURSO_DATABASE_URL || `file:${localDbPath}`;

const config = { url };

if (process.env.TURSO_AUTH_TOKEN) {
    config.authToken = process.env.TURSO_AUTH_TOKEN;
}

if (url.startsWith('file:') && process.env.TURSO_SYNC_URL) {
    config.syncUrl = process.env.TURSO_SYNC_URL;
}

const db = createClient(config);

async function ensureSchema() {
    await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      age INTEGER,
      gender TEXT,
      gym_id TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    await db.execute(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

module.exports = {
    db,
    ensureSchema,
};
