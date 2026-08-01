const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'shared-data.json');

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(express.static(path.join(__dirname, 'dist')));

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ messages: [], notifications: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('readData error', err);
    return { messages: [], notifications: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/chat', (req, res) => {
  res.json(readData().messages);
});

app.post('/api/chat', (req, res) => {
  const data = readData();
  const payload = req.body;
  if (!payload || !payload.message) {
    return res.status(400).json({ error: 'message required' });
  }

  const msg = {
    id: payload.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender_id: payload.sender_id,
    sender_name: payload.sender_name,
    sender_role: payload.sender_role,
    message: payload.message,
    timestamp: payload.timestamp || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    created_at: payload.created_at || new Date().toISOString(),
    read_by: payload.read_by || []
  };

  data.messages.push(msg);
  writeData(data);
  res.json(msg);
});

app.put('/api/chat/:id', (req, res) => {
  const data = readData();
  const index = data.messages.findIndex((msg) => msg.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'message not found' });
  }

  data.messages[index] = { ...data.messages[index], ...req.body };
  writeData(data);
  res.json(data.messages[index]);
});

app.get('/api/notifications', (req, res) => {
  res.json(readData().notifications);
});

app.post('/api/notifications', (req, res) => {
  const data = readData();
  const payload = req.body;
  data.notifications.push(payload);
  writeData(data);
  res.json(payload);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shared chat server listening on http://0.0.0.0:${PORT}`);
});
