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
app.set('trust proxy', 1);
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
let cachedGamePage = null;
function pageGameCount(html) {
  const start = html.indexOf('const games=[');
  const end = html.indexOf('];', start);
  return (html.slice(start, end).match(/\{id:'[^']+'/g) || []).length;
}
function loadGamePage() {
  if (cachedGamePage) return cachedGamePage;
  const partsDir = path.join(__dirname, 'public', 'page-data');
  const names = fs.readdirSync(partsDir)
    .filter(name => /^part-\d{2}\.txt$/.test(name))
    .sort();
  if (names.length !== 11) throw new Error('Expected 11 packed game-page chunks; found ' + names.length);
  const encoded = names.map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').trim()).join('');
  let html = zlib.brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8');
  const runtimePatches = [["let r=dir==='left'?line:dir==='right'?line:dir==='up'?j:j,c=dir==='left'?j:dir==='right'?3-j:dir==='up'?line:line;ids.push(r*4+c)","let r=dir==='left'?line:dir==='right'?line:dir==='up'?j:3-j,c=dir==='left'?j:dir==='right'?3-j:line;ids.push(r*4+c)"],["window.addEventListener('keydown',key);let touch=null;$('#gameContent').ontouchstart=e=>touch=[e.touches[0].clientX,e.touches[0].clientY];$('#gameContent').ontouchend=e=>{if(!touch)return;","window.addEventListener('keydown',key);$('#backBtn').addEventListener('click',()=>window.removeEventListener('keydown',key),{once:true});let touch=null;$('#gameContent').ontouchstart=e=>{if(current!=='2048')return;touch=[e.touches[0].clientX,e.touches[0].clientY]};$('#gameContent').ontouchend=e=>{if(current!=='2048'||!touch){touch=null;return;}"],["score=0,run=false;function draw(){ctx.clearRect(0,0,400,400);","score=0,run=false,started=false,gameOver=false;function draw(){ctx.clearRect(0,0,400,400);"],["function tick(){dir=next;let h={x:s[0].x+dir.x,y:s[0].y+dir.y};if(h.x<0||h.x>=20||h.y<0||h.y>=20||s.some(p=>p.x===h.x&&p.y===h.y)){stopSnake();run=false;$('#snakeStatus').textContent='Игра окончена. Очки: '+score;record('snake',score);$('#snakeBest').textContent=stats.snake||score;return}s.unshift(h);if(h.x===food.x&&h.y===food.y){score+=10;$('#snakeScore').textContent=score;food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};while(s.some(p=>p.x===food.x&&p.y===food.y))food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}else s.pop();draw()}","function tick(){dir=next;let h={x:s[0].x+dir.x,y:s[0].y+dir.y},ate=h.x===food.x&&h.y===food.y;if(h.x<0||h.x>=20||h.y<0||h.y>=20||s.some((p,i)=>(ate||i<s.length-1)&&p.x===h.x&&p.y===h.y)){stopSnake();run=false;gameOver=true;$('#snakeStatus').textContent='Игра окончена. Очки: '+score;record('snake',score);$('#snakeBest').textContent=stats.snake||score;return}s.unshift(h);if(ate){score+=10;$('#snakeScore').textContent=score;if(s.length===400){stopSnake();run=false;gameOver=true;$('#snakeStatus').textContent='Идеально! Ты заполнил всё поле. Очки: '+score;record('snake',score);$('#snakeBest').textContent=stats.snake||score;draw();return}do{food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}while(s.some(p=>p.x===food.x&&p.y===food.y))}else s.pop();draw()}"],["function start(){stopSnake();s=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];dir=next={x:1,y:0};score=0;$('#snakeScore').textContent='0';run=true;","function start(){stopSnake();s=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];dir=next={x:1,y:0};score=0;gameOver=false;started=true;$('#snakeScore').textContent='0';run=true;"],["if(m&&!(m.x===-dir.x&&m.y===-dir.y))next=m","if(m&&!(m.x===-dir.x&&m.y===-dir.y)&&!(m.x===-next.x&&m.y===-next.y))next=m"],["$('#snakePause').onclick=()=>{if(run){stopSnake();run=false;$('#snakeStatus').textContent='Пауза'}else if(s.length){run=true;snakeTimer=setInterval(tick,115);$('#snakeStatus').textContent='Игра идёт'}};","$('#snakePause').onclick=()=>{if(run){stopSnake();run=false;$('#snakeStatus').textContent='Пауза'}else if(started&&!gameOver){run=true;snakeTimer=setInterval(tick,115);$('#snakeStatus').textContent='Игра идёт'}};"],["x.onclick=()=>flagMode?(flags[+x.dataset.mine]=!flags[+x.dataset.mine],draw()):reveal(+x.dataset.mine);","x.onclick=()=>{let i=+x.dataset.mine;if(flagMode){if(!over&&!shown[i]){flags[i]=!flags[i];draw()}}else reveal(i)};"],["function goHome(){stopSnake();clearTimeout(reactionTimer);","function goHome(){gameGeneration++;stopSnake();clearTimeout(reactionTimer);"]];
  for (const [before, after] of runtimePatches) {
    if (!html.includes(before)) throw new Error('Game patch target not found: ' + before.slice(0, 80));
    html = html.replace(before, after);
  }
  const required = ['<!doctype html>', 'const games=[', "id:'ttt'", "id:'2048'", "id:'chess'", "id:'checkers'", "id:'aumiau'"];
  const missing = required.filter(fragment => !html.includes(fragment));
  if (missing.length) throw new Error('Game page validation failed: ' + missing.join(', '));
  const catalogStart = html.indexOf('const games=[');
  const catalogEnd = html.indexOf('];', catalogStart);
  const gameCount = (html.slice(catalogStart, catalogEnd).match(/\{id:'[^']+'/g) || []).length;
  if (gameCount !== 17) throw new Error('Expected 17 games; found ' + gameCount);
  cachedGamePage = Buffer.from(html, 'utf8');
  return cachedGamePage;
}

app.get('/', (req, res) => {
  try {
    res.set('Cache-Control', 'no-cache').type('html').send(loadGamePage());
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
app.get('/healthz', (req, res) => {
  try {
    const html = loadGamePage().toString('utf8');
    const catalogStart = html.indexOf('const games=[');
    const catalogEnd = html.indexOf('];', catalogStart);
    const gameCount = (html.slice(catalogStart, catalogEnd).match(/\{id:'[^']+'/g) || []).length;
    if (gameCount !== 17) throw new Error('Expected 17 games; found ' + gameCount);
    res.status(200).json({ ok: true, service: 'playroom-plus', pageReady: true, gameCount });
  } catch (error) {
    console.error('Health check could not load game page:', error.message);
    res.status(503).json({ ok: false, pageReady: false });
  }
});
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
    // A socket can occupy only one room. Validate the destination first so a
    // failed join does not unexpectedly remove the player from their current game.
    if (socket.roomCode && socket.roomCode !== code) leaveRoom(socket);
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
    if (room.status !== 'finished') {
      return callback && callback({ ok: false, error: 'Сначала закончи текущую партию.' });
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

try {
  const page = loadGamePage().toString('utf8');
  console.log('Main page preflight passed (' + pageGameCount(page) + ' games).');
} catch (error) {
  console.error('Main page preflight failed:', error.message);
  process.exit(1);
}
server.listen(PORT, '0.0.0.0', () => {
  console.log('\nplayroom PLUS running on port ' + PORT + '\nData directory: ' + DATA_DIR + '\n');
});
