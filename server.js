const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Latest sensor snapshot — browsers that connect late get it immediately
let latestData = null;
let lastReceivedAt = null;

// ESP32 posts JSON to this endpoint every ~2 seconds
app.post('/data', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  payload._ts = Date.now(); // attach server timestamp
  latestData = payload;
  lastReceivedAt = Date.now();

  // Broadcast to all connected dashboard browsers
  const msg = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });

  res.json({ ok: true, clients: wss.clients.size });
});

// Health check — Render pings this to keep the service alive
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    clients: wss.clients.size,
    lastReceived: lastReceivedAt
      ? `${Math.round((Date.now() - lastReceivedAt) / 1000)}s ago`
      : 'never'
  });
});

// On new browser connection, immediately send last known data
wss.on('connection', (ws) => {
  console.log(`Browser connected. Total clients: ${wss.clients.size}`);
  if (latestData) {
    ws.send(JSON.stringify(latestData));
  }
  ws.on('close', () => {
    console.log(`Browser disconnected. Total clients: ${wss.clients.size}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`FireWatch server running on port ${PORT}`);
});
