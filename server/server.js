// server.js 
// Suno → Discord Rich Presence backend + Forward to Visual

const express = require('express');
const cors = require('cors');
const RPC = require('discord-rpc');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ===== НАСТРОЙКА =====
const CLIENT_ID = '1426921356527927399';
const PORT = 3000;
const VISUAL_URL = 'http://localhost:4000/update';

RPC.register(CLIENT_ID);

// ===== APP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== RPC =====
const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => console.log('✅ Discord RPC подключён'));
rpc.on('disconnected', () => {
  console.log('⚠️ RPC отключился, переподключаюсь…');
  setTimeout(() => rpc.login({ clientId: CLIENT_ID }).catch(()=>{}), 1000);
});
rpc.on('error', e => console.log('RPC error:', e?.message || e));
rpc.login({ clientId: CLIENT_ID }).catch(e =>
  console.error('Не удалось подключиться к Discord RPC:', e?.message || e)
);

// ===== helpers =====
const cap = (s, n=128) => (typeof s === 'string' ? s.slice(0, n) : '');
const clean = s => (s ?? '')
  .toString()
  .replace(/\s*\|\s*Join me on Suno.*$/i, '')
  .replace(/^suno\s*-\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

let lastHash = '';
let lastSentAt = 0;

// ===== endpoint ===== 
app.post('/update', async (req, res) => {
  let { song, artist, duration, progress, url, timeDisplay, coverUrl } = req.body || {}; // <-- НОВОЕ: coverUrl

  let safeSong   = cap(clean(song), 128);
  let safeArtist = cap(clean(artist), 128);

  if (!safeSong || safeSong.replace(/\s/g, '').length < 2) safeSong = 'Без названия';
  if (!safeArtist || safeArtist.replace(/\s/g, '').length < 1) safeArtist = 'Suno';

  if (!global.rpcStartTimestamp) global.rpcStartTimestamp = new Date();
  const startTimestamp = global.rpcStartTimestamp;

  let endTimestamp;
  if (
    typeof duration === 'number' &&
    typeof progress === 'number' &&
    isFinite(duration) &&
    isFinite(progress) &&
    duration > progress &&
    progress >= 0
  ) {
    endTimestamp = new Date(Date.now() + (duration - progress) * 1000);
  }

  const now = Date.now();
  const hash = JSON.stringify({ safeSong, safeArtist, p: Math.floor(progress || 0) });
  if (hash === lastHash && now - lastSentAt < 900) return res.sendStatus(200);
  lastHash = hash; lastSentAt = now;

  console.log(`🎶 ${safeArtist} — ${safeSong} (${timeDisplay || ''})${coverUrl ? ' 🖼️' : ''}`);

  try {
    const activity = {
      type: 2,
      details: safeSong,
      state: (`👤 ${safeArtist}${timeDisplay ? ' | ' + timeDisplay : ''}`).slice(0, 128),
      largeImageKey: coverUrl || 'suno_logo', // <-- НОВОЕ: используем URL обложки напрямую
      largeImageText: 'Suno AI',
      startTimestamp,
      endTimestamp
    };
    
    if (url && /^https?:\/\//i.test(url))
      activity.buttons = [{ label: 'Открыть в Suno', url }];

    rpc.setActivity(activity);
  } catch (e) {
    console.error('Ошибка RPC:', e?.message || e);
  }

  // === Пересылка данных в визуал ===
  try {
    await fetch(VISUAL_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(req.body)
    });
  } catch (err) {
    console.warn('⚠️ Не удалось отправить данные в визуал:', err.message);
  }

  res.sendStatus(200);
});

// ===== run =====
app.listen(PORT, () => console.log(`🌐 Сервер Suno RPC запущен (порт ${PORT}), пересылка в ${VISUAL_URL}`));