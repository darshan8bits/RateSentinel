const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);

router.get('/me', authenticateToken, (req, res) => {
  res.json({ message: 'Token is valid', user: req.user });
});

module.exports = router;