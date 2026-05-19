const redis = require('../config/redis');
const pool = require('../config/db');
const { broadcast } = require('../websocket');

// ─── Helper: fetch API key record and its rate limit rule ────────────────────

async function getKeyAndRule(apiKey) {
  const keyResult = await pool.query(
    'SELECT id FROM api_keys WHERE key = $1',
    [apiKey]
  );

  if (keyResult.rows.length === 0) {
    return null;
  }

  const apiKeyId = keyResult.rows[0].id;

  const ruleResult = await pool.query(
    'SELECT * FROM rate_limit_rules WHERE api_key_id = $1',
    [apiKeyId]
  );

  const rule = ruleResult.rows.length > 0 ? ruleResult.rows[0] : {
    algorithm: 'fixed',
    limit_count: 60,
    window_seconds: 60,
    capacity: 10,
    refill_rate: 2
  };

  return { apiKeyId, rule };
}

// ─── Algorithm 1: Fixed Window ───────────────────────────────────────────────

async function fixedWindow(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  let keyData;
  try {
    keyData = await getKeyAndRule(apiKey);
  } catch (err) {
    console.error('Rate limiter DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const { rule } = keyData;
  const LIMIT = rule.limit_count;
  const WINDOW = rule.window_seconds;

  const redisKey = `fixed:${apiKey}`;

  try {
    const current = await redis.get(redisKey);
    const count = parseInt(current) || 0;

    if (count >= LIMIT) {
      broadcast({ apiKey, algorithm: 'fixed-window', status: 'blocked', timestamp: new Date().toISOString() });
      return res.status(429).json({
        error: 'Rate limit exceeded',
        algorithm: 'fixed-window',
        limit: LIMIT,
        window_seconds: WINDOW,
        message: `Max ${LIMIT} requests per ${WINDOW} seconds`
      });
    }

    if (count === 0) {
      await redis.set(redisKey, 1, 'EX', WINDOW);
    } else {
      await redis.incr(redisKey);
    }

    res.setHeader('X-RateLimit-Limit', LIMIT);
    res.setHeader('X-RateLimit-Remaining', LIMIT - count - 1);

    broadcast({ apiKey, algorithm: 'fixed-window', status: 'allowed', timestamp: new Date().toISOString() });
    next();

  } catch (err) {
    console.error('Rate limiter Redis error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Algorithm 2: Sliding Window ─────────────────────────────────────────────

async function slidingWindow(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  let keyData;
  try {
    keyData = await getKeyAndRule(apiKey);
  } catch (err) {
    console.error('Rate limiter DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const { rule } = keyData;
  const LIMIT = rule.limit_count;
  const WINDOW = rule.window_seconds;

  const redisKey = `sliding:${apiKey}`;
  const now = Date.now();
  const windowStart = now - WINDOW * 1000;

  try {
    await redis.zremrangebyscore(redisKey, '-inf', windowStart);
    const count = await redis.zcard(redisKey);

    if (count >= LIMIT) {
      broadcast({ apiKey, algorithm: 'sliding-window', status: 'blocked', timestamp: new Date().toISOString() });
      return res.status(429).json({
        error: 'Rate limit exceeded',
        algorithm: 'sliding-window',
        limit: LIMIT,
        window_seconds: WINDOW,
        message: `Max ${LIMIT} requests per ${WINDOW} seconds`
      });
    }

    await redis.zadd(redisKey, now, `${now}-${Math.random()}`);
    await redis.expire(redisKey, WINDOW);

    res.setHeader('X-RateLimit-Limit', LIMIT);
    res.setHeader('X-RateLimit-Remaining', LIMIT - count - 1);

    broadcast({ apiKey, algorithm: 'sliding-window', status: 'allowed', timestamp: new Date().toISOString() });
    next();

  } catch (err) {
    console.error('Rate limiter Redis error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Algorithm 3: Token Bucket ────────────────────────────────────────────────

async function tokenBucket(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  let keyData;
  try {
    keyData = await getKeyAndRule(apiKey);
  } catch (err) {
    console.error('Rate limiter DB error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const { rule } = keyData;
  const CAPACITY = rule.capacity;
  const REFILL_RATE = rule.refill_rate;

  const tokensKey = `token_bucket:tokens:${apiKey}`;
  const lastRefillKey = `token_bucket:last_refill:${apiKey}`;

  try {
    const now = Date.now();
    const storedTokens = await redis.get(tokensKey);
    const storedLastRefill = await redis.get(lastRefillKey);

    let tokens = storedTokens !== null ? parseFloat(storedTokens) : CAPACITY;
    let lastRefill = storedLastRefill !== null ? parseInt(storedLastRefill) : now;

    const elapsedSeconds = (now - lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * REFILL_RATE;
    tokens = Math.min(CAPACITY, tokens + tokensToAdd);

    if (tokens < 1) {
      broadcast({ apiKey, algorithm: 'token-bucket', status: 'blocked', timestamp: new Date().toISOString() });
      return res.status(429).json({
        error: 'Rate limit exceeded',
        algorithm: 'token-bucket',
        capacity: CAPACITY,
        refill_rate: `${REFILL_RATE} tokens/second`,
        message: 'No tokens available, please wait'
      });
    }

    tokens = tokens - 1;
    await redis.set(tokensKey, tokens.toString());
    await redis.set(lastRefillKey, now.toString());
    await redis.expire(tokensKey, 3600);
    await redis.expire(lastRefillKey, 3600);

    res.setHeader('X-RateLimit-Limit', CAPACITY);
    res.setHeader('X-RateLimit-Remaining', Math.floor(tokens));

    broadcast({ apiKey, algorithm: 'token-bucket', status: 'allowed', timestamp: new Date().toISOString() });
    next();

  } catch (err) {
    console.error('Rate limiter Redis error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { fixedWindow, slidingWindow, tokenBucket };