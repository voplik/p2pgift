const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready(); // no expand(): opens as a half-height sheet
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.('#050508');
  tg.setBackgroundColor?.('#050508');
  tg.setBottomBarColor?.('#050508');
}
const haptic = (type = 'light') => tg?.HapticFeedback?.impactOccurred(type);
const tick = () => tg?.HapticFeedback?.selectionChanged();
const notify = (type) => tg?.HapticFeedback?.notificationOccurred(type);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ICON = {
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  dia: '<svg class="ic dia" viewBox="0 0 24 24"><path d="M6.5 4h11l4 5.2L12 20.5 2.5 9.2z"/><path d="M2.5 9.2h19M9 4l-1.5 5.2L12 20.5l4.5-11.3L15 4"/></svg>',
  swap: '<svg class="ic swap" viewBox="0 0 24 24"><path d="M4 8h15m0 0-4-4m4 4-4 4M20 16H5m0 0 4-4m-4 4 4 4"/></svg>',
  done: '<svg class="check" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>',
};

/* ---------- springs ---------- */
// Simulates a damped spring and turns it into a CSS linear() easing, like SwiftUI's .spring()
function spring(stiffness, damping, mass = 1) {
  const dt = 1 / 120;
  let x = 0, v = 0, t = 0;
  const pts = [0];
  while (t < 3) {
    const a = (stiffness * (1 - x) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    pts.push(x);
    if (Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01) break;
  }
  const step = Math.max(1, Math.floor(pts.length / 48));
  const samples = pts.filter((_, i) => i % step === 0).concat(1).map((p) => +p.toFixed(4));
  return { easing: `linear(${samples.join(',')})`, duration: Math.round(t * 1000) };
}
const hasLinear = CSS.supports('transition-timing-function', 'linear(0, 1)');
const S = hasLinear
  ? { snappy: spring(380, 30), bouncy: spring(300, 19), soft: spring(180, 24), wobbly: spring(220, 13) }
  : Object.fromEntries(['snappy', 'bouncy', 'soft', 'wobbly'].map((k) => [k, { easing: 'cubic-bezier(.2,1.25,.4,1)', duration: 500 }]));
if (hasLinear) document.documentElement.style.setProperty('--spring', S.bouncy.easing);
const EASE_IOS = 'cubic-bezier(.32,.72,0,1)';

function anim(el, keyframes, s = S.snappy, extra = {}) {
  if (!el) return Promise.resolve();
  return el.animate(keyframes, { duration: s.duration, easing: s.easing, fill: 'both', ...extra }).finished.catch(() => {});
}
function tween(el, keyframes, duration, extra = {}) {
  return anim(el, keyframes, { duration, easing: EASE_IOS }, extra);
}
const clearAnims = (el) => el?.getAnimations().forEach((a) => a.cancel());
function countUp(el, from, to, ms, fmt) {
  const t0 = performance.now();
  const token = (el._count = (el._count || 0) + 1); // a newer count on the same element cancels this one
  const frame = (now) => {
    if (el._count !== token) return;
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
};

/* ---------- data ---------- */
const THEIR_GIFT = { id: 'cat', name: 'Scared Cat', num: '14081', sub: 'Azuki Siam', art: '🙀', bg: 'linear-gradient(135deg,#d8774f,#b04a2c)' };
const THEIR_GRAM = 350;
const MY_GIFTS = [
  { id: 'wand', name: 'Magic Torch', num: '249912', sub: 'Lilac Dream', art: '🪄', bg: 'linear-gradient(135deg,#7f8bff,#4e45d6)' },
  { id: 'pyr', name: 'Eye Pyramid', num: '19020', sub: 'Golden Age', art: '🔺', bg: 'linear-gradient(135deg,#f3b74a,#c97a1c)' },
  { id: 'ramen', name: 'Ramen Bowl', num: '3511', sub: 'Mint Broth', art: '🍜', bg: 'linear-gradient(135deg,#4fd1a5,#1f8f73)' },
  { id: 'dog', name: 'Resistance Dog', num: '8833', sub: 'Plush Pepe', art: '🐸', bg: 'linear-gradient(135deg,#e85a4f,#b52d2d)' },
];
const GRAM_OPTIONS = [0, 50, 100, 250, 500];
const MY_BALANCE = 1240;
const fmtNum = (n) => n.toLocaleString('ru-RU');
const HOLD_MS = 1500;

/* ---------- dom ---------- */
const trade = $('#trade');
const result = $('#result');
const app = $('.app');
const backdrop = $('#backdrop');
const giftSheet = $('#giftSheet');
const gramSheet = $('#gramSheet');
const head = $('#head');
const left = $('.left', trade);
const right = $('.right', trade);
const mySlot = $('.slot', right);
const myBtn = $('#confirm');
const theirBtn = $('.btn', left);
const tray = $('#tray');
const gramList = $('#gramList');
const gramBig = $('#gramBig');
const giftCount = $('#giftCount');
const balance = $('#balance');
const lock = $('.lock', trade);

let state;
const alive = (run) => run === state.run;

function giftEl(g) {
  const el = document.createElement('div');
  el.className = 'gift';
  el.style.background = g.bg;
  el.style.setProperty('--d', `${-Math.random() * 2.8}s`);
  el.innerHTML = `<span class="art">${g.art}</span><span class="num">#${g.num}</span>`;
  el.dataset.id = g.id;
  return el;
}

function setLabel(btn, html, animate = true) {
  const label = $('.label', btn);
  if (!animate) return void (label.innerHTML = html);
  tween(label, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-10px)', opacity: 0 }], 140).then(() => {
    label.innerHTML = html;
    anim(label, [{ transform: 'translateY(10px)', opacity: 0 }, { transform: 'none', opacity: 1 }], S.snappy);
  });
}

function setHead(html) {
  tween(head, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(4px)', transform: 'scale(.96)' }], 160).then(() => {
    head.innerHTML = html;
    anim(head, [{ opacity: 0, filter: 'blur(4px)', transform: 'scale(1.06)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], S.bouncy);
  });
}

function setSlotInfo(side, g) {
  const name = $('.gname', side);
  const sub = $('.gsub', side);
  name.textContent = g ? `${g.name} #${g.num}` : '';
  sub.textContent = g ? g.sub : '';
  if (g) [name, sub].forEach((n, i) => anim(n, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], S.soft, { delay: i * 50 }));
}

function putInSlot(side, g) {
  const slot = $('.slot', side);
  slot.querySelector('.gift')?.remove();
  slot.classList.add('filled');
  $('.plus', slot).style.opacity = 0;
  const el = giftEl(g);
  slot.append(el);
  setSlotInfo(side, g);
  return el;
}

function emptySlot(side, animate = true) {
  const slot = $('.slot', side);
  slot.querySelector('.gift')?.remove();
  slot.classList.remove('filled');
  const plus = $('.plus', slot);
  plus.style.opacity = '';
  if (animate) anim(plus, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], S.bouncy);
  setSlotInfo(side, null);
}

function setGram(side, from, to, sign = '') {
  const g = $('.gram', side);
  const gv = $('.gv', g);
  g.classList.toggle('on', to > 0);
  if (to > 0) {
    countUp(gv, from, to, 500, (n) => `${sign}${n} GRAM`);
    anim(gv, [{ transform: 'scale(.8)' }, { transform: 'none' }], S.wobbly);
  } else {
    // back to the empty pill: stop any running count and clear the number
    gv._count = (gv._count || 0) + 1;
    if (gv.textContent !== 'GRAM') {
      gv.textContent = 'GRAM';
      anim(gv, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], S.snappy);
    }
  }
}

/* Moves a copy of `fromEl` onto `toEl` with a spring, like a matched-geometry transition */
async function fly(fromEl, toEl, g, { lift = 0, rotate = 0, s = S.soft } = {}) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const clone = giftEl(g);
  clone.classList.add('fly');
  Object.assign(clone.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
  document.body.append(clone);
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  const k = a.width / b.width;
  await anim(clone, [
    { transform: `translate(${dx}px, ${dy}px) scale(${k}) rotate(${rotate}deg)` },
    ...(lift ? [{ transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(${(k + 1) / 2 + 0.1}) rotate(${rotate / 2}deg)`, offset: 0.45 }] : []),
    { transform: 'none' },
  ], s);
  return clone;
}

/* ---------- effects ---------- */
function ripple(el, { color = 'rgba(255,255,255,.55)', count = 2, scale = 1.9 } = {}) {
  const c = center(el);
  const size = Math.max(c.w, c.h);
  for (let i = 0; i < count; i++) {
    const r = document.createElement('div');
    r.className = 'ring';
    Object.assign(r.style, { left: c.x - size / 2 + 'px', top: c.y - size / 2 + 'px', width: size + 'px', height: size + 'px', borderColor: color });
    document.body.append(r);
    r.animate([{ transform: 'scale(.9)', opacity: 0.9 }, { transform: `scale(${scale})`, opacity: 0 }],
      { duration: 900, delay: i * 180, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }).finished.then(() => r.remove());
  }
}

function particles(el, n = 18) {
  const c = center(el);
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    Object.assign(d.style, { left: c.x + 'px', top: c.y + 'px' });
    document.body.append(d);
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + 0.9;
    const r0 = c.w * 0.55;
    const r1 = c.w * (1.2 + Math.random() * 0.5);
    const am = (a0 + a1) / 2;
    const rm = (r0 + r1) / 2;
    d.animate([
      { transform: `translate(${Math.cos(a0) * r0}px, ${Math.sin(a0) * r0}px) scale(.5)`, opacity: 0 },
      { transform: `translate(${Math.cos(am) * rm}px, ${Math.sin(am) * rm}px) scale(1.2)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${Math.cos(a1) * r1}px, ${Math.sin(a1) * r1}px) scale(.4)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }).finished.then(() => d.remove());
  }
}

/* ---------- inserting your gift ---------- */
async function placeMine(id, fromEl) {
  const g = MY_GIFTS.find((x) => x.id === id);
  if (!g || state.locked || !state.ready || state.busy) return;
  state.busy = true;
  const run = state.run;
  if (state.mine) await removeMine(true);
  state.mine = g;
  updateCount();
  const tile = tray.querySelector(`[data-id="${id}"]`);
  const source = fromEl || tile;
  // the tray tile becomes an empty placeholder
  tile?.classList.add('used');
  anim(tile, [{ transform: 'scale(.9)' }, { transform: 'none' }], S.bouncy);
  haptic('light');
  $('.plus', mySlot).style.opacity = 0;
  const clone = await fly(source, mySlot, g, { lift: fromEl ? 0 : 50, rotate: fromEl ? 10 : -10, s: S.soft });
  clone.remove();
  if (!alive(run)) return;
  const el = putInSlot(right, g);
  // lands tilted, then straightens itself; the slot gives a little under the weight
  anim(el, [{ transform: 'rotate(8deg) scale(1.08)' }, { transform: 'rotate(-3deg) scale(.98)', offset: 0.45 }, { transform: 'none' }], S.wobbly);
  anim(mySlot, [{ transform: 'scale(.92)' }, { transform: 'none' }], S.wobbly);
  // the counterpart's gift twitches as if it noticed
  anim($('.slot .gift', left), [{ transform: 'none' }, { transform: 'rotate(-4deg) scale(1.03)', offset: 0.3 }, { transform: 'none' }], S.wobbly, { delay: 120 });
  haptic('medium');
  myBtn.disabled = false;
  state.busy = false;
}

async function removeMine(quiet) {
  const g = state.mine;
  const giftInSlot = mySlot.querySelector('.gift');
  const target = tray.querySelector(`[data-id="${g.id}"]`);
  state.mine = null;
  updateCount();
  myBtn.disabled = true;
  if (!quiet) haptic('light');
  if (giftInSlot && target) {
    giftInSlot.style.opacity = 0;
    const p = fly(giftInSlot, target, g, { lift: 30, s: S.snappy }).then((c) => {
      c.remove();
      target.classList.remove('used');
      anim(target, [{ transform: 'scale(1.1)' }, { transform: 'none' }], S.wobbly);
    });
    emptySlot(right);
    if (!quiet) await p;
  } else {
    emptySlot(right);
    target?.classList.remove('used');
  }
}

function updateCount() {
  const n = MY_GIFTS.length - (state.mine ? 1 : 0);
  if (giftCount.textContent !== String(n)) {
    giftCount.textContent = n;
    anim(giftCount.parentElement, [{ transform: 'scale(.85)' }, { transform: 'none' }], S.wobbly);
  }
}

function selectGram(i, silent) {
  if (state.locked) return;
  const prev = state.gramIndex;
  state.gramIndex = i;
  $$('.row', gramList).forEach((r, j) => r.classList.toggle('on', j === i));
  if (silent) {
    gramBig.textContent = GRAM_OPTIONS[i];
    return;
  }
  tick();
  countUp(gramBig, GRAM_OPTIONS[prev], GRAM_OPTIONS[i], 380, (n) => n);
  anim(gramBig.parentElement, [{ transform: 'scale(.9)' }, { transform: 'none' }], S.wobbly);
  setGram(right, GRAM_OPTIONS[prev], GRAM_OPTIONS[i]);
}

/* ---------- iOS sheets ---------- */
let openSheetEl = null;
const curTransform = (el) => getComputedStyle(el).transform;
const curOpacity = (el) => getComputedStyle(el).opacity;

function setBehind(on, s = S.soft) {
  // the page behind recedes like an iOS card stack
  const from = { transform: curTransform(app), filter: getComputedStyle(app).filter };
  clearAnims(app);
  const to = on ? { transform: 'scale(.94)', filter: 'brightness(.8)' } : { transform: 'none', filter: 'none' };
  const p = on ? anim(app, [from, to], s) : tween(app, [from, to], 320);
  if (!on) p.then(() => clearAnims(app));
  const bo = curOpacity(backdrop);
  clearAnims(backdrop);
  tween(backdrop, [{ opacity: bo }, { opacity: on ? 1 : 0 }], on ? 320 : 280);
  backdrop.classList.toggle('on', on);
}

function openSheet(sh) {
  if (openSheetEl === sh || state.locked) return;
  if (openSheetEl) closeSheet();
  openSheetEl = sh;
  sh.classList.add('open');
  sh.style.transform = '';
  clearAnims(sh);
  anim(sh, [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], S.soft);
  setBehind(true);
  haptic('light');
  if (sh === giftSheet) {
    $$('.gift', tray).forEach((g, i) =>
      anim(g, [{ opacity: 0, transform: 'translateY(24px) scale(.8)' }, { opacity: 1, transform: 'none' }], S.bouncy, { delay: 60 + i * 40 })
        .then(() => clearAnims(g)));
  }
}

async function closeSheet() {
  const sh = openSheetEl;
  if (!sh) return;
  openSheetEl = null;
  const from = curTransform(sh);
  clearAnims(sh);
  sh.style.transform = '';
  setBehind(false);
  await tween(sh, [{ transform: from }, { transform: 'translateY(110%)' }], 300);
  if (openSheetEl !== sh) {
    sh.classList.remove('open');
    clearAnims(sh);
  }
}

/* while a gift is dragged, the sheet ducks so the table is visible */
function peekSheet(on) {
  if (openSheetEl !== giftSheet) return;
  const from = curTransform(giftSheet);
  clearAnims(giftSheet);
  anim(giftSheet, [{ transform: from }, { transform: on ? 'translateY(64%)' : 'translateY(0)' }], S.snappy);
  const bo = curOpacity(backdrop);
  clearAnims(backdrop);
  tween(backdrop, [{ opacity: bo }, { opacity: on ? 0.25 : 1 }], 250);
}

/* swipe down on the grabber/header to dismiss, with rubber-banding upwards */
function attachSheetSwipe(sh) {
  const zone = [$('.grab-zone', sh), $('.sheet-head', sh)];
  zone.forEach((z) => z.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-close]') || openSheetEl !== sh) return;
    const y0 = e.clientY;
    const t0 = performance.now();
    const base = curTransform(sh);
    clearAnims(sh);
    sh.style.transform = base === 'none' ? 'translateY(0)' : base;
    const h = sh.offsetHeight;
    let dy = 0;
    const move = (ev) => {
      dy = ev.clientY - y0;
      const y = dy > 0 ? dy : -Math.pow(-dy, 0.7); // resist pulling up
      sh.style.transform = `translateY(${y}px)`;
      backdrop.style.opacity = Math.max(0, 1 - Math.max(0, dy) / h);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      backdrop.style.opacity = '';
      const v = dy / (performance.now() - t0);
      if (dy > h * 0.3 || v > 0.6) {
        closeSheet();
      } else {
        const from = sh.style.transform;
        sh.style.transform = '';
        anim(sh, [{ transform: from }, { transform: 'translateY(0)' }], S.bouncy);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }));
  $$('[data-close]', sh).forEach((b) => b.addEventListener('click', () => { haptic('light'); closeSheet(); }));
}
attachSheetSwipe(giftSheet);
attachSheetSwipe(gramSheet);
backdrop.addEventListener('click', () => closeSheet());

/* ---------- hold to confirm ---------- */
let hold = null;
let hintShown = false;

function startHold(e) {
  if (myBtn.disabled || !state.mine || state.locked || state.busy) return;
  e.preventDefault();
  try { myBtn.setPointerCapture(e.pointerId); } catch {}
  const fills = [$('.fill', myBtn), $('.fill', theirBtn)];
  fills.forEach(clearAnims);
  const mine = fills[0].animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
    { duration: HOLD_MS, easing: 'cubic-bezier(.3,0,.6,1)', fill: 'both' });
  // the counterpart "confirms" alongside you, slightly behind
  const theirs = fills[1].animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(.92)' }],
    { duration: HOLD_MS, delay: 150, easing: 'cubic-bezier(.3,0,.6,1)', fill: 'both' });
  const sub = $('.sub', left);
  clearAnims(sub);
  sub.textContent = 'подтверждает…';
  sub.classList.add('on');
  anim(sub, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], S.soft);
  anim(myBtn, [{ transform: 'scale(1)' }, { transform: 'scale(.96)' }], S.snappy);
  myBtn.classList.add('holding');
  theirBtn.classList.add('active');
  haptic('light');
  const ticker = setInterval(tick, HOLD_MS / 8);
  hold = { mine, theirs, ticker };
  mine.finished.then(() => {
    if (hold?.mine !== mine) return;
    clearInterval(ticker);
    hold = null;
    myBtn.classList.remove('holding');
    confirmBoth();
  }).catch(() => {});
}

function releaseHold() {
  if (!hold) return;
  const { mine, theirs, ticker } = hold;
  hold = null;
  clearInterval(ticker);
  myBtn.classList.remove('holding');
  theirBtn.classList.remove('active');
  anim(myBtn, [{ transform: 'scale(.96)' }, { transform: 'none' }], S.bouncy);
  const sub = $('.sub', left);
  tween(sub, [{ opacity: 1 }, { opacity: 0 }], 200).then(() => { sub.textContent = ''; sub.classList.remove('on'); clearAnims(sub); });
  const p = mine.effect.getComputedTiming().progress || 0;
  [[mine, $('.fill', myBtn), 1], [theirs, $('.fill', theirBtn), 0.92]].forEach(([a, el, max]) => {
    const q = a.effect.getComputedTiming().progress || 0;
    a.cancel();
    anim(el, [{ transform: `scaleX(${q * max})` }, { transform: 'scaleX(0)' }], S.snappy);
  });
  if (p < 0.35 && !hintShown) {
    // a quick tap: nudge the user to hold instead
    hintShown = true;
    anim(myBtn, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }], { duration: 380, easing: 'ease-out' });
    notify('warning');
    setLabel(myBtn, 'Удерживайте');
    setTimeout(() => {
      hintShown = false;
      if (!state.locked) setLabel(myBtn, 'Подтвердить');
    }, 1300);
  }
}

myBtn.addEventListener('pointerdown', startHold);
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => myBtn.addEventListener(t, releaseHold));
myBtn.addEventListener('contextmenu', (e) => e.preventDefault());

function addOk(side) {
  const ok = document.createElement('span');
  ok.className = 'ok';
  ok.innerHTML = ICON.check;
  $('.side-head', side).append(ok);
  anim(ok, [{ transform: 'scale(0) rotate(-90deg)' }, { transform: 'none' }], S.wobbly);
}

function markConfirmed(btn, side) {
  const fill = $('.fill', btn);
  btn.classList.add('green');
  setLabel(btn, ICON.check + 'Подтверждено');
  // the violet fill dissolves into green instead of snapping
  tween(fill, [{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 0, transform: 'scaleX(1)' }], 400).then(() => clearAnims(fill));
  if (btn === myBtn) anim(btn, [{ transform: 'scale(.96)' }, { transform: 'none' }], S.bouncy);
  addOk(side);
}

/* ---------- 1. confirmation with the lock ---------- */
async function confirmBoth() {
  const run = state.run;
  state.locked = true;
  closeSheet();
  markConfirmed(myBtn, right);
  haptic('heavy');

  // counterpart finishes their part
  const theirFill = $('.fill', theirBtn);
  const q = theirFill.getAnimations()[0]?.effect.getComputedTiming().progress ?? 1;
  clearAnims(theirFill);
  await anim(theirFill, [{ transform: `scaleX(${q * 0.92})` }, { transform: 'scaleX(1)' }], S.soft);
  if (!alive(run)) return;
  const sub = $('.sub', left);
  sub.classList.remove('on');
  sub.textContent = '';
  markConfirmed(theirBtn, left);
  haptic('heavy');

  await sleep(250);
  if (!alive(run)) return;
  // lock snaps shut, card lights up, sparks orbit the lock
  lock.classList.add('armed');
  trade.classList.add('armed');
  anim(lock, [{ transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-8deg)', offset: 0.3 }, { transform: 'scale(.92)', offset: 0.6 }, { transform: 'none' }], S.wobbly);
  particles(lock);
  haptic('rigid');
  await sleep(850);
  if (!alive(run)) return;

  await swap(run);
  if (!alive(run)) return;
  await success(run);
}

/* ---------- 2. the swap ---------- */
async function swap(run) {
  const a = $('.slot .gift', left);
  const b = $('.slot .gift', right);
  const ra = a.getBoundingClientRect();
  const rb = b.getBoundingClientRect();
  const pill = $('.gram.on', left);
  const make = (el, r, z) => {
    const c = el.cloneNode(true);
    c.classList.add('fly');
    Object.assign(c.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: z, margin: 0 });
    document.body.append(c);
    return c;
  };
  const ca = make(a, ra, 101);
  const cb = make(b, rb, 102);
  const cp = pill && make(pill, pill.getBoundingClientRect(), 103);
  a.style.opacity = b.style.opacity = 0;
  if (pill) pill.style.opacity = 0;

  // names fade away while gifts are in the air
  const texts = $$('.gname, .gsub', trade);
  texts.forEach((t) => tween(t, [{ opacity: 1 }, { opacity: 0, filter: 'blur(3px)' }], 180));

  // anticipation: both lift and tilt
  haptic('soft');
  await Promise.all([
    anim(ca, [{ transform: 'none' }, { transform: 'scale(1.08) rotate(-6deg)' }], S.snappy),
    anim(cb, [{ transform: 'none' }, { transform: 'scale(1.12) rotate(6deg)' }], S.snappy),
  ]);
  if (!alive(run)) return;

  const dx = rb.left - ra.left;
  const opts = { duration: 820, easing: 'cubic-bezier(.6,0,.25,1)', fill: 'both' };
  await Promise.all([
    ca.animate([
      { transform: 'scale(1.08) rotate(-6deg)', filter: 'blur(0)' },
      { transform: `translate(${dx * 0.5}px, 34px) scale(.92) rotate(8deg)`, filter: 'blur(2.5px)', offset: 0.5 },
      { transform: `translate(${dx}px, 0) scale(1.04) rotate(4deg)`, filter: 'blur(0)' },
    ], opts).finished,
    cb.animate([
      { transform: 'scale(1.12) rotate(6deg)', filter: 'blur(0)' },
      { transform: `translate(${-dx * 0.5}px, -42px) scale(1.22) rotate(-10deg)`, filter: 'blur(2.5px)', offset: 0.5 },
      { transform: `translate(${-dx}px, 0) scale(1.06) rotate(-4deg)`, filter: 'blur(0)' },
    ], opts).finished,
    cp && cp.animate([
      { transform: 'none', filter: 'blur(0)' },
      { transform: `translate(${dx * 0.5}px, 10px) scale(1.05)`, filter: 'blur(3px)', offset: 0.5 },
      { transform: `translate(${dx}px, 0)`, filter: 'blur(0)' },
    ], { ...opts, delay: 60 }).finished,
  ]);
  if (!alive(run)) return;

  // land: real gifts swap places and settle with a wobble
  ca.remove(); cb.remove(); cp?.remove();
  if (pill) pill.style.opacity = '';
  const ga = putInSlot(left, state.mine);
  const gb = putInSlot(right, THEIR_GIFT);
  anim(ga, [{ transform: 'scale(1.06) rotate(-4deg)' }, { transform: 'none' }], S.wobbly);
  anim(gb, [{ transform: 'scale(1.04) rotate(4deg)' }, { transform: 'none' }], S.wobbly);
  texts.forEach(clearAnims);
  setGram(left, 0, GRAM_OPTIONS[state.gramIndex], '+');
  setGram(right, 0, THEIR_GRAM, '+');
  haptic('heavy');
}

/* ---------- 3. success ---------- */
async function success(run) {
  ripple($('.slot', left));
  ripple($('.slot', right));
  lock.classList.remove('armed');
  lock.classList.add('done');
  anim(lock, [{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.35 }, { transform: 'none' }], S.wobbly);
  ripple(lock, { color: 'rgba(48,209,88,.7)', count: 2, scale: 2.6 });
  trade.classList.remove('armed');
  setHead(`${ICON.done}<span>Обмен завершён</span>`);
  setTimeout(() => {
    const p = $('#head .check path');
    if (p) tween(p, [{ strokeDashoffset: 20 }, { strokeDashoffset: 0 }], 420);
  }, 200);
  notify('success');

  await sleep(1500);
  if (!alive(run)) return;
  await collapseToResult(run);
}

/* the full card dims and folds into the compact summary */
async function collapseToResult(run) {
  const dims = $$('.side-head, .gname, .gsub, .gram, .btn, .lock', trade);
  dims.forEach((el) => tween(el, [{ opacity: 1 }, { opacity: 0.35 }], 300));
  await sleep(380);
  if (!alive(run)) return;

  const ra = $('.slot .gift', left).getBoundingClientRect();
  const rb = $('.slot .gift', right).getBoundingClientRect();
  const h0 = trade.offsetHeight;

  // build the summary
  const d = new Date();
  $('#time').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sent = giftEl(state.mine);
  const got = giftEl(THEIR_GIFT);
  $('#sent').replaceChildren(sent, 'отправлено');
  $('#got').replaceChildren(got, 'получено');
  $('#diff').textContent = `+${THEIR_GRAM} GRAM`;
  $('.check path', result).style.strokeDashoffset = 0;

  trade.hidden = true;
  result.hidden = false;
  const h1 = result.offsetHeight;
  dims.forEach(clearAnims);

  // container morphs in height, labels fade in, gifts glide from their slots into the summary
  [$('.trade-head', result), $('.mid', result), $('#again')].forEach((el, i) =>
    anim(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], S.soft, { delay: 120 + i * 60 }));
  anim(result, [{ height: h0 + 'px' }, { height: h1 + 'px' }], S.soft).then(() => clearAnims(result));
  const glide = (el, r) => {
    const t = el.getBoundingClientRect();
    return anim(el, [
      { transform: `translate(${r.left - t.left}px, ${r.top - t.top}px) scale(${r.width / t.width})` },
      { transform: 'none' },
    ], S.soft);
  };
  await Promise.all([glide(sent, ra), glide(got, rb)]);
  if (!alive(run)) return;
  anim($('.arrows', result), [{ transform: 'rotate(-180deg) scale(.5)' }, { transform: 'none' }], S.soft);
}

/* ---------- tray, segmented control, drag ---------- */
function renderPicker() {
  tray.textContent = '';
  MY_GIFTS.forEach((g) => {
    const el = giftEl(g);
    tray.append(el);
    attachDrag(el, g.id);
  });

  gramList.textContent = '';
  GRAM_OPTIONS.forEach((v, i) => {
    const r = document.createElement('button');
    r.className = 'row';
    r.innerHTML = `${ICON.dia}<span class="grow">${v ? `${v} GRAM` : 'Без доплаты'}</span>` +
      '<svg class="ic tick" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    r.disabled = v > MY_BALANCE;
    r.onclick = () => selectGram(i);
    gramList.append(r);
  });
  balance.textContent = fmtNum(MY_BALANCE);
  giftCount.textContent = MY_GIFTS.length;
  state.gramIndex = 0;
  selectGram(0, true);
}

function attachDrag(el, id) {
  el.addEventListener('pointerdown', (e) => {
    if (state.locked || !state.ready || state.busy) return;
    if (el.classList.contains('used')) {
      // tapping the empty tile of the gift on the table takes it back
      if (state.mine?.id === id) removeMine();
      return;
    }
    e.preventDefault();
    el.classList.add('pressed');
    const sx = e.clientX;
    const sy = e.clientY;
    const r0 = el.getBoundingClientRect();
    let ghost = null;
    let wasOver = false;
    const g = MY_GIFTS.find((x) => x.id === id);

    const overSlot = (x, y) => {
      const r = mySlot.getBoundingClientRect();
      return x > r.left - 24 && x < r.right + 24 && y > r.top - 24 && y < r.bottom + 24;
    };
    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        // pick up: lifts out of the tray, tilts, leaves an empty tile behind
        ghost = giftEl(g);
        ghost.classList.add('fly', 'ghost');
        Object.assign(ghost.style, { left: r0.left + 'px', top: r0.top + 'px', width: r0.width + 'px', height: r0.height + 'px' });
        document.body.append(ghost);
        el.classList.remove('pressed');
        el.classList.add('used');
        anim(ghost, [{ scale: '1', rotate: '0deg' }, { scale: '1.22', rotate: '10deg' }], S.bouncy);
        peekSheet(true);
        haptic('light');
      }
      if (!ghost) return;
      const over = overSlot(ev.clientX, ev.clientY);
      let tx = ev.clientX - sx;
      let ty = ev.clientY - sy;
      if (over) {
        // magnet: pull the ghost toward the slot centre
        const c = center(mySlot);
        tx += (c.x - (r0.left + r0.width / 2 + tx)) * 0.45;
        ty += (c.y - (r0.top + r0.height / 2 + ty)) * 0.45;
      }
      ghost.style.translate = `${tx}px ${ty}px`;
      if (over !== wasOver) {
        wasOver = over;
        mySlot.classList.toggle('drop', over);
        anim(ghost, [{ rotate: over ? '10deg' : '3deg' }, { rotate: over ? '3deg' : '10deg' }], S.snappy);
        if (over) haptic('light');
      }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.classList.remove('pressed');
      mySlot.classList.remove('drop');
      if (ghost) {
        if (overSlot(ev.clientX, ev.clientY)) {
          el.classList.remove('used');
          placeMine(id, ghost).then(() => ghost.remove());
          ghost.style.visibility = 'hidden';
          closeSheet();
        } else {
          // spring back to the tray
          const t = ghost.style.translate;
          clearAnims(ghost);
          ghost.style.translate = '';
          peekSheet(false);
          anim(ghost, [{ translate: t, scale: '1.22', rotate: '10deg' }, { translate: '0px 0px', scale: '1', rotate: '0deg' }], S.snappy)
            .then(() => { ghost.remove(); el.classList.remove('used'); });
        }
      } else if (ev.type === 'pointerup') {
        placeMine(id);
        closeSheet();
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/* ---------- lifecycle ---------- */
async function start(first) {
  const run = Date.now();
  state = { run, mine: null, gramIndex: 0, locked: false, ready: false, busy: false };
  closeSheet();
  document.querySelectorAll('.fly, .dot, .ring').forEach((n) => n.remove());

  clearAnims(trade);
  trade.hidden = false;
  result.hidden = true;
  trade.classList.remove('armed');
  lock.classList.remove('done', 'armed');
  head.innerHTML = `${ICON.swap}<span id="phase">Обмен</span>`;
  [left, right].forEach((side) => {
    emptySlot(side, false);
    setGram(side, 0, 0);
    const btn = $('.btn', side);
    btn.className = 'btn';
    btn.disabled = true;
    setLabel(btn, 'Подтвердить', false);
    clearAnims($('.fill', btn));
    $('.side-head .ok', side)?.remove();
  });
  const sub = $('.sub', left);
  sub.textContent = '';
  sub.classList.remove('on');
  renderPicker();

  // 1) empty glass card, then its contents fade in one by one
  const parts = [head, ...$$('.side-head', trade), $('.slot', left), lock, mySlot, ...$$('.gram', trade), theirBtn, myBtn];
  const rest = parts.map((p) => getComputedStyle(p).opacity); // disabled buttons rest at .4 — fade to that, not to 1
  parts.forEach((p) => p.animate([{ opacity: 0 }], { duration: 1, fill: 'both' }));
  await anim(trade, [{ opacity: 0, transform: 'translateY(20px) scale(.96)' }, { opacity: 1, transform: 'none' }], S.soft);
  if (!alive(run)) return;
  parts.forEach((p, i) =>
    anim(p, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: rest[i], transform: 'none' }], S.soft, { delay: i * 45 }).then(() => clearAnims(p)));

  // 3) counterpart's gift materialises out of the dark
  await sleep(500);
  if (!alive(run)) return;
  const g = putInSlot(left, THEIR_GIFT);
  anim(g, [
    { opacity: 0, transform: 'scale(.55)', filter: 'brightness(.2) blur(6px)' },
    { opacity: 1, transform: 'scale(.8)', filter: 'brightness(.5) blur(2px)', offset: 0.35 },
    { opacity: 1, transform: 'none', filter: 'brightness(1) blur(0)' },
  ], S.bouncy).then(() => clearAnims(g));
  haptic('medium');
  setGram(left, 0, THEIR_GRAM);
  state.ready = true;
  // gentle invite on your empty slot
  anim(mySlot, [{ transform: 'scale(1)' }, { transform: 'scale(1.05)', offset: 0.4 }, { transform: 'scale(1)' }], S.wobbly, { delay: 600 });
}

// "+" (or your gift) opens the gift sheet; your GRAM pill opens the GRAM picker
mySlot.addEventListener('click', () => {
  if (state.locked || !state.ready || state.busy) return;
  openSheet(giftSheet);
});
const myGram = $('.gram', right);
myGram.classList.add('tappable');
myGram.addEventListener('click', () => {
  if (state.locked || !state.ready) return;
  openSheet(gramSheet);
});
$('#again').addEventListener('click', async () => {
  haptic('light');
  await tween(result, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.95)' }], 200);
  clearAnims(result);
  start(false);
});

start(true);
