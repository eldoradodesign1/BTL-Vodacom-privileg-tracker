const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'shared-data.json');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;

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

async function readChatMessages() {
  if (supabase) {
    const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data;
    }
  }
  return readData().messages;
}

async function writeChatMessage(msg) {
  if (supabase) {
    const { error } = await supabase.from('chat_messages').insert(msg);
    if (!error) return msg;
  }

  const data = readData();
  data.messages.push(msg);
  writeData(data);
  return msg;
}

async function updateChatMessage(id, payload) {
  if (supabase) {
    const { data, error } = await supabase.from('chat_messages').update(payload).eq('id', id).select().single();
    if (!error && data) return data;
  }

  const data = readData();
  const index = data.messages.findIndex((msg) => msg.id === id);
  if (index === -1) return null;
  data.messages[index] = { ...data.messages[index], ...payload };
  writeData(data);
  return data.messages[index];
}

async function readNotifications() {
  if (supabase) {
    const { data, error } = await supabase.from('notifications').select('*').order('timestamp', { ascending: false });
    if (!error && Array.isArray(data)) {
      return data;
    }
  }
  return readData().notifications;
}

async function writeNotification(payload) {
  if (supabase) {
    const { error } = await supabase.from('notifications').insert(payload);
    if (!error) return payload;
  }

  const data = readData();
  data.notifications.push(payload);
  writeData(data);
  return payload;
}

app.get('/api/chat', async (req, res) => {
  res.json(await readChatMessages());
});

app.post('/api/chat', async (req, res) => {
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

  await writeChatMessage(msg);
  res.json(msg);
});

app.put('/api/chat/:id', async (req, res) => {
  const updated = await updateChatMessage(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'message not found' });
  }
  res.json(updated);
});

app.get('/api/notifications', async (req, res) => {
  res.json(await readNotifications());
});

app.post('/api/notifications', async (req, res) => {
  const payload = req.body;
  const saved = await writeNotification(payload);
  res.json(saved);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shared chat server listening on http://0.0.0.0:${PORT}`);
});
