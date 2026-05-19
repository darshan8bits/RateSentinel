const express = require('express');
const router = express.Router();
const { generateKey, listKeys, deleteKey } = require('../controllers/apiKeyController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, generateKey);
router.get('/', authenticateToken, listKeys);
router.delete('/:id', authenticateToken, deleteKey);

module.exports = router;