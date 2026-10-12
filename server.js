const express = require('express');
const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024,
  pingInterval: 25000,
  pingTimeout: 20000
});
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'data.json');

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: '20kb' }));

// Rebuild the Brotli-compressed game page from its repository-friendly text parts.
app.get('/', (req, res) => {
  try {
    const partsDir = path.join(__dirname, 'public', 'page-data');
    const parts = fs.readdirSync(partsDir)
      .filter(name => /^part-\d{2}\.txt$/.test(name))
      .sort()
      .map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').trim());
    let html = zlib.brotliDecompressSync(Buffer.from(parts.join(''), 'base64')).toString('utf8');
    const runtimePatches = [["let activeFilter='Все',current='';let theme=","let activeFilter='Все',current='',gameGeneration=0;let theme="],["function openGame(id){current=id;","function openGame(id){gameGeneration++;current=id;"],["function ttt(){shell();let board=","function ttt(){const myGeneration=gameGeneration;shell();let board="],["setTimeout(()=>{let empty=board.map((v,i)=>v?null:i).filter(v=>v!==null);let choice;","setTimeout(()=>{if(myGeneration!==gameGeneration||current!=='ttt'||over||mode!=='cpu'||turn!=='O')return;let empty=board.map((v,i)=>v?null:i).filter(v=>v!==null);let choice;"],["function memory(){let icons=","function memory(){const myGeneration=gameGeneration;let icons="],["setTimeout(()=>{open=[];locked=false;draw()},700)","setTimeout(()=>{if(myGeneration!==gameGeneration)return;open=[];locked=false;draw()},700)"],["'КНИГА','МОРЕЦ','ШКОЛА'","'КНИГА','МОРЯК','ШКОЛА'"],["done=false;function draw(){let tiles='';for(let r=0;r<6;r++){","done=false;function evaluateGuess(word){let colors=Array(5).fill('absent'),remaining={};for(let i=0;i<5;i++){if(word[i]===answer[i])colors[i]='correct';else remaining[answer[i]]=(remaining[answer[i]]||0)+1;}for(let i=0;i<5;i++){if(colors[i]==='correct')continue;if(remaining[word[i]]>0){colors[i]='present';remaining[word[i]]--;}}return colors;}function draw(){let tiles='';for(let r=0;r<6;r++){"],["let w=tries[r]|| (r===tries.length?currentWord:'');for(let c=0;c<5;c++){","let w=tries[r]|| (r===tries.length?currentWord:'');let colors=tries[r]?evaluateGuess(w):[];for(let c=0;c<5;c++){"],["let cl='';if(tries[r]){let ch=w[c];cl=ch===answer[c]?'correct':answer.includes(ch)?'present':'absent'}","let cl=colors[c]||'';"],["function simon(){let seq=","function simon(){const myGeneration=gameGeneration;let seq="],["roundTimer=setInterval(()=>{if(i>=seq.length){clearInterval(roundTimer);locked=false;step=0;","roundTimer=setInterval(()=>{if(myGeneration!==gameGeneration){clearInterval(roundTimer);return}if(i>=seq.length){clearInterval(roundTimer);locked=false;step=0;"]];
    for (const [before, after] of runtimePatches) {
      if (!html.includes(before)) throw new Error('Game patch target not found: ' + before.slice(0, 70));
      html = html.replace(before, after);
    }
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  } catch (error) {
    console.error('Could not load the game page:', error.message);
    res.status(500).type('text').send('Playroom is temporarily unable to load its main page.');
  }
});
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

// Rate-limit account creation and login attempts per IP and endpoint.
const requestBuckets = new Map();
function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = (req.ip || req.socket.remoteAddress || 'unknown') + '|' + req.path;
    let bucket = requestBuckets.get(key);
    if (!bucket || now - bucket.start > windowMs) bucket = { start: now, count: 0 };
    bucket.count++;
    requestBuckets.set(key, bucket);
    if (bucket.count > max) return res.status(429).json({ error: message });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets) {
    if (now - bucket.start > 60 * 60 * 1000) requestBuckets.delete(key);
  }
}, 15 * 60 * 1000).unref();

let db = { users: [], sessions: {}, results: [] };
try {
  if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (error) {
  console.error('Could not read data store:', error.message);
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DB_FILE);
}
app.get('/healthz', (req, res) => res.status(200).json({ ok: true, service: 'playroom-plus' }));
function cleanName(value) {
  return String(value || '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 20);
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve({ salt, hash: key.toString('hex') });
    });
  });
}
async function verifyPassword(password, user) {
  const value = await hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(value.hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const username = db.sessions[token];
  return username ? db.users.find(user => user.username === username) : null;
}
function auth(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Войди в аккаунт, чтобы использовать онлайн-функции.' });
  req.user = user;
  next();
}
function publicUser(user) {
  return {
    username: user.username,
    wins: user.wins || 0,
    losses: user.losses || 0,
    draws: user.draws || 0,
    createdAt: user.createdAt
  };
}

app.post('/api/register', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  message: 'Слишком много попыток регистрации с этого адреса. Попробуй позже.'
}), async (req, res) => {
  try {
    const username = cleanName(req.body.username);
    const password = String(req.body.password || '');
    if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(username)) {
      return res.status(400).json({ error: 'Имя: 3–20 букв, цифр, _ или -.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Пароль должен быть длиной от 8 до 128 символов.' });
    }
    if (db.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: 'Такое имя уже занято.' });
    }
    const passwordData = await hashPassword(password);
    const user = {
      username,
      salt: passwordData.salt,
      hash: passwordData.hash,
      createdAt: new Date().toISOString(),
      wins: 0,
      losses: 0,
      draws: 0
    };
    db.users.push(user);
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions[token] = username;
    save();
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Не удалось создать аккаунт.' });
  }
});

app.post('/api/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Слишком много попыток входа. Подожди 15 минут и попробуй снова.'
}), async (req, res) => {
  try {
    const username = cleanName(req.body.username);
    const password = String(req.body.password || '');
    const user = db.users.find(item => item.username.toLowerCase() === username.toLowerCase());
    if (!user || !(await verifyPassword(password, user))) {
      return res.status(401).json({ error: 'Неверное имя или пароль.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions[token] = user.username;
    save();
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка входа.' });
  }
});
app.post('/api/logout', auth, (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  delete db.sessions[token];
  save();
  res.json({ ok: true });
});
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/leaderboard', (req, res) => {
  res.json(db.users.map(publicUser)
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
    .slice(0, 20));
});

const rooms = new Map();
function newRoom(host) {
  let code;
  do {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
  } while (rooms.has(code));
  const room = {
    code,
    players: [{ id: host.id, name: host.user.username, mark: 'X' }],
    board: Array(9).fill(''),
    turn: 'X',
    status: 'waiting',
    winner: null,
    createdAt: Date.now()
  };
  rooms.set(code, room);
  host.join(code);
  host.roomCode = code;
  return room;
}
function snapshot(room) {
  return {
    code: room.code,
    players: room.players.map(player => ({ name: player.name, mark: player.mark })),
    board: room.board,
    turn: room.turn,
    status: room.status,
    winner: room.winner
  };
}
function sendRoom(room) {
  io.to(room.code).emit('room:update', snapshot(room));
}
function winner(board) {
  for (const [a, b, c] of [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ]) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}
function updateStats(room, result) {
  if (room.statsSaved) return;
  room.statsSaved = true;
  if (result === 'draw') {
    room.players.forEach(player => {
      const user = db.users.find(item => item.username === player.name);
      if (user) user.draws = (user.draws || 0) + 1;
    });
  } else {
    const win = room.players.find(player => player.mark === result);
    const lose = room.players.find(player => player.mark !== result);
    if (win) {
      const user = db.users.find(item => item.username === win.name);
      if (user) user.wins = (user.wins || 0) + 1;
    }
    if (lose) {
      const user = db.users.find(item => item.username === lose.name);
      if (user) user.losses = (user.losses || 0) + 1;
    }
  }
  save();
}
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  const username = db.sessions[token];
  const user = username && db.users.find(item => item.username === username);
  if (!user) return next(new Error('Войди в аккаунт для онлайн-игры.'));
  socket.user = { username: user.username };
  next();
});
io.on('connection', socket => {
  socket.on('room:create', (_, callback) => {
    // Leave any previous room cleanly before opening another one.
    if (socket.roomCode) leaveRoom(socket);
    const room = newRoom(socket);
    if (callback) callback({ ok: true, room: snapshot(room) });
    sendRoom(room);
  });
  socket.on('room:join', (code, callback) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return callback && callback({ ok: false, error: 'Комната не найдена. Проверь код.' });
    if (room.players.some(player => player.name === socket.user.username)) {
      return callback && callback({ ok: false, error: 'Ты уже в этой комнате.' });
    }
    if (room.players.length >= 2) {
      return callback && callback({ ok: false, error: 'В комнате уже два игрока.' });
    }
    if (room.status === 'playing') {
      return callback && callback({ ok: false, error: 'Эта партия уже началась.' });
    }
    room.players.push({ id: socket.id, name: socket.user.username, mark: 'O' });
    room.status = 'playing';
    socket.join(code);
    socket.roomCode = code;
    if (callback) callback({ ok: true, room: snapshot(room) });
    sendRoom(room);
  });
  socket.on('game:move', (index, callback) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.status !== 'playing') {
      return callback && callback({ ok: false, error: 'Партия не началась.' });
    }
    const player = room.players.find(item => item.id === socket.id);
    if (!player || player.mark !== room.turn || !Number.isInteger(index) ||
        index < 0 || index > 8 || room.board[index]) {
      return callback && callback({ ok: false, error: 'Недопустимый ход.' });
    }
    room.board[index] = player.mark;
    const result = winner(room.board);
    if (result) {
      room.status = 'finished';
      room.winner = result;
      updateStats(room, result);
    } else {
      room.turn = room.turn === 'X' ? 'O' : 'X';
    }
    sendRoom(room);
    if (callback) callback({ ok: true });
  });
  socket.on('game:rematch', (_, callback) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.players.length !== 2) {
      return callback && callback({ ok: false, error: 'Нужны два игрока.' });
    }
    room.board = Array(9).fill('');
    room.turn = 'X';
    room.status = 'playing';
    room.winner = null;
    room.statsSaved = false;
    sendRoom(room);
    if (callback) callback({ ok: true });
  });
  socket.on('room:leave', () => leaveRoom(socket));
  socket.on('disconnect', () => leaveRoom(socket));
});
function leaveRoom(socket) {
  const code = socket.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  delete socket.roomCode;
  if (!room) return;
  room.players = room.players.filter(item => item.id !== socket.id);
  if (room.players.length === 0) {
    rooms.delete(code);
    return;
  }
  // A lone player becomes X in a fresh waiting room, even if the old game had ended.
  if (room.players.length === 1) {
    room.status = 'waiting';
    room.players[0].mark = 'X';
    room.board = Array(9).fill('');
    room.turn = 'X';
    room.winner = null;
    room.statsSaved = false;
  }
  sendRoom(room);
}
// Expire abandoned rooms so stale invites do not consume memory forever.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > 6 * 60 * 60 * 1000) rooms.delete(code);
  }
}, 30 * 60 * 1000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nplayroom PLUS running on port ' + PORT + '\nData directory: ' + DATA_DIR + '\n');
});
