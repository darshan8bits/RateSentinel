// ── State ─────────────────────────────────────────────────────────────────────
const stats = {};
let totalAllowed = 0;
let totalBlocked = 0;
const sparklineData = [];

// ── WebSocket ─────────────────────────────────────────────────────────────────
const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${location.host}`);

ws.onopen = () => {
  document.getElementById('status-dot').classList.add('connected');
  document.getElementById('status-text').textContent = 'Connected';
};

ws.onclose = () => {
  document.getElementById('status-dot').classList.remove('connected');
  document.getElementById('status-text').textContent = 'Disconnected';
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleEvent(data);
};

// ── Handle incoming event ─────────────────────────────────────────────────────
function handleEvent(data) {
  const { apiKey, algorithm, status, timestamp } = data;

  if (status === 'allowed') totalAllowed++;
  else totalBlocked++;

  document.getElementById('total-count').textContent = totalAllowed + totalBlocked;
  document.getElementById('allowed-count').textContent = totalAllowed;
  document.getElementById('blocked-count').textContent = totalBlocked;

  const total = totalAllowed + totalBlocked;
  const blockRate = total === 0 ? 0 : Math.round((totalBlocked / total) * 100);
  document.getElementById('block-rate').textContent = blockRate + '%';

  if (!stats[apiKey]) {
    stats[apiKey] = { allowed: 0, blocked: 0, algorithm, lastStatus: status, lastSeen: timestamp };
  }

  if (status === 'allowed') stats[apiKey].allowed++;
  else stats[apiKey].blocked++;

  stats[apiKey].lastStatus = status;
  stats[apiKey].lastSeen = timestamp;
  stats[apiKey].algorithm = algorithm;

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('main-table').style.display = 'table';

  sparklineData.push(status);
  if (sparklineData.length > 30) sparklineData.shift();

  renderRow(apiKey, status);
  drawSparkline();
  drawDonut();
  addFeedItem(apiKey, algorithm, status, timestamp);
}

// ── Table row ─────────────────────────────────────────────────────────────────
function renderRow(apiKey, flashStatus) {
  const s = stats[apiKey];
  const shortKey = apiKey.slice(0, 16) + '...';
  const timeStr = new Date(s.lastSeen).toLocaleTimeString();

  let row = document.getElementById(`row-${CSS.escape(apiKey)}`);

  if (!row) {
    row = document.createElement('tr');
    row.id = `row-${apiKey}`;
    document.getElementById('table-body').prepend(row);
  }

  row.innerHTML = `
    <td><span class="key-text">${shortKey}</span></td>
    <td><span class="algo">${s.algorithm}</span></td>
    <td>${s.allowed}</td>
    <td>${s.blocked}</td>
    <td><span class="badge ${s.lastStatus}">${s.lastStatus}</span></td>
    <td>${timeStr}</td>
  `;

  row.classList.remove('flash-allowed', 'flash-blocked');
  void row.offsetWidth;
  row.classList.add(`flash-${flashStatus}`);
  setTimeout(() => row.classList.remove(`flash-${flashStatus}`), 600);
}

// ── Sparkline chart ───────────────────────────────────────────────────────────
function drawSparkline() {
  const canvas = document.getElementById('sparkline-canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = canvas.offsetWidth;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  if (sparklineData.length < 2) return;

  const points = sparklineData.map((_, i) => i + 1);
  const max = points[points.length - 1];
  const step = W / (sparklineData.length - 1);

  let allowedCount = 0;
  const allowedPoints = sparklineData.map((s, i) => {
    if (s === 'allowed') allowedCount++;
    return { x: i * step, y: H - (allowedCount / max) * (H - 10) - 5 };
  });

  let blockedCount = 0;
  const blockedPoints = sparklineData.map((s, i) => {
    if (s === 'blocked') blockedCount++;
    return { x: i * step, y: H - (blockedCount / max) * (H - 10) - 5 };
  });

  function drawLine(pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.lineTo(pts[0].x, H);
    ctx.closePath();
    ctx.fillStyle = color + '18';
    ctx.fill();
  }

  drawLine(allowedPoints, '#00f5a0');
  drawLine(blockedPoints, '#ff4d6d');

  function drawDot(pts, color) {
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawDot(allowedPoints, '#00f5a0');
  drawDot(blockedPoints, '#ff4d6d');
}

// ── Donut chart ───────────────────────────────────────────────────────────────
function drawDonut() {
  const canvas = document.getElementById('donut-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 44;
  const thickness = 16;

  ctx.clearRect(0, 0, W, H);

  const total = totalAllowed + totalBlocked;

  if (total === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a2236';
    ctx.lineWidth = thickness;
    ctx.stroke();
    return;
  }

  const allowedAngle = (totalAllowed / total) * Math.PI * 2;
  const blockedAngle = (totalBlocked / total) * Math.PI * 2;
  const startAngle = -Math.PI / 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, startAngle + allowedAngle);
  ctx.strokeStyle = '#00f5a0';
  ctx.lineWidth = thickness;
  ctx.lineCap = 'butt';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle + allowedAngle, startAngle + allowedAngle + blockedAngle);
  ctx.strokeStyle = '#ff4d6d';
  ctx.lineWidth = thickness;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Syne, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy);
}

// ── Activity feed ─────────────────────────────────────────────────────────────
function addFeedItem(apiKey, algorithm, status, timestamp) {
  const feed = document.getElementById('activity-feed');
  const shortKey = apiKey.slice(0, 14) + '...';
  const timeStr = new Date(timestamp).toLocaleTimeString();

  const li = document.createElement('li');
  li.className = 'feed-item';
  li.innerHTML = `
    <span class="feed-dot ${status}"></span>
    <span class="feed-key">${shortKey}</span>
    <span class="feed-algo">${algorithm}</span>
    <span class="feed-time">${timeStr}</span>
  `;

  feed.prepend(li);

  while (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

// ── Animated background grid ──────────────────────────────────────────────────
function initBgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  const SPACING = 40;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a2236';
    ctx.lineWidth = 0.5;

    for (let x = 0; x < canvas.width; x += SPACING) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  draw();
  window.addEventListener('resize', draw);
}

initBgCanvas();