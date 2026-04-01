const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Create HTTP server
const server = http.createServer(app);

// ✅ FIX: WebSocket with manual upgrade (REQUIRED for Render)
const wss = new WebSocket.Server({ noServer: true });

// 🔥 Store latest data
let latestData = null;
let lastReceivedAt = null;

// ============================
// 🔥 HANDLE WEBSOCKET UPGRADE
// ============================
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// ============================
// 🔥 WEBSOCKET CONNECTION
// ============================
wss.on('connection', (ws) => {
  console.log("🟢 Browser connected");

  // send last data immediately
  if (latestData) {
    ws.send(JSON.stringify(latestData));
  }

  ws.on('close', () => {
    console.log("🔴 Browser disconnected");
  });
});

// ============================
// 🔥 ESP ENDPOINT
// ============================
app.post('/data', (req, res) => {
  const data = req.body;

  if (!data || typeof data !== 'object') {
    console.log("❌ Invalid JSON received");
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // attach timestamp
  data._ts = Date.now();

  latestData = data;
  lastReceivedAt = Date.now();

  console.log("📡 ESP DATA RECEIVED:", data);

  // 🔥 BROADCAST TO ALL CLIENTS
  const message = JSON.stringify(data);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });

  res.json({ ok: true, clients: wss.clients.size });
});

// ============================
// 🔥 HEALTH CHECK
// ============================
app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    clients: wss.clients.size,
    lastReceived: lastReceivedAt
      ? `${Math.round((Date.now() - lastReceivedAt) / 1000)}s ago`
      : "never"
  });
});

// ============================
// 🔥 ROOT
// ============================
app.get('/', (req, res) => {
  res.send("🔥 FireWatch Server Running");
});

// ============================
// 🔥 START SERVER
// ============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
