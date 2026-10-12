(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const backdrop = $('#onlineBackdrop');
  let socket = null;
  let room = null;

  function cleanName(value) {
    return String(value || '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 20);
  }
  function readName() {
    let name = cleanName($('#guestName').value);
    if (!name) name = 'Player-' + Math.floor(1000 + Math.random() * 9000);
    if (!/^[\p{L}\p{N}_ -]{1,20}$/u.test(name)) {
      throw new Error('Используй 1–20 букв, цифр, пробелов, _ или - в имени.');
    }
    $('#guestName').value = name;
    localStorage.setItem('playroom-guest-name', name);
    return name;
  }
  function openOnline() {
    backdrop.classList.add('show');
    const invite = location.hash.match(/room=([A-Z0-9]{6})/i);
    if (invite) $('#onlineJoinCode').value = invite[1].toUpperCase();
  }
  function closeOnline() {
    backdrop.classList.remove('show');
  }
  async function ensureConnection() {
    const name = readName();
    if (socket && socket.auth && socket.auth.name !== name) {
      socket.disconnect();
      socket = null;
      room = null;
      $('#onlineRoomArea').innerHTML = '';
    }
    if (!socket) {
      if (typeof io !== 'function') throw new Error('Онлайн-сервер недоступен. Обнови страницу.');
      socket = io({ auth: { name } });
      socket.on('room:update', renderRoom);
    }
    if (socket.connected) return;
    await new Promise((resolve, reject) => {
      let finished = false;
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };
      const onConnect = () => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve();
      };
      const onError = error => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error(error && error.message ? error.message : 'Не удалось подключиться.'));
      };
      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });
  }
  function showError(message) {
    $('#onlineRoomError').textContent = message || '';
  }
  async function createRoom() {
    showError('');
    try {
      await ensureConnection();
      socket.emit('room:create', {}, response => {
        if (!response || !response.ok) return showError(response && response.error || 'Не удалось создать комнату.');
        room = response.room;
        location.hash = 'room=' + room.code;
        renderRoom(room);
      });
    } catch (error) { showError(error.message); }
  }
  async function joinRoom(code) {
    showError('');
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return showError('Введи шестизначный код комнаты.');
    try {
      await ensureConnection();
      socket.emit('room:join', code, response => {
        if (!response || !response.ok) return showError(response && response.error || 'Не удалось войти в комнату.');
        room = response.room;
        location.hash = 'room=' + room.code;
        renderRoom(room);
      });
    } catch (error) { showError(error.message); }
  }
  function renderRoom(state) {
    room = state;
    const area = $('#onlineRoomArea');
    const self = readRoomName();
    const myPlayer = state.players.find(player => player.name === self);
    let status = '';
    if (state.status === 'waiting') status = 'Ждём второго игрока… Отправь ему код или ссылку.';
    else if (state.status === 'playing') {
      const next = state.players.find(player => player.mark === state.turn);
      status = next ? (next.name === self ? 'Твой ход' : 'Ход игрока ' + next.name) : 'Игра идёт';
    } else if (state.winner === 'draw') status = 'Ничья! Хорошая партия.';
    else {
      const winner = state.players.find(player => player.mark === state.winner);
      status = winner ? (winner.name === self ? 'Ты победил! 🏆' : 'Победил ' + winner.name + '.') : 'Партия завершена.';
    }
    area.innerHTML = '<div class="online-room"><div class="eyebrow">КОМНАТА</div>' +
      '<div class="online-copy"><span class="online-code" id="guestRoomCode"></span>' +
      '<button class="btn" id="copyRoomCode">Копировать код</button>' +
      '<button class="btn" id="copyRoomLink">Ссылка-приглашение</button></div>' +
      '<p class="online-muted" id="guestRoomPlayers" style="margin-top:10px"></p>' +
      '<div class="online-status" id="onlineGameStatus" aria-live="polite"></div>' +
      '<div class="online-board" id="guestOnlineBoard"></div>' +
      '<div class="online-actions" style="justify-content:center"><button class="btn primary" id="onlineRematch">Сыграть ещё раз</button>' +
      '<button class="btn" id="onlineLeave">Покинуть комнату</button></div></div>';
    $('#guestRoomCode').textContent = state.code;
    $('#guestRoomPlayers').textContent = state.players.map(player => player.name + ' (' + player.mark + ')').join(' · ');
    $('#onlineGameStatus').textContent = status;
    const board = $('#guestOnlineBoard');
    board.innerHTML = state.board.map((value, index) => {
      const isMyTurn = myPlayer && myPlayer.mark === state.turn;
      const disabled = state.status !== 'playing' || !!value || !isMyTurn;
      return '<button class="online-cell" data-online-cell="' + index + '"' + (disabled ? ' disabled' : '') + '>' +
        (value === 'X' ? '×' : value === 'O' ? '○' : '') + '</button>';
    }).join('');
    board.querySelectorAll('[data-online-cell]').forEach(button => {
      button.addEventListener('click', () => {
        if (!socket || !socket.connected) return showError('Соединение потеряно. Попробуй ещё раз.');
        socket.emit('game:move', Number(button.dataset.onlineCell), response => {
          if (response && !response.ok) showError(response.error || 'Ход не выполнен.');
        });
      });
    });
    $('#copyRoomCode').onclick = () => copyText(state.code);
    $('#copyRoomLink').onclick = () => copyText(location.origin + location.pathname + '#room=' + state.code);
    $('#onlineRematch').disabled = state.status !== 'finished';
    $('#onlineRematch').onclick = () => socket && socket.emit('game:rematch', {}, response => {
      if (response && !response.ok) showError(response.error || 'Не удалось начать новую партию.');
    });
    $('#onlineLeave').onclick = () => {
      if (socket) socket.emit('room:leave');
      room = null;
      location.hash = '';
      area.innerHTML = '';
      showError('Ты покинул комнату.');
    };
  }
  function readRoomName() {
    try { return cleanName(localStorage.getItem('playroom-guest-name')) || cleanName($('#guestName').value); }
    catch (_) { return cleanName($('#guestName').value); }
  }
  async function copyText(value) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      showError('Скопировано!');
    } catch (_) { showError('Не удалось скопировать. Код комнаты: ' + value); }
  }

  let savedName = '';
  try { savedName = cleanName(localStorage.getItem('playroom-guest-name')); } catch (_) {}
  $('#guestName').value = savedName || ('Player-' + Math.floor(1000 + Math.random() * 9000));
  $('#onlineOpenBtn').addEventListener('click', openOnline);
  $('#onlineClose').addEventListener('click', closeOnline);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeOnline(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeOnline(); });
  $('#onlineCreateRoom').addEventListener('click', createRoom);
  $('#onlineJoinRoom').addEventListener('click', () => joinRoom($('#onlineJoinCode').value));
  $('#onlineJoinCode').addEventListener('keydown', event => {
    if (event.key === 'Enter') joinRoom(event.target.value);
  });
  const invite = location.hash.match(/room=([A-Z0-9]{6})/i);
  if (invite) { $('#onlineJoinCode').value = invite[1].toUpperCase(); openOnline(); }
})();