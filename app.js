const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready(); // no expand(): opens as a half-height sheet
  tg.disableVerticalSwipes?.();
  tg.setHeaderColor?.('#050508');
  tg.setBackgroundColor?.('#050508');
  tg.setBottomBarColor?.('#050508');
}
// compact sheet layout when Telegram shows only part of the screen (half-height mode)
const fitViewport = () => {
  const h = tg?.viewportStableHeight || window.innerHeight;
  document.documentElement.classList.toggle('short', h < 520);
};
fitViewport();
tg?.onEvent?.('viewportChanged', fitViewport);
window.addEventListener('resize', fitViewport);
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
// real Telegram collectibles, downloaded by tools/fetch-gifts.mjs into ./gifts
const THEIR_SLUG = 'ScaredCat-14081';
const MY_SLUGS = ['ResistanceDog-5', 'ResistanceDog-8', 'LolPop-1', 'PlushPepe-1', 'ToyBear-10', 'DurovsCap-10', 'KissedFrog-10'];
let THEIR_GIFT = null;
let MY_GIFTS = [];
const THEIR_GRAM = 350;
const lottieCache = new Map();

async function loadGifts() {
  const index = await (await fetch('gifts/index.json?v=1')).json();
  const toGift = (d) => ({
    id: d.slug, name: d.name, num: d.num, sub: d.model?.value || '',
    c1: d.colors.center, c2: d.colors.edge, pc: d.colors.pattern,
    symbol: d.files.symbol && `gifts/${d.files.symbol}`, lottie: `gifts/${d.files.lottie}`,
  });
  THEIR_GIFT = toGift(index[THEIR_SLUG]);
  MY_GIFTS = MY_SLUGS.filter((s) => index[s]).map((s) => toGift(index[s]));
  // warm the animation cache so gifts appear instantly
  await Promise.all([THEIR_GIFT, ...MY_GIFTS].map((g) => lottieText(g)));
}
function lottieText(g) {
  if (!lottieCache.has(g.lottie)) lottieCache.set(g.lottie, fetch(g.lottie).then((r) => r.text()));
  return lottieCache.get(g.lottie);
}

/* symbols scattered around the gift like on Telegram's backdrop: [x%, y%, size%] */
const PATTERN = [[50, 9, 13], [20, 20, 11], [80, 20, 11], [8, 48, 10], [92, 48, 10], [18, 80, 11], [82, 80, 11], [50, 92, 11], [35, 4, 7], [65, 4, 7]];
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
  el.dataset.id = g.id;
  el.style.setProperty('--c1', g.c1);
  el.style.setProperty('--c2', g.c2);
  el.style.setProperty('--pc', g.pc);
  el.innerHTML = '<div class="face"><div class="pattern"></div><div class="sticker"></div></div>' +
    `<span class="ribbon"><b>#${g.num}</b></span>`;
  if (g.symbol) {
    const p = $('.pattern', el);
    const url = `url("${g.symbol}")`;
    p.style.webkitMaskImage = p.style.maskImage = PATTERN.map(() => url).join(',');
    p.style.webkitMaskPosition = p.style.maskPosition = PATTERN.map(([x, y]) => `${x}% ${y}%`).join(',');
    p.style.webkitMaskSize = p.style.maskSize = PATTERN.map(([, , s]) => `${s}% ${s}%`).join(',');
  }
  // the Telegram sticker animation (Lottie from the .tgs)
  const host = $('.sticker', el);
  lottieText(g).then((txt) => {
    if (!window.lottie || !el.isConnected) return; // already gone (e.g. a short-lived flying copy)
    host._anim = window.lottie?.loadAnimation({
      container: host, renderer: 'svg', loop: true, autoplay: true, animationData: JSON.parse(txt),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true },
    });
  });
  return el;
}

// stop and free Lottie players when their gift leaves the page
new MutationObserver((list) => list.forEach((m) => m.removedNodes.forEach((n) => {
  if (n.nodeType !== 1) return;
  const hosts = n.classList?.contains('sticker') ? [n] : n.querySelectorAll?.('.sticker') || [];
  hosts.forEach((h) => { if (!h.isConnected && h._anim) { h._anim.destroy(); h._anim = null; } });
}))).observe(document.body, { childList: true, subtree: true });

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
  const b = settledRect(toEl);
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

/* evenly spaced dots flying out in a ring — the burst around the lock in the video */
function particles(el, { rings = [[16, 2.7, 0], [10, 1.9, 120]], color = '#d4caff' } = {}) {
  const c = center(el);
  const r0 = c.w * 0.55;
  rings.forEach(([n, reach, delay]) => {
    const spin = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'dot';
      Object.assign(d.style, { left: c.x + 'px', top: c.y + 'px', background: color });
      document.body.append(d);
      const ang = spin + (i / n) * Math.PI * 2;
      const r1 = c.w * reach;
      d.animate([
        { transform: `translate(${Math.cos(ang) * r0}px, ${Math.sin(ang) * r0}px) scale(1.4)`, opacity: 0 },
        { transform: `translate(${Math.cos(ang) * (r0 + r1) / 2}px, ${Math.sin(ang) * (r0 + r1) / 2}px) scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${Math.cos(ang + 0.25) * r1}px, ${Math.sin(ang + 0.25) * r1}px) scale(.3)`, opacity: 0 },
      ], { duration: 1000, delay, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'both' }).finished.then(() => d.remove());
    }
  });
}

/* a small confetti pop for the finished trade */
function confetti(el, n = 26) {
  const c = center(el);
  const colors = ['#30d158', '#0a84ff', '#bf5af2', '#ffd60a', '#ff9f0a', '#64d2ff', '#ff375f'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'spark';
    const round = i % 3 === 0;
    Object.assign(p.style, { left: c.x + 'px', top: c.y + 'px', background: colors[i % colors.length],
      width: round ? '6px' : '5px', height: round ? '6px' : '10px', borderRadius: round ? '50%' : '2px' });
    document.body.append(p);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4; // mostly upwards
    const v = 70 + Math.random() * 90;
    const x = Math.cos(ang) * v;
    const y = Math.sin(ang) * v;
    p.animate([
      { transform: 'translate(0,0) rotate(0) scale(.3)', opacity: 1 },
      { transform: `translate(${x}px, ${y}px) rotate(${Math.random() * 360}deg) scale(1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${x * 1.25}px, ${y + 140}px) rotate(${360 + Math.random() * 540}deg) scale(.8)`, opacity: 0 },
    ], { duration: 1300 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' }).finished.then(() => p.remove());
  }
}

/* a sticker-like twitch: quick shake that settles */
function twitch(el, strength = 1) {
  if (!el) return;
  const k = strength;
  anim(el, [
    { transform: 'none' },
    { transform: `rotate(${-7 * k}deg) scale(${1 + 0.06 * k})`, offset: 0.15 },
    { transform: `rotate(${6 * k}deg) scale(${1 + 0.04 * k})`, offset: 0.35 },
    { transform: `rotate(${-3 * k}deg)`, offset: 0.6 },
    { transform: 'none' },
  ], { duration: 650, easing: 'ease-out' });
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
  const clone = await fly(source, mySlot, g, { lift: fromEl ? 0 : 40, s: S.soft });
  clone.remove();
  if (!alive(run)) return;
  putInSlot(right, g);
  // no shaking — the gift just settles in with a ripple
  ripple(mySlot, { count: 2, scale: 1.6, color: 'rgba(255,255,255,.45)' });
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

let behindToken = 0;
function setBehind(on) {
  // the page behind recedes like an iOS card stack, and comes back along the same spring
  const token = ++behindToken;
  const from = { transform: curTransform(app), filter: getComputedStyle(app).filter };
  clearAnims(app);
  const to = on ? { transform: 'scale(.94)', filter: 'brightness(.8)' } : { transform: 'none', filter: 'brightness(1)' };
  anim(app, [from, to], S.soft).then(() => {
    // only tidy up if nothing newer took over meanwhile
    if (!on && token === behindToken) clearAnims(app);
  });
  const bo = curOpacity(backdrop);
  clearAnims(backdrop);
  tween(backdrop, [{ opacity: bo }, { opacity: on ? 1 : 0 }], on ? 320 : 420);
  backdrop.classList.toggle('on', on);
}

/* where an element will be once the page behind has settled (used to aim flying gifts while it springs back) */
function settledRect(el) {
  const as = app.getAnimations();
  if (!as.length) return el.getBoundingClientRect();
  const saved = as.map((a) => a.currentTime);
  as.forEach((a) => { a.currentTime = a.effect.getComputedTiming().endTime - 1; });
  const r = el.getBoundingClientRect();
  as.forEach((a, i) => { a.currentTime = saved[i]; });
  return r;
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
  await tween(sh, [{ transform: from }, { transform: 'translateY(110%)' }], 420);
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
  ripple(lock, { color: 'rgba(124,92,255,.8)', count: 1, scale: 2.2 });
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
  // both GRAM pills trade sides together with the gifts
  const pill = $('.gram', left);
  const pill2 = $('.gram', right);
  const make = (el, r, z) => {
    const c = el.cloneNode(true);
    c.classList.add('fly');
    Object.assign(c.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: z, margin: 0 });
    document.body.append(c);
    return c;
  };
  const ca = make(a, ra, 101);
  const cb = make(b, rb, 102);
  const cp = make(pill, pill.getBoundingClientRect(), 103);
  const cq = make(pill2, pill2.getBoundingClientRect(), 104);
  a.style.opacity = b.style.opacity = 0;
  pill.style.opacity = pill2.style.opacity = 0;

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
    cp.animate([
      { transform: 'none', filter: 'blur(0)' },
      { transform: `translate(${dx * 0.5}px, 12px) scale(.95)`, filter: 'blur(3px)', offset: 0.5 },
      { transform: `translate(${dx}px, 0)`, filter: 'blur(0)' },
    ], { ...opts, delay: 60 }).finished,
    cq.animate([
      { transform: 'none', filter: 'blur(0)' },
      { transform: `translate(${-dx * 0.5}px, -12px) scale(1.08)`, filter: 'blur(3px)', offset: 0.5 },
      { transform: `translate(${-dx}px, 0)`, filter: 'blur(0)' },
    ], { ...opts, delay: 60 }).finished,
  ]);
  if (!alive(run)) return;

  // land: real gifts swap places and settle with a wobble
  ca.remove(); cb.remove(); cp.remove(); cq.remove();
  pill.style.opacity = pill2.style.opacity = '';
  const ga = putInSlot(left, state.mine);
  const gb = putInSlot(right, THEIR_GIFT);
  anim(ga, [{ transform: 'scale(1.06) rotate(-4deg)' }, { transform: 'none' }], S.wobbly);
  anim(gb, [{ transform: 'scale(1.04) rotate(4deg)' }, { transform: 'none' }], S.wobbly);
  setTimeout(() => { twitch(gb, 1); twitch(ga, 0.6); }, 260);
  texts.forEach(clearAnims);
  // pills arrived already showing their amounts, so no count-up from zero
  setGram(left, GRAM_OPTIONS[state.gramIndex], GRAM_OPTIONS[state.gramIndex], '+');
  setGram(right, THEIR_GRAM, THEIR_GRAM, '+');
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
  particles(lock, { rings: [[14, 2.4, 0]], color: '#7dffa0' });
  confetti(lock);
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

    // the whole page above the sheet is a drop zone; near the slot the gift is pulled in by a magnet
    const overSlot = (x, y) => {
      if (openSheetEl !== giftSheet) return true;
      return y < giftSheet.getBoundingClientRect().top - 4;
    };
    const nearSlot = (x, y) => {
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
      if (nearSlot(ev.clientX, ev.clientY)) {
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
          closeSheet();
          placeMine(id, ghost).then(() => ghost.remove());
          ghost.style.visibility = 'hidden';
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
        closeSheet();
        placeMine(id);
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
  document.querySelectorAll('.fly, .dot, .ring, .spark').forEach((n) => n.remove());

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
  ripple($('.slot', left), { count: 1, scale: 1.5, color: 'rgba(255,255,255,.35)' });
  setTimeout(() => alive(run) && twitch($('.slot .gift', left), 0.7), 700);
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

loadGifts().then(() => start(true));
