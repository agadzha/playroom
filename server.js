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
  const runtimePatches = [["let r=dir==='left'?line:dir==='right'?line:dir==='up'?j:j,c=dir==='left'?j:dir==='right'?3-j:dir==='up'?line:line;ids.push(r*4+c)","let r=dir==='left'?line:dir==='right'?line:dir==='up'?j:3-j,c=dir==='left'?j:dir==='right'?3-j:line;ids.push(r*4+c)"],["window.addEventListener('keydown',key);let touch=null;$('#gameContent').ontouchstart=e=>touch=[e.touches[0].clientX,e.touches[0].clientY];$('#gameContent').ontouchend=e=>{if(!touch)return;","window.addEventListener('keydown',key);$('#backBtn').addEventListener('click',()=>window.removeEventListener('keydown',key),{once:true});let touch=null;$('#gameContent').ontouchstart=e=>{if(current!=='2048')return;touch=[e.touches[0].clientX,e.touches[0].clientY]};$('#gameContent').ontouchend=e=>{if(current!=='2048'||!touch){touch=null;return;}"],["score=0,run=false;function draw(){ctx.clearRect(0,0,400,400);","score=0,run=false,started=false,gameOver=false;function draw(){ctx.clearRect(0,0,400,400);"],["function tick(){dir=next;let h={x:s[0].x+dir.x,y:s[0].y+dir.y};if(h.x<0||h.x>=20||h.y<0||h.y>=20||s.some(p=>p.x===h.x&&p.y===h.y)){stopSnake();run=false;$('#snakeStatus').textContent='Игра окончена. Очки: '+score;record('snake',score);$('#snakeBest').textContent=stats.snake||score;return}s.unshift(h);if(h.x===food.x&&h.y===food.y){score+=10;$('#snakeScore').textContent=score;food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};while(s.some(p=>p.x===food.x&&p.y===food.y))food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}else s.pop();draw()}","function tick(){dir=next;let h={x:s[0].x+dir.x,y:s[0].y+dir.y},ate=h.x===food.x&&h.y===food.y;if(h.x<0||h.x>=20||h.y<0||h.y>=20||s.some((p,i)=>(ate||i<s.length-1)&&p.x===h.x&&p.y===h.y)){stopSnake();run=false;gameOver=true;$('#snakeStatus').textContent='Игра окончена. Очки: '+score;record('snake',score);$('#snakeBest').textContent=stats.snake||score;return}s.unshift(h);if(ate){score+=10;$('#snakeScore').textContent=score;if(s.length===400){stopSnake();run=false;gameOver=true;$('#snakeStatus').textContent='Идеально! Ты заполнил всё поле. Очки: '+score;record('snake',score);$('#snakeBest').textContent=stats.snake||score;draw();return}do{food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}while(s.some(p=>p.x===food.x&&p.y===food.y))}else s.pop();draw()}"],["function start(){stopSnake();s=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];dir=next={x:1,y:0};score=0;$('#snakeScore').textContent='0';run=true;","function start(){stopSnake();s=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];dir=next={x:1,y:0};score=0;gameOver=false;started=true;$('#snakeScore').textContent='0';run=true;"],["if(m&&!(m.x===-dir.x&&m.y===-dir.y))next=m","if(m&&!(m.x===-dir.x&&m.y===-dir.y)&&!(m.x===-next.x&&m.y===-next.y))next=m"],["$('#snakePause').onclick=()=>{if(run){stopSnake();run=false;$('#snakeStatus').textContent='Пауза'}else if(s.length){run=true;snakeTimer=setInterval(tick,115);$('#snakeStatus').textContent='Игра идёт'}};","$('#snakePause').onclick=()=>{if(run){stopSnake();run=false;$('#snakeStatus').textContent='Пауза'}else if(started&&!gameOver){run=true;snakeTimer=setInterval(tick,115);$('#snakeStatus').textContent='Игра идёт'}};"],["x.onclick=()=>flagMode?(flags[+x.dataset.mine]=!flags[+x.dataset.mine],draw()):reveal(+x.dataset.mine);","x.onclick=()=>{let i=+x.dataset.mine;if(flagMode){if(!over&&!shown[i]){flags[i]=!flags[i];draw()}}else reveal(i)};"],["function goHome(){stopSnake();clearTimeout(reactionTimer);","function goHome(){gameGeneration++;stopSnake();clearTimeout(reactionTimer);"],["function reveal(i){if(shown[i]||flags[i]||over)return;if(first)init(i);shown[i]=true;if(b[i]===-1){over=true;shown=b.map(()=>true);status('Бум! Нажми «Новая игра».')}else if(b[i]===0)neighbours(i).forEach(j=>{if(!shown[j])reveal(j)});if(shown.filter((v,i)=>v&&b[i]!==-1).length===81-bombCount){over=true;status('Победа! Все безопасные клетки открыты.')}draw()}","function reveal(i){if(shown[i]||flags[i]||over)return;if(first)init(i);const queue=[i],queued=new Set([i]);let hitMine=false;while(queue.length&&!hitMine){const cell=queue.pop();if(shown[cell]||flags[cell])continue;shown[cell]=true;if(b[cell]===-1){over=true;hitMine=true;shown=b.map(()=>true);break;}if(b[cell]===0){for(const next of neighbours(cell)){if(!shown[next]&&!flags[next]&&!queued.has(next)){queued.add(next);queue.push(next)}}}}if(hitMine)status('Бум! Нажми «Новая игра».');else if(shown.filter((v,i)=>v&&b[i]!==-1).length===81-bombCount){over=true;status('Победа! Все безопасные клетки открыты.')}draw()}"],[".sudoku button.peer{background:var(--soft)}",".sudoku button.peer{background:var(--soft)}.sudoku button.conflict{background:var(--bad)!important;color:var(--text)!important}"],["function draw(){let dif=`<div class=\"difficulty-row\"><label>Сложность</label>","function conflicts(r,c){let v=board[r][c];if(!v)return false;for(let k=0;k<9;k++){if(k!==c&&board[r][k]===v)return true;if(k!==r&&board[k][c]===v)return true;}let br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++)if((rr!==r||cc!==c)&&board[rr][cc]===v)return true;return false;}function solvedCorrectly(){if(board.some(row=>row.some(v=>!v)))return false;for(let i=0;i<9;i++){if(new Set(board[i]).size!==9||new Set(board.map(row=>row[i])).size!==9)return false;}for(let br=0;br<9;br+=3)for(let bc=0;bc<9;bc+=3){let values=[];for(let r=br;r<br+3;r++)for(let c=bc;c<bc+3;c++)values.push(board[r][c]);if(new Set(values).size!==9)return false;}return true;}function draw(){let dif=`<div class=\"difficulty-row\"><label>Сложность</label>"],["${selected===r*9+c?'selected':''} ${Math.floor(selected/9)===r||selected%9===c?'peer':''}","${selected===r*9+c?'selected':''} ${Math.floor(selected/9)===r||selected%9===c?'peer':''} ${conflicts(r,c)?'conflict':''}"],["if(matched.length===16)status(`Победа! Ходов: ${moves}`)}else","if(matched.length===16){status(`Победа! Ходов: ${moves}`);record('memory',Math.max(0,500-moves));}}else"],["function sudoku(){let solved=Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>(r*3+Math.floor(r/3)+c)%9+1));function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}let bands=shuffle([0,1,2]),rows=[];bands.forEach(b=>shuffle([0,1,2]).forEach(r=>rows.push(b*3+r)));let stacks=shuffle([0,1,2]),cols=[];stacks.forEach(b=>shuffle([0,1,2]).forEach(c=>cols.push(b*3+c)));let nums=shuffle([1,2,3,4,5,6,7,8,9]),full=rows.map(r=>cols.map(c=>nums[(r*3+Math.floor(r/3)+c)%9]));let puzzle=full.map(r=>r.slice()),level=localStorage.getItem('playroom-sudoku-level')||'medium',holes=level==='easy'?32:level==='hard'?52:42;shuffle(Array.from({length:81},(_,i)=>i)).slice(0,holes).forEach(i=>puzzle[i/9|0][i%9]=0);let board=puzzle.map(r=>r.slice()),selected=0;","function sudoku(){function shuffle(a){for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}const solution=[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]];const clue=[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],[8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],[0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]];let bands=shuffle([0,1,2]),rows=[];bands.forEach(b=>shuffle([0,1,2]).forEach(r=>rows.push(b*3+r)));let stacks=shuffle([0,1,2]),cols=[];stacks.forEach(b=>shuffle([0,1,2]).forEach(c=>cols.push(b*3+c)));let nums=shuffle([1,2,3,4,5,6,7,8,9]),full=rows.map(r=>cols.map(c=>nums[solution[r][c]-1]));let puzzle=rows.map(r=>cols.map(c=>clue[r][c]?nums[clue[r][c]-1]:0));let storedLevel=localStorage.getItem('playroom-sudoku-level'),level=['easy','medium','hard'].includes(storedLevel)?storedLevel:'medium',holes=level==='easy'?32:level==='hard'?51:42;let blanks=shuffle(Array.from({length:81},(_,i)=>i).filter(i=>!puzzle[i/9|0][i%9]));while(blanks.length>holes){let i=blanks.pop();puzzle[i/9|0][i%9]=full[i/9|0][i%9]}let board=puzzle.map(r=>r.slice()),selected=0;"],["if(board.every((row,r)=>row.every((v,c)=>v===full[r][c])))","if(solvedCorrectly())"],["$('#sudCheck').onclick=()=>status(board.every((row,r)=>row.every((v,c)=>v===full[r][c]))?'Идеально! Судоку решено.':'Пока есть ошибки или пустые клетки.');","$('#sudCheck').onclick=()=>status(solvedCorrectly()?'Идеально! Судоку решено.':board.some(row=>row.some(v=>!v))?'Пока есть пустые клетки.':'Есть ошибки: проверь повторы в строках, столбцах и квадратах 3×3.');"],["controls('<button class=\"btn primary\" data-action=\"reset\">Новая сетка</button><button class=\"btn\" id=\"sudCheck\">Проверить</button><button class=\"btn\" id=\"sudErase\">Очистить клетку</button>');","controls('<button class=\"btn primary\" data-action=\"reset\">Новая сетка</button><button class=\"btn\" id=\"sudCheck\">Проверить</button><button class=\"btn\" id=\"sudHint\">Подсказка</button><button class=\"btn\" id=\"sudErase\">Очистить клетку</button>');$('#sudHint').onclick=()=>{let r=selected/9|0,c=selected%9;if(puzzle[r][c]){status('Выбери пустую клетку для подсказки.');return;}board[r][c]=full[r][c];draw();if(solvedCorrectly())status('Решено! Отличная работа.')};"],["locked=true,roundTimer=null;const icons=","locked=true,roundTimer=null,runId=0,advanceTimer=null;const icons="],["function flash(i){pads[i].style.background=colors[i];pads[i].style.color='#fff';setTimeout(()=>{if(pads[i]){","function flash(i){const flashingRun=runId;pads[i].style.background=colors[i];pads[i].style.color='#fff';setTimeout(()=>{if(flashingRun===runId&&myGeneration===gameGeneration&&current==='simon'&&pads[i]){"],["function start(){seq=[];level=0;nextRound()}function nextRound(){level++;","function start(){runId++;clearTimeout(advanceTimer);clearInterval(roundTimer);pads.forEach(p=>{p.style.background='var(--soft)';p.style.color='var(--text)'});seq=[];level=0;nextRound(runId)}function nextRound(run=runId){if(run!==runId||myGeneration!==gameGeneration)return;level++"],["seq.push(Math.floor(Math.random()*4));showSequence()}pads.forEach","seq.push(Math.floor(Math.random()*4));showSequence(run)}pads.forEach"],["setTimeout(nextRound,650)}});$('#simonStart').onclick=start;","advanceTimer=setTimeout(()=>nextRound(runId),650)}});$('#simonStart').onclick=start;"],["board[row*8+7]?.p==='R'&&board[row*8+5]===null","board[row*8+7]?.p==='R'&&board[row*8+7]?.c===p.c&&board[row*8+5]===null"],["board[row*8] ?.p==='R'&&board[row*8+1]===null","board[row*8] ?.p==='R'&&board[row*8]?.c===p.c&&board[row*8+1]===null"]];
  for (const [before, after] of runtimePatches) {
    if (!html.includes(before)) throw new Error('Game patch target not found: ' + before.slice(0, 80));
    html = html.replace(before, after);
  }

  // Convert the old account-focused dialog into a compact guest-only online lobby.
  const modalStart = html.indexOf('<div class="online-backdrop" id="onlineBackdrop"');
  const socketScript = '<script src="/socket.io/socket.io.js"></script>';
  const socketScriptAt = html.indexOf(socketScript, modalStart);
  const onlineScriptStart = html.indexOf('<script>', socketScriptAt + socketScript.length);
  const onlineScriptEnd = html.indexOf('</script>', onlineScriptStart);
  if (modalStart < 0 || socketScriptAt < 0 || onlineScriptStart < 0 || onlineScriptEnd < 0) {
    throw new Error('Could not locate online dialog for guest-mode conversion');
  }
  const guestMarkup = String.raw`<div class="online-backdrop" id="onlineBackdrop" aria-modal="true" role="dialog" aria-labelledby="onlineTitle">
 <section class="online-modal">
  <div class="online-head"><div><div class="eyebrow">PLAYROOM · ONLINE</div><h2 id="onlineTitle">Играй с друзьями.</h2><div class="online-muted" id="onlineSubtitle">Онлайн-крестики-нолики без регистрации и пароля.</div></div><button class="online-close" id="onlineClose" aria-label="Закрыть">×</button></div>
  <section class="online-panel">
   <label for="guestName">Имя игрока</label>
   <input class="online-input" id="guestName" maxlength="20" autocomplete="nickname" placeholder="Например, Player-2048">
   <div class="online-notice">Введи любое имя. Аккаунт, пароль и регистрация не нужны.</div>
   <div class="online-panels">
    <article class="online-panel"><h3>Создать комнату</h3><p>Создай партию и отправь другу код или ссылку.</p><button class="btn primary" id="onlineCreateRoom">Создать комнату ↗</button></article>
    <article class="online-panel"><h3>Войти по коду</h3><p>Введи код комнаты, который прислал друг.</p><input class="online-input" id="onlineJoinCode" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:3px"><div class="online-actions"><button class="btn" id="onlineJoinRoom">Присоединиться</button></div></article>
   </div>
   <div class="online-error" id="onlineRoomError" role="status" aria-live="polite"></div>
   <div id="onlineRoomArea"></div>
   <div class="online-notice">Сейчас онлайн поддерживает крестики-нолики. Остальные игры работают прямо в браузере, без аккаунта.</div>
  </section>
 </section>
</div>
<script src="/socket.io/socket.io.js"></script>
<script src="/guest-online.js"></script>`;
  html = html.slice(0, modalStart) + guestMarkup + html.slice(onlineScriptEnd + '</script>'.length);
  html = html.replace('</style>', '.profile-btn,.dashboard{display:none!important}</style>');
  html = html.replace('Локальные игры + онлайн-аккаунты и матчи', 'Локальные игры + онлайн-матчи без регистрации');
  html = html.replace('с онлайн-аккаунтами и матчами', 'с онлайн-матчами без регистрации');
  if (!html.includes('id="guestName"') || html.includes('id="onlineAuthForm"') ||
      html.includes('Создай аккаунт') || html.includes('id="onlinePassword"')) {
    throw new Error('Guest-only lobby validation failed');
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
app.get('/healthz', (req, res) => {
  try {
    const html = loadGamePage().toString('utf8');
    const count = pageGameCount(html);
    if (count !== 17) throw new Error('Expected 17 games; found ' + count);
    res.status(200).json({ ok: true, service: 'playroom-plus', pageReady: true, gameCount: count });
  } catch (error) {
    console.error('Health check could not load game page:', error.message);
    res.status(503).json({ ok: false, pageReady: false });
  }
});
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

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
function updateStats(room) {
  // Anonymous rooms deliberately do not create accounts or persist player data.
  room.statsSaved = true;
}
io.use((socket, next) => {
  const rawName = socket.handshake.auth && socket.handshake.auth.name;
  const name = String(rawName || '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 20);
  if (!/^[\p{L}\p{N}_ -]{1,20}$/u.test(name)) {
    return next(new Error('Введи имя игрока: от 1 до 20 букв, цифр или пробелов.'));
  }
  socket.user = { username: name, guest: true };
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
