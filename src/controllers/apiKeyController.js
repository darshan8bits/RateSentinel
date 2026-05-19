const crypto = require('crypto');
const pool = require('../config/db');

async function generateKey(req, res) {
  const userId = req.user.userId;

  try {
    const key = 'rs_' + crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      'INSERT INTO api_keys (user_id, key) VALUES ($1, $2) RETURNING id, key, created_at',
      [userId, key]
    );

    res.status(201).json({ message: 'API key generated', apiKey: result.rows[0] });

  } catch (err) {
    console.error('Generate key error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listKeys(req, res) {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      'SELECT id, key, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ apiKeys: result.rows });

  } catch (err) {
    console.error('List keys error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteKey(req, res) {
  const userId = req.user.userId;
  const keyId = req.params.id;

  try {
    const result = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id',
      [keyId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key deleted' });

  } catch (err) {
    console.error('Delete key error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { generateKey, listKeys, deleteKey };