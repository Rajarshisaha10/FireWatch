const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Render uses proxy → MUST use this
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// 🔥 Upgrade handler (CRITICAL for Render)
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

let latestData = null;

// ESP POST endpoint
app.post('/data', (req, res) => {
  console.log("📡 ESP DATA:", req.body);

  latestData = req.body;

  // broadcast
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(req.body));
    }
  });

  res.json({ ok: true });
});

// WebSocket connect
wss.on('connection', (ws) => {
  console.log("🟢 Browser connected");

  if (latestData) {
    ws.send(JSON.stringify(latestData));
  }
});

app.get('/', (req, res) => {
  res.send("Server running");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🔥 Server running on port", PORT);
});
