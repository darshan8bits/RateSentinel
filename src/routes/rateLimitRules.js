const express = require('express');
const router = express.Router();
const { setRule, getRule } = require('../controllers/rateLimitController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, setRule);
router.get('/:api_key_id', authenticateToken, getRule);

module.exports = router;