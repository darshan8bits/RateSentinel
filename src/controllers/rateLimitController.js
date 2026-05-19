const pool = require('../config/db');

// Create or update a rate limit rule for an API key
async function setRule(req, res) {
  const userId = req.user.userId;
  const { api_key_id, algorithm, limit_count, window_seconds, capacity, refill_rate } = req.body;

  // Validate algorithm value
  const validAlgorithms = ['fixed', 'sliding', 'token_bucket'];
  if (algorithm && !validAlgorithms.includes(algorithm)) {
    return res.status(400).json({ error: 'Algorithm must be fixed, sliding, or token_bucket' });
  }

  try {
    // Make sure the API key belongs to this user
    const keyCheck = await pool.query(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [api_key_id, userId]
    );

    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Check if a rule already exists for this API key
    const existing = await pool.query(
      'SELECT id FROM rate_limit_rules WHERE api_key_id = $1',
      [api_key_id]
    );

    if (existing.rows.length > 0) {
      // Rule exists — update it
      const result = await pool.query(
        `UPDATE rate_limit_rules
         SET algorithm = COALESCE($1, algorithm),
             limit_count = COALESCE($2, limit_count),
             window_seconds = COALESCE($3, window_seconds),
             capacity = COALESCE($4, capacity),
             refill_rate = COALESCE($5, refill_rate)
         WHERE api_key_id = $6
         RETURNING *`,
        [algorithm, limit_count, window_seconds, capacity, refill_rate, api_key_id]
      );
      return res.json({ message: 'Rule updated', rule: result.rows[0] });
    }

    // No rule exists — create one
    const result = await pool.query(
      `INSERT INTO rate_limit_rules (api_key_id, algorithm, limit_count, window_seconds, capacity, refill_rate)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        api_key_id,
        algorithm || 'fixed',
        limit_count || 60,
        window_seconds || 60,
        capacity || 10,
        refill_rate || 2
      ]
    );
    return res.status(201).json({ message: 'Rule created', rule: result.rows[0] });

  } catch (err) {
    console.error('Set rule error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get the rate limit rule for a specific API key
async function getRule(req, res) {
  const userId = req.user.userId;
  const api_key_id = req.params.api_key_id;

  try {
    // Make sure the API key belongs to this user
    const keyCheck = await pool.query(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [api_key_id, userId]
    );

    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const result = await pool.query(
      'SELECT * FROM rate_limit_rules WHERE api_key_id = $1',
      [api_key_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No rule found for this API key' });
    }

    res.json({ rule: result.rows[0] });

  } catch (err) {
    console.error('Get rule error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { setRule, getRule };