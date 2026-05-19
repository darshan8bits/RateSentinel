# RateSentinel

> Production-grade API rate limiting middleware for Node.js/Express — with a real-time WebSocket dashboard.

![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What is RateSentinel?

RateSentinel is a backend middleware service that protects APIs from abuse by enforcing configurable rate limits. It supports three industry-standard algorithms, stores rules per API key in a database, and exposes a live WebSocket dashboard that shows request and block counts updating in real time.

Built as a learning project by a 2nd year CSE student at NIT Silchar — every line written from scratch.

---

## Live Demo

🔗 **[ratesentinel.up.railway.app](https://ratesentinel.up.railway.app)** ← dashboard opens here

---

## Features

- **3 Rate Limiting Algorithms**
  - Fixed Window — simple counter per time window
  - Sliding Window — rolling log using Redis sorted sets
  - Token Bucket — smooth refill model with configurable capacity and refill rate

- **Per-API-Key Rules** — each API key can have its own algorithm, limit, and window configured via REST API

- **JWT Authentication** — register, login, get a token, protect your routes

- **Redis-backed** — all counters live in Redis for speed and automatic expiry

- **PostgreSQL** — users, API keys, and rate limit rules stored in a relational database

- **Real-time WebSocket Dashboard** — watch requests and blocks update live as they happen

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v22 |
| Framework | Express |
| Database | PostgreSQL 13 (via `pg`) |
| Cache / Counters | Redis (via `ioredis`) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Real-time | WebSocket (`ws`) |
| Deployment | Railway |

---

## Project Structure

```
RateSentinel/
├── src/
│   ├── app.js                      # Express app + WebSocket server
│   ├── routes/
│   │   ├── auth.js                 # Register, login
│   │   ├── apiKeys.js              # Generate, list, delete API keys
│   │   └── rateLimitRules.js       # Set and fetch rules per API key
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification middleware
│   │   └── rateLimiter.js          # Fixed window, sliding window, token bucket
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── apiKeyController.js
│   │   └── rateLimitController.js
│   ├── config/
│   │   ├── db.js                   # PostgreSQL connection pool
│   │   └── redis.js                # ioredis connection
│   └── db/
│       └── migrate.js              # Creates tables on first run
├── .env
└── package.json
```

---

## Getting Started (Local)

### Prerequisites

- Node.js v18+
- PostgreSQL 13+
- Redis (running on port 6379)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/RateSentinel.git
cd RateSentinel
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:

```env
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratesentinel
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_secret_key

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Create the database

```bash
psql -U postgres -c "CREATE DATABASE ratesentinel;"
```

### 5. Run migrations

```bash
npm run migrate
```

### 6. Start the server

```bash
npm run dev
```

Server runs at `http://localhost:3000`
Dashboard at `http://localhost:3000/dashboard`

---

## API Reference

### Auth

| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login, returns JWT token | No |
| GET | `/auth/me` | Get current user info | Yes |

**Register**
```json
POST /auth/register
{
  "email": "you@example.com",
  "password": "yourpassword"
}
```

**Login**
```json
POST /auth/login
{
  "email": "you@example.com",
  "password": "yourpassword"
}
// Returns: { "token": "eyJ..." }
```

---

### API Keys

| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| POST | `/api-keys` | Generate a new API key | Yes |
| GET | `/api-keys` | List all your API keys | Yes |
| DELETE | `/api-keys/:id` | Delete an API key | Yes |

---

### Rate Limit Rules

| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| POST | `/rate-limit-rules` | Create or update rule for an API key | Yes |
| GET | `/rate-limit-rules/:api_key_id` | Get rule for an API key | Yes |

**Set a rule**
```json
POST /rate-limit-rules
Authorization: Bearer <token>

{
  "api_key_id": 1,
  "algorithm": "fixed",
  "limit_count": 10,
  "window_seconds": 60
}
```

Algorithms: `fixed` | `sliding` | `token_bucket`

For `token_bucket`, use `capacity` and `refill_rate` instead of `limit_count` and `window_seconds`.

---

### Test Endpoints

These endpoints are rate-limited. Pass your API key as a header.

```
GET /test/fixed
GET /test/sliding
GET /test/token-bucket

Header: x-api-key: rs_your_api_key_here
```

---

## Rate Limiting Algorithms Explained

### Fixed Window
Counts requests in fixed time buckets (e.g. 0–60s, 60–120s). Simple and fast. Weakness: allows burst at window boundaries.

### Sliding Window
Uses a Redis sorted set to track exact timestamps of recent requests. More accurate than fixed window — no boundary burst problem.

### Token Bucket
Each API key has a bucket of tokens. Each request consumes one token. Tokens refill at a constant rate up to a max capacity. Allows short bursts while enforcing a long-term average rate.

---

## WebSocket Dashboard

Open `/dashboard` in your browser. It connects automatically to the WebSocket server and shows:

- API key (masked)
- Algorithm in use
- Total requests
- Blocked requests
- Last activity timestamp

All data updates in real time as requests hit the rate limiter.

---

## What I Learned Building This

- How rate limiting algorithms work at a fundamental level and why each has different tradeoffs
- Using Redis sorted sets for sliding window counters
- Building a WebSocket server alongside Express (sharing the same HTTP server)
- JWT authentication flow from scratch — no auth libraries, just `jsonwebtoken`
- Database-driven configuration — rules stored in PostgreSQL, read on every request
- How to structure a production Node.js backend from scratch

---

## Roadmap

- [ ] Docker + docker-compose setup
- [ ] GitHub Actions CI/CD pipeline
- [ ] Demo frontend (no Postman needed)
- [ ] Rate limit analytics (graphs over time)
- [ ] Admin panel to manage all keys and rules

---

## License

MIT
