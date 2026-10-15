const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.('#0b0a10');
  tg.setBackgroundColor?.('#0b0a10');
}
const haptic = (type = 'light') => tg?.HapticFeedback?.impactOccurred(type);
const notify = (type) => tg?.HapticFeedback?.notificationOccurred(type);

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chat = $('#chat');
const statusEl = $('#status');
const sheet = $('#sheet');
const tray = $('#tray');

const THEIR_GIFT = { id: 'cat', name: 'Scared Cat', num: '14081', sub: 'Azuki Siam', art: '🐈', bg: 'linear-gradient(135deg,#d8774f,#b04a2c)' };
const MY_GIFTS = [
  { id: 'wand', name: 'Magic Torch', num: '249912', sub: 'Lilac Dream', art: '🪄', bg: 'linear-gradient(135deg,#7f8bff,#4e45d6)' },
  { id: 'pyr', name: 'Eye Pyramid', num: '19020', sub: 'Golden Age', art: '🔺', bg: 'linear-gradient(135deg,#f3b74a,#c97a1c)' },
  { id: 'ramen', name: 'Ramen Bowl', num: '3511', sub: 'Mint Broth', art: '🍜', bg: 'linear-gradient(135deg,#4fd1a5,#1f8f73)' },
  { id: 'dog', name: 'Resistance Dog', num: '8833', sub: 'Plush Pepe', art: '🐸', bg: 'linear-gradient(135deg,#e85a4f,#b52d2d)' },
];

const SCRIPT = [
  ['in', 'глянул твой профиль', '21:48'],
  ['in', 'пепе на кармине ещё у тебя?', '21:48'],
  ['out', 'у меня, не продаю', '21:49'],
  ['in', 'а на кота? азуки сиам, #14081', '21:51'],
  ['out', 'только с доплатой', '21:51'],
  ['in', '+350 GRAM. кидаю обмен', '21:51'],
];

let state; // { mine, run, card }

function now() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function giftEl(g) {
  const el = document.createElement('div');
  el.className = 'gift';
  el.style.background = g.bg;
  el.innerHTML = `<span class="art">${g.art}</span><span class="num">#${g.num}</span>`;
  el.dataset.id = g.id;
  return el;
}

function scrollDown() {
  chat.scrollTop = chat.scrollHeight;
}

function addMsg(side, text, time = now()) {
  const m = document.createElement('div');
  m.className = `msg ${side}`;
  m.innerHTML = `<span class="t">${time}</span>`;
  m.prepend(document.createTextNode(text));
  chat.append(m);
  scrollDown();
  return m;
}

async function typing(ms, run) {
  statusEl.textContent = 'печатает…';
  statusEl.classList.add('typing');
  await sleep(ms);
  statusEl.textContent = 'в сети';
  statusEl.classList.remove('typing');
  return run === state.run;
}

/* ---------- exchange card ---------- */
function buildCard() {
  const card = document.createElement('div');
  card.className = 'trade';
  card.innerHTML = `
    <div class="trade-head"><span>⇄</span> <span class="ttl">Обмен</span></div>
    <div class="sides">
      <div class="side left">
        <div class="side-head"><span class="mini">🥷</span>ТИТАН <span class="sub"></span></div>
        <div class="slot"></div>
        <div class="gname"></div><div class="gsub"></div>
        <div class="gram">+ GRAM</div>
        <button class="btn" disabled>Подтвердить</button>
      </div>
      <div class="lock">🔓</div>
      <div class="side right">
        <div class="side-head"><span class="mini">🟣</span>Вы</div>
        <div class="slot mine">+</div>
        <div class="gname"></div><div class="gsub"></div>
        <div class="gram">+ GRAM</div>
        <button class="btn" disabled>Подтвердить</button>
      </div>
    </div>`;
  chat.append(card);
  scrollDown();

  const left = $('.left', card);
  const right = $('.right', card);
  const myBtn = $('.btn', right);
  const mySlot = $('.slot', right);

  mySlot.addEventListener('click', () => {
    if (state.locked) return;
    if (state.mine) removeMine();
    else openSheet();
  });
  myBtn.addEventListener('click', confirmMine);
  return { card, left, right, myBtn, mySlot };
}

function fillSlot(side, g) {
  const slot = $('.slot', side);
  slot.textContent = '';
  slot.classList.add('filled');
  slot.append(giftEl(g));
  $('.gname', side).textContent = `${g.name} #${g.num}`;
  $('.gsub', side).textContent = g.sub;
}

function clearSlot(side) {
  const slot = $('.slot', side);
  slot.classList.remove('filled');
  slot.textContent = '+';
  $('.gname', side).textContent = '';
  $('.gsub', side).textContent = '';
}

function placeMine(id) {
  const g = MY_GIFTS.find((x) => x.id === id);
  if (!g || state.locked) return;
  if (state.mine) removeMine();
  state.mine = g;
  fillSlot(state.card.right, g);
  tray.querySelector(`[data-id="${id}"]`)?.classList.add('used');
  state.card.myBtn.disabled = false;
  haptic('medium');
  closeSheet();
}

function removeMine() {
  tray.querySelector(`[data-id="${state.mine.id}"]`)?.classList.remove('used');
  state.mine = null;
  clearSlot(state.card.right);
  state.card.myBtn.disabled = true;
  haptic();
}

async function confirmMine() {
  if (!state.mine || state.locked) return;
  const run = state.run;
  const { left, right, myBtn, card } = state.card;
  state.locked = true;
  haptic('heavy');
  myBtn.className = 'btn green';
  myBtn.textContent = '✓ Подтверждено';
  $('.side-head', right).insertAdjacentHTML('beforeend', '<span class="ok">✓</span>');

  // counterpart confirms with a progress fill
  const theirBtn = $('.btn', left);
  $('.sub', left).textContent = 'подтверждает…';
  theirBtn.classList.add('wait');
  for (let p = 0; p <= 100; p += 4) {
    theirBtn.style.setProperty('--p', p + '%');
    await sleep(40);
    if (run !== state.run) return;
  }
  theirBtn.className = 'btn green';
  theirBtn.textContent = '✓ Подтверждено';
  $('.sub', left).textContent = '';
  $('.side-head', left).insertAdjacentHTML('beforeend', '<span class="ok">✓</span>');
  haptic('heavy');

  await sleep(500);
  if (run !== state.run) return;
  $('.lock', card).classList.add('done');
  $('.lock', card).textContent = '🔒';
  card.classList.add('swapping');
  await sleep(900);
  if (run !== state.run) return;
  notify('success');
  showResult();

  if (!(await typing(1400, run))) return;
  addMsg('in', 'чётко, и без гаранта');
}

function showResult() {
  const { card } = state.card;
  card.classList.remove('swapping');
  card.innerHTML = `
    <div class="trade-head"><span class="ok">✓</span> Обмен завершён <span class="tm">${now()}</span></div>
    <div class="result">
      <div class="cell a"></div>
      <div class="mid">⇄<div class="gram on">💎 +350 GRAM</div></div>
      <div class="cell b"></div>
    </div>`;
  const a = $('.cell.a', card);
  const b = $('.cell.b', card);
  a.append(giftEl(state.mine), 'отправлено');
  b.append(giftEl(THEIR_GIFT), 'получено');
  scrollDown();
}

/* ---------- bottom sheet & drag ---------- */
function openSheet() {
  sheet.classList.add('open');
  haptic();
}
function closeSheet() {
  sheet.classList.remove('open');
}

function renderTray() {
  tray.textContent = '';
  MY_GIFTS.forEach((g) => {
    const el = giftEl(g);
    tray.append(el);
    attachDrag(el, g.id);
  });
  $('#count').textContent = MY_GIFTS.length;
}

function attachDrag(el, id) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let ghost = null;
    const slot = state.card?.mySlot;

    const overSlot = (x, y) => {
      if (!slot) return false;
      const r = slot.getBoundingClientRect();
      return x > r.left - 20 && x < r.right + 20 && y > r.top - 20 && y < r.bottom + 20;
    };
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        ghost = el.cloneNode(true);
        ghost.classList.add('ghost');
        document.body.append(ghost);
        el.style.opacity = '.3';
        sheet.style.transform = 'translateY(55%)';
        haptic();
      }
      if (ghost) {
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
        slot?.classList.toggle('drop', overSlot(ev.clientX, ev.clientY));
      }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.style.opacity = '';
      sheet.style.transform = '';
      slot?.classList.remove('drop');
      if (ghost) {
        ghost.remove();
        if (overSlot(ev.clientX, ev.clientY)) placeMine(id);
      } else {
        placeMine(id); // simple tap
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/* ---------- scenario ---------- */
async function start() {
  const run = Date.now();
  state = { run, mine: null, locked: false, card: null };
  chat.innerHTML = '<div class="date">Сегодня</div>';
  closeSheet();
  renderTray();

  for (const [side, text, time] of SCRIPT) {
    if (side === 'in') {
      if (!(await typing(650, run))) return;
    } else {
      await sleep(450);
      if (run !== state.run) return;
    }
    addMsg(side, text, time);
  }

  await sleep(500);
  if (run !== state.run) return;
  state.card = buildCard();
  await sleep(500);
  if (run !== state.run) return;
  fillSlot(state.card.left, THEIR_GIFT);
  const g = $('.gram', state.card.left);
  g.classList.add('on');
  g.textContent = '💎 350 GRAM';
  haptic();
  await sleep(500);
  if (run !== state.run) return;
  openSheet();
}

$('#restart').addEventListener('click', () => {
  haptic();
  start();
});

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#input').value.trim();
  if (!v) return;
  addMsg('out', v);
  $('#input').value = '';
});

// tap outside the sheet closes it
chat.addEventListener('click', (e) => {
  if (!e.target.closest('.slot')) closeSheet();
});

start();
