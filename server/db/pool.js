// In production (DATABASE_URL set) → PostgreSQL; otherwise → local SQLite
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => console.error('PostgreSQL pool error:', err));
  module.exports = pool;
} else {
  console.log('ℹ️  No DATABASE_URL — using local SQLite (local.db)');
  module.exports = require('./sqliteAdapter');
}
