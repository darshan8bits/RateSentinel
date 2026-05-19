const pool = require('../config/db');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Users table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('API keys table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_rules (
        id SERIAL PRIMARY KEY,
        api_key_id INTEGER REFERENCES api_keys(id) ON DELETE CASCADE,
        algorithm VARCHAR(20) NOT NULL DEFAULT 'fixed',
        limit_count INTEGER NOT NULL DEFAULT 60,
        window_seconds INTEGER NOT NULL DEFAULT 60,
        capacity INTEGER NOT NULL DEFAULT 10,
        refill_rate INTEGER NOT NULL DEFAULT 2,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('Rate limit rules table ready');

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();