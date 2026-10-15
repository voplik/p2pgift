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

const trade = $('#trade');
const result = $('#result');
const left = $('.left', trade);
const right = $('.right', trade);
const mySlot = $('.slot', right);
const myBtn = $('#confirm');
const sheet = $('#sheet');
const tray = $('#tray');
const chips = $('#chips');
const hint = $('#hint');
const statusEl = $('#status');

const THEIR_GIFT = { id: 'cat', name: 'Scared Cat', num: '14081', sub: 'Azuki Siam', art: '🐈', bg: 'linear-gradient(135deg,#d8774f,#b04a2c)' };
const THEIR_GRAM = 350;
const MY_GIFTS = [
  { id: 'wand', name: 'Magic Torch', num: '249912', sub: 'Lilac Dream', art: '🪄', bg: 'linear-gradient(135deg,#7f8bff,#4e45d6)' },
  { id: 'pyr', name: 'Eye Pyramid', num: '19020', sub: 'Golden Age', art: '🔺', bg: 'linear-gradient(135deg,#f3b74a,#c97a1c)' },
  { id: 'ramen', name: 'Ramen Bowl', num: '3511', sub: 'Mint Broth', art: '🍜', bg: 'linear-gradient(135deg,#4fd1a5,#1f8f73)' },
  { id: 'dog', name: 'Resistance Dog', num: '8833', sub: 'Plush Pepe', art: '🐸', bg: 'linear-gradient(135deg,#e85a4f,#b52d2d)' },
];
const GRAM_OPTIONS = [0, 50, 100, 250];

let state;

function giftEl(g) {
  const el = document.createElement('div');
  el.className = 'gift';
  el.style.background = g.bg;
  el.innerHTML = `<span class="art">${g.art}</span><span class="num">#${g.num}</span>`;
  el.dataset.id = g.id;
  return el;
}

function setStatus(text, active = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('typing', active);
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

function setGram(side, amount) {
  const g = $('.gram', side);
  g.classList.toggle('on', amount > 0);
  g.textContent = amount > 0 ? `💎 ${amount} GRAM` : '+ GRAM';
}

function updateHint() {
  if (state.locked) return;
  hint.textContent = state.mine ? 'Проверьте обмен и нажмите «Подтвердить»' : 'Положите свой подарок на стол';
}

/* ---------- your side ---------- */
function placeMine(id) {
  const g = MY_GIFTS.find((x) => x.id === id);
  if (!g || state.locked || !state.ready) return;
  if (state.mine) removeMine(true);
  state.mine = g;
  fillSlot(right, g);
  tray.querySelector(`[data-id="${id}"]`)?.classList.add('used');
  myBtn.disabled = false;
  haptic('medium');
  updateHint();
}

function removeMine(silent) {
  tray.querySelector(`[data-id="${state.mine.id}"]`)?.classList.remove('used');
  state.mine = null;
  clearSlot(right);
  myBtn.disabled = true;
  if (!silent) haptic();
  updateHint();
}

function setMyGram(amount) {
  if (state.locked) return;
  state.myGram = amount;
  setGram(right, amount);
  chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', +c.dataset.v === amount));
  haptic();
}

async function confirmMine() {
  if (!state.mine || state.locked) return;
  const run = state.run;
  state.locked = true;
  haptic('heavy');
  sheet.classList.remove('open');
  myBtn.className = 'btn green';
  myBtn.textContent = '✓ Подтверждено';
  $('.side-head', right).insertAdjacentHTML('beforeend', '<span class="ok">✓</span>');
  hint.textContent = 'Ждём подтверждение ТИТАН…';

  // counterpart confirms with a progress fill
  const theirBtn = $('.btn', left);
  $('.sub', left).textContent = 'подтверждает…';
  setStatus('подтверждает…', true);
  theirBtn.classList.add('wait');
  for (let p = 0; p <= 100; p += 4) {
    theirBtn.style.setProperty('--p', p + '%');
    await sleep(40);
    if (run !== state.run) return;
  }
  theirBtn.className = 'btn green';
  theirBtn.textContent = '✓ Подтверждено';
  $('.sub', left).textContent = '';
  setStatus('в сети');
  $('.side-head', left).insertAdjacentHTML('beforeend', '<span class="ok">✓</span>');
  haptic('heavy');
  hint.textContent = 'Обмениваемся…';

  await sleep(400);
  if (run !== state.run) return;
  $('.lock', trade).classList.add('done');
  $('.lock', trade).textContent = '🔒';
  trade.classList.add('swapping');
  await sleep(900);
  if (run !== state.run) return;
  notify('success');
  showResult();
}

function showResult() {
  trade.hidden = true;
  result.hidden = false;
  const d = new Date();
  $('#time').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const diff = THEIR_GRAM - state.myGram;
  $('#diff').textContent = `💎 ${diff >= 0 ? '+' : ''}${diff} GRAM`;
  $('#sent').replaceChildren(giftEl(state.mine), 'отправлено');
  $('#got').replaceChildren(giftEl(THEIR_GIFT), 'получено');
  hint.textContent = 'Подарки переданы напрямую, без гаранта';
}

/* ---------- tray & drag ---------- */
function renderTray() {
  tray.textContent = '';
  MY_GIFTS.forEach((g) => {
    const el = giftEl(g);
    tray.append(el);
    attachDrag(el, g.id);
  });
  $('#count').textContent = MY_GIFTS.length;

  chips.textContent = '';
  GRAM_OPTIONS.forEach((v) => {
    const c = document.createElement('button');
    c.className = 'chip' + (v === 0 ? ' on' : '');
    c.dataset.v = v;
    c.textContent = v ? `${v} 💎` : 'Без';
    c.onclick = () => setMyGram(v);
    chips.append(c);
  });
}

function attachDrag(el, id) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let ghost = null;

    const overSlot = (x, y) => {
      const r = mySlot.getBoundingClientRect();
      return x > r.left - 20 && x < r.right + 20 && y > r.top - 20 && y < r.bottom + 20;
    };
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        ghost = el.cloneNode(true);
        ghost.classList.add('ghost');
        document.body.append(ghost);
        el.style.opacity = '.3';
        haptic();
      }
      if (ghost) {
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
        mySlot.classList.toggle('drop', overSlot(ev.clientX, ev.clientY));
      }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.style.opacity = '';
      mySlot.classList.remove('drop');
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

/* ---------- lifecycle ---------- */
async function start() {
  const run = Date.now();
  state = { run, mine: null, myGram: 0, locked: false, ready: false };

  trade.hidden = false;
  result.hidden = true;
  trade.classList.remove('swapping');
  [left, right].forEach((side) => {
    clearSlot(side);
    setGram(side, 0);
    const btn = $('.btn', side);
    btn.className = 'btn';
    btn.textContent = 'Подтвердить';
    btn.disabled = true;
    btn.style.removeProperty('--p');
    $('.side-head .ok', side)?.remove();
  });
  $('.sub', left).textContent = '';
  $('.lock', trade).classList.remove('done');
  $('.lock', trade).textContent = '🔓';
  renderTray();

  hint.textContent = 'ТИТАН выбирает подарок…';
  setStatus('кладёт подарок…', true);
  await sleep(900);
  if (run !== state.run) return;
  fillSlot(left, THEIR_GIFT);
  setGram(left, THEIR_GRAM);
  setStatus('в сети');
  haptic();
  state.ready = true;
  updateHint();
  sheet.classList.add('open');
}

mySlot.addEventListener('click', () => {
  if (state.locked || !state.ready) return;
  if (state.mine) removeMine();
  sheet.classList.add('open');
});
myBtn.addEventListener('click', confirmMine);
$('#again').addEventListener('click', () => {
  haptic();
  start();
});

start();
