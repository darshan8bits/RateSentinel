const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const cookieParser = require('cookie-parser');
const { setServer, broadcast } = require('./websocket');

dotenv.config();

require('./config/db');
require('./config/redis');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Dashboard auth middleware ────────────────────────────────────────────────
function dashboardAuth(req, res, next) {
  if (req.cookies.dashboard_auth === process.env.DASHBOARD_PASSWORD) {
    return next();
  }
  res.redirect('/login');
}

// ─── Login page ───────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>RateSentinel — Login</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #080b12;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: 'JetBrains Mono', monospace;
        }
        .card {
          background: #0e1420;
          border: 1px solid #1a2236;
          border-radius: 16px;
          padding: 40px 48px;
          width: 100%;
          max-width: 380px;
        }
        h1 {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          color: #fff;
          margin-bottom: 8px;
        }
        p {
          font-size: 12px;
          color: #4a5568;
          margin-bottom: 28px;
        }
        input {
          width: 100%;
          background: #080b12;
          border: 1px solid #1a2236;
          border-radius: 8px;
          padding: 12px 14px;
          color: #cdd6f4;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          margin-bottom: 14px;
          outline: none;
        }
        input:focus { border-color: #00f5a0; }
        button {
          width: 100%;
          background: #00f5a0;
          color: #080b12;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
        }
        button:hover { background: #00d488; }
        .error {
          font-size: 12px;
          color: #ff4d6d;
          margin-bottom: 14px;
          display: none;
        }
        .error.show { display: block; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>RateSentinel</h1>
        <p>Enter your dashboard password to continue</p>
        <div class="error ${req.query.error ? 'show' : ''}">Incorrect password. Try again.</div>
        <form method="POST" action="/login">
          <input type="password" name="password" placeholder="Password" autofocus />
          <button type="submit">Enter Dashboard</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    res.cookie('dashboard_auth', password, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    return res.redirect('/');
  }
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  res.clearCookie('dashboard_auth');
  res.redirect('/login');
});

// ─── Serve dashboard (protected) ─────────────────────────────────────────────
app.use('/', dashboardAuth, express.static(path.join(__dirname, 'dashboard')));

// ─── API routes ───────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const apiKeyRoutes = require('./routes/apiKeys');
const rateLimitRulesRoutes = require('./routes/rateLimitRules');

app.use('/auth', authRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/rate-limit-rules', rateLimitRulesRoutes);

// ─── Rate limit test routes ───────────────────────────────────────────────────
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

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

setServer(wss);

wss.on('connection', (socket) => {
  console.log('Dashboard connected via WebSocket');
  socket.on('close', () => console.log('Dashboard disconnected'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});