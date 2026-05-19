const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { setServer, broadcast } = require('./websocket');

dotenv.config();

require('./config/db');
require('./config/redis');

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'dashboard')));

const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/apiKeys');
const rateLimitRulesRoutes = require('./routes/rateLimitRules');

app.use('/auth', authRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/rate-limit-rules', rateLimitRulesRoutes);

const { fixedWindow, slidingWindow, tokenBucket } = require('./middleware/rateLimiter');

app.get('/test/fixed', fixedWindow, (req, res) => {
  res.json({ message: 'Request allowed!', algorithm: 'fixed-window' });
});

app.get('/test/sliding', slidingWindow, (req, res) => {
  res.json({ message: 'Request allowed!', algorithm: 'sliding-window' });
});

app.get('/test/token-bucket', tokenBucket, (req, res) => {
  res.json({ message: 'Request allowed!', algorithm: 'token-bucket' });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

// ─── Tell websocket.js about the WS server ───────────────────────────────────
setServer(wss);

wss.on('connection', (socket) => {
  console.log('Dashboard connected via WebSocket');
  socket.on('close', () => {
    console.log('Dashboard disconnected');
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});