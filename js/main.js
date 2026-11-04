import { CONTENT } from './content.js?v=202611040043';
import { audio } from './audio.js?v=202611040043';
import { sparkle, floatNote, reduceMotion, Embers, Glints } from './fx.js?v=202611040043';
import { Stage } from './stage.js?v=202611040043';
import { drawHead, drawStem, addBloom, LilyField } from './lily.js?v=202611040043';
import { playTransition } from './transition.js?v=202611040043';
import { paintBrush } from './brush.js?v=202611040043';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONTENT);

const params = new URLSearchParams(location.search);
const PREVIEW = params.has('preview');
const JUMP = params.get('jump');
// 转场：正式用花瓣扫过；?tr=burn|ink|lily 还能看刀光燃烧、红墨晕染和原来的彼岸花
const TRANS = ['burn', 'ink', 'lily'].includes(params.get('tr')) ? params.get('tr') : 'petal';

// ---------- 文案注入 ----------
$$('[data-t]').forEach((el) => {
  const v = get(el.dataset.t);
  if (typeof v === 'string') el.textContent = v;
});

// ---------- 小工具 ----------
let toastTimer;
export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());
function setScale() {
  const k = Math.min(2.2, Math.max(1, (innerWidth / 390) * 0.55));
  document.documentElement.style.setProperty('--k', k.toFixed(3));
}
setScale();

// 声音开关
const soundBtn = $('#sound');
soundBtn.addEventListener('click', () => {
  const m = !audio.muted;
  audio.setMuted(m);
  soundBtn.classList.toggle('is-muted', m);
  soundBtn.setAttribute('aria-label', m ? '打开声音' : '关闭声音');
});

// ---------- 星空 ----------
const starCanvas = $('#stars');
const starCtx = starCanvas.getContext('2d');
let stars = [];
function setupStars() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  starCanvas.width = innerWidth * dpr;
  starCanvas.height = innerHeight * dpr;
  starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round((innerWidth * innerHeight) / 4200);
  stars = Array.from({ length: n }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: Math.random() * 1.2 + 0.3,
    s: Math.random() * 2 + 0.5,
    o: Math.random() * Math.PI * 2,
  }));
}
let starOpacity = 1;
let starsOn = true; // 梦境结束以后星空被盖住了，不用再画
function drawStars(t) {
  if (!starsOn) return;
  // 钢琴面板打开时整屏都被盖住，星空不用画，省下来给拖琴键
  if (starOpacity > 0.01 && !document.body.classList.contains('piano-open')) {
    starCtx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      const a = 0.45 + 0.55 * Math.sin(t / 1000 * s.s + s.o);
      starCtx.globalAlpha = a;
      starCtx.fillStyle = '#fff';
      starCtx.beginPath();
      starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      starCtx.fill();
    }
  }
  requestAnimationFrame(drawStars);
}
setupStars();
requestAnimationFrame(drawStars);

// ---------- 场景高度 ----------
$$('.scrolly').forEach((el) => {
  const h = +el.dataset.h;
  el.style.height = h + 'vh';
  el.style.height = h + 'svh';
});

// ---------- 背景颜色随滚动 ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
// [场景, 进度, 上色, 下色, 星星]
const STOPS = [
  ['#s-entry', 0, '#141936', '#2C2F63', 1],
  ['#s-cloud', 0, '#BBD7F3', '#F4DCE6', 0],
  ['#s-cloud', 0.62, '#A9CBEF', '#EAD3E6', 0],
  ['#s-cloud', 1, '#7F7BC0', '#D6A6C8', 0.7],
  ['#s-music', 0.12, '#2A1F4D', '#4A3478', 1],
  ['#s-music', 0.9, '#150E2E', '#2A1F4D', 1],
  ['#s-ink', 0.25, '#0E0818', '#1C0A1C', 0.5],
  ['#s-ink', 0.75, '#07040B', '#1A0610', 0.25],
];
let stopPos = [];
function measure() {
  const vh = document.documentElement.clientHeight;
  stopPos = STOPS.map(([sel, p, a, b, s]) => {
    const el = $(sel);
    const span = Math.max(1, el.offsetHeight - vh);
    return { at: el.offsetTop + p * span, a: hex(a), b: hex(b), s };
  });
}
const bg = $('#bg');
function paintBg(y) {
  let i = 0;
  while (i < stopPos.length - 2 && y > stopPos[i + 1].at) i++;
  const A = stopPos[i], B = stopPos[i + 1];
  const t = clamp((y - A.at) / Math.max(1, B.at - A.at));
  bg.style.setProperty('--bg-top', mix(A.a, B.a, t));
  bg.style.setProperty('--bg-bot', mix(A.b, B.b, t));
  starOpacity = lerp(A.s, B.s, t);
  bg.style.setProperty('--stars', starOpacity.toFixed(3));
}

function progress(el) {
  const vh = document.documentElement.clientHeight;
  return clamp((scrollY - el.offsetTop) / Math.max(1, el.offsetHeight - vh));
}

// ---------- 云 ----------
const CLOUD_PUFFS = [
  [30, 46, 22], [56, 32, 28], [86, 38, 25], [110, 50, 18], [16, 56, 14],
];
function cloudSVG(i) {
  const circles = CLOUD_PUFFS.map(([x, y, r], k) => `<circle cx="${x}" cy="${y + ((i + k) % 3) * 2}" r="${r + ((i * 3 + k) % 4)}"/>`).join('');
  // 渐变按整朵云算（userSpaceOnUse），每个圆各算一次的话，云上会露出接缝
  return `<svg viewBox="0 0 130 72"><defs><linearGradient id="cg${i}" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="72"><stop offset=".45" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE8F7"/></linearGradient></defs><g fill="url(#cg${i})">${circles}<rect x="14" y="48" width="100" height="22" rx="11"/></g></svg>`;
}
const CLOUDS = [
  { x: -12, y: 18, w: 190, d: 0.35 },
  { x: 58, y: 8, w: 150, d: 0.55 },
  { x: 18, y: 52, w: 240, d: 0.8 },
  { x: 66, y: 70, w: 200, d: 1.05 },
  { x: -18, y: 92, w: 270, d: 1.3 },
  { x: 50, y: 112, w: 230, d: 1.55 },
  { x: 4, y: 140, w: 210, d: 1.8 },
  { x: 62, y: 160, w: 180, d: 2.0 },
];
const cloudsEl = $('#clouds');
const cloudEls = CLOUDS.map((c, i) => {
  const d = document.createElement('div');
  d.className = 'cloud';
  d.style.cssText = `left:${c.x}vw;top:${c.y}vh;width:calc(${c.w}px * var(--k));opacity:${0.75 + c.d * 0.12}`;
  d.innerHTML = cloudSVG(i);
  cloudsEl.appendChild(d);
  return d;
});

// 底部的云海：同一份形状画两遍（白天、黄昏），靠透明度过渡，比每帧改颜色省
function seaLayer(y, r0, seed, fill) {
  let puffs = '';
  for (let i = 0, x = -60; x < 1260; i++, x += 118) {
    puffs += `<circle cx="${x}" cy="${y + ((i * 29 + seed) % 34)}" r="${r0 + ((i * 41 + seed) % 36)}"/>`;
  }
  return `<g fill="${fill}">${puffs}<rect y="${y + 16}" width="1200" height="${420 - y}"/></g>`;
}
function seaSVG(id, back, front) {
  const grad = (k, [a, b]) => `<linearGradient id="${id}${k}" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="420"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  return `<svg class="${id}" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMin slice"><defs>${grad('b', back)}${grad('f', front)}</defs>${seaLayer(84, 66, 7, `url(#${id}b)`)}${seaLayer(150, 76, 19, `url(#${id}f)`)}</svg>`;
}
const sea = document.createElement('div');
sea.className = 'cloud-sea';
sea.innerHTML = seaSVG('sea-day', ['#EAF2FB', '#F6E4EE'], ['#FFFFFF', '#F8E6EF']) + seaSVG('sea-dusk', ['#B5A3DC', '#C7A5D2'], ['#E7CDE6', '#B79AD6']);
cloudsEl.appendChild(sea);
const seaDusk = $('.sea-dusk', sea);

// 点云、礼盒、照片：一下一个音，按顺序弹出 CONTENT.cloud.tune，弹完就安静。
// 每响一个音，从点的地方飘起一个音符，音越高飘得越高。
// 颜色是赤橙黄绿青蓝紫，按唱名对应：do 赤、re 橙、mi 黄、fa 绿、sol 青、la 蓝、si 紫（C 大调，升降音算下面那个音）。
// 天空是浅粉浅蓝，颜色取得偏深，再描一圈白光，才看得清
const TUNE_COLORS = ['#E8414A', '#F28C28', '#E0AE14', '#3DB35A', '#1FAFB0', '#3F7FE0', '#9A5FE0'];
const DEGREE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // 音名（C=0）到唱名的序号
let tuneIdx = 0;
function nextTuneNote(x, y) {
  const tune = CONTENT.cloud.tune || [];
  if (tuneIdx >= tune.length) return;
  const m = tune[tuneIdx++];
  audio.bell(m, { vol: 0.16, dur: 1.8 });
  if (x != null) floatNote(x, y, { color: TUNE_COLORS[DEGREE[m % 12]], rise: 110 + Math.max(0, m - 60) * 4, cls: 'on-sky' });
}

const GIFT_COLORS = [['#F2A7B8', '#FFFFFF'], ['#8FB8E8', '#FFD58A'], ['#C9B8FF', '#FFFFFF']];
const GIFTS = [
  { x: 12, y: 64, d: 1.0 },
  { x: 68, y: 98, d: 1.3 },
  { x: 28, y: 130, d: 1.6 },
];
const giftsEl = $('#gifts');
const giftEls = GIFTS.map((g, i) => {
  const [box, rib] = GIFT_COLORS[i];
  const el = document.createElement('button');
  el.className = 'gift';
  el.setAttribute('aria-label', '小礼盒');
  el.style.cssText = `left:${g.x}vw;top:${g.y}vh`;
  el.innerHTML = `<div class="bob" style="animation-delay:${-i * 1.3}s"><svg viewBox="0 0 60 60"><rect x="8" y="24" width="44" height="32" rx="4" fill="${box}"/><rect x="27" y="24" width="6" height="32" fill="${rib}"/><g class="lid"><rect x="4" y="15" width="52" height="11" rx="3" fill="${box}"/><rect x="27" y="15" width="6" height="11" fill="${rib}"/><path d="M30 15 C22 4 12 8 18 14 C22 17 28 15 30 15 C32 15 38 17 42 14 C48 8 38 4 30 15Z" fill="${rib}" stroke="${box}" stroke-width="1.5"/></g></svg><span class="note">${CONTENT.cloud.gifts[i]}</span></div>`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = el.getBoundingClientRect();
    nextTuneNote(r.left + r.width / 2, r.top + r.height * 0.3);
    if (el.classList.contains('open')) return;
    el.classList.add('open');
    sparkle(r.left + r.width / 2, r.top + 10, { color: box, count: 10 });
  });
  giftsEl.appendChild(el);
  return el;
});

$('#s-cloud .sticky').addEventListener('click', (e) => {
  const cloud = e.target.closest('.cloud, .cloud-sea');
  const pol = e.target.closest('.floaty');
  if (pol) {
    pol.classList.remove('wiggle');
    void pol.offsetWidth;
    pol.classList.add('wiggle');
    sparkle(e.clientX, e.clientY, { color: '#F2A7B8', count: 8 });
    nextTuneNote(e.clientX, e.clientY);
    return;
  }
  if (cloud) {
    cloud.classList.remove('squish');
    void cloud.offsetWidth;
    cloud.classList.add('squish');
  }
  sparkle(e.clientX, e.clientY, { color: cloud ? '#FFFFFF' : '#FFE8B8', count: cloud ? 9 : 6 });
  if (cloud) nextTuneNote(e.clientX, e.clientY);
});

const beats = $$('.beat');
// 第二句放在云海退去、马上进琴房的临界点
const BEAT_WIN = [[-0.1, 0.28], [0.87, 1.06]];
const polTrio = $('#pol-trio');
const polRei = $('#pol-rei');
const polFamily = $('#pol-family');
const tapHint = $('#s-cloud .tap-hint');
const rainbow = $('#rainbow');
const plane = $('#plane');

function renderCloud(p) {
  const vh = document.documentElement.clientHeight;
  rainbow.style.transform = `translate3d(-50%,${-p * vh * 0.35}px,0)`;
  rainbow.style.opacity = 1 - clamp((p - 0.42) / 0.2);
  const f = clamp((p - 0.04) / 0.44);
  plane.style.opacity = f > 0 && f < 1 ? 1 : 0;
  // 机头始终对准飞行方向：转角由轨迹的切线算出来（39.6 度是纸飞机图形本身机身中轴的仰角）
  const px = lerp(-0.2, 1.1, f) * innerWidth;
  const py = (lerp(0.5, 0.24, f) + Math.sin(f * Math.PI * 2) * 0.04) * vh;
  const heading = Math.atan2((-0.26 + 0.08 * Math.PI * Math.cos(f * Math.PI * 2)) * vh, 1.3 * innerWidth);
  plane.style.transform = `translate3d(${px}px,${py}px,0) rotate(${(heading * 180) / Math.PI + 39.6}deg)`;
  // 云海：先在底部露一点，后段升起来变成黄昏色，最后淡出，接琴房的夜色
  const rise = p < 0.85 ? lerp(0.16, 0.46, ease(clamp((p - 0.55) / 0.3))) : lerp(0.46, 0.34, (p - 0.85) / 0.15);
  sea.style.transform = `translate3d(0,${-rise * vh}px,0)`;
  sea.style.opacity = 1 - clamp((p - 0.9) / 0.1);
  seaDusk.style.opacity = clamp((p - 0.5) / 0.35);
  cloudEls.forEach((el, i) => {
    el.style.transform = `translate3d(0,${-p * CLOUDS[i].d * vh * 0.95}px,0)`;
  });
  giftEls.forEach((el, i) => {
    el.style.transform = `translate3d(0,${-p * GIFTS[i].d * vh * 0.9}px,0)`;
  });
  beats.forEach((b, i) => {
    const [a, z] = BEAT_WIN[i];
    const o = Math.min(clamp((p - a) / 0.06), clamp((z - p) / 0.06));
    b.style.opacity = o;
    b.style.transform = `translateY(${(1 - o) * 10}px)`;
  });
  const ty = (p0, p1, x) => lerp(1.05, -0.75, clamp((p - p0) / (p1 - p0))) * vh;
  polTrio.style.transform = `translate3d(0,${ty(0.1, 0.56)}px,0) rotate(${lerp(9, 4, p)}deg)`;
  polRei.style.transform = `translate3d(0,${ty(0.3, 0.72)}px,0) rotate(${lerp(-12, -6, p)}deg)`;
  polFamily.style.transform = `translate3d(0,${ty(0.46, 0.86)}px,0) rotate(${lerp(-4, -8, p)}deg)`;
  tapHint.style.opacity = Math.min(clamp((p - 0.03) / 0.05), clamp((0.9 - p) / 0.05)) * 0.7;
}

// ---------- 琴房 ----------
const quote = $('.quote');
const instruments = $('.instruments');
const nextHint = $('.next-hint');
const room = $('#room');
const glints = new Glints($('#glints'));
let musicSeen = false;

function syncGlints() {
  glints.set(musicSeen && pianoPanel.hidden);
}

// 水里的倒影：把乐器的 SVG 复制一份，翻过来
$$('.inst').forEach((b) => {
  const c = $('svg', b).cloneNode(true);
  c.classList.add('reflect');
  b.appendChild(c);
});

function renderMusic(p) {
  const a = ease(clamp(p / 0.18));
  const out = clamp((p - 0.82) / 0.15);
  room.style.opacity = a * (1 - clamp((p - 0.88) / 0.12));
  const seen = p > 0 && p < 1;
  if (seen !== musicSeen) { musicSeen = seen; syncGlints(); }
  quote.style.opacity = a * (1 - out);
  quote.style.transform = `translateY(${(1 - a) * 24 - out * 30}px)`;
  instruments.style.opacity = a * (1 - out * 0.8);
  instruments.style.transform = `translateY(${(1 - a) * 50}px)`;
  nextHint.style.opacity = clamp((p - 0.72) / 0.08) * 0.75 * (1 - clamp((p - 0.95) / 0.05));
  // 吉他响着往下滑：声音跟着渐弱，滑到彼岸花时停下；中途滑回来，声音也回来
  // 待在琴房里一直是满音量，快离开时才渐弱；线性降低听不出来，所以用曲线
  songLevel = Math.pow(1 - clamp((p - 0.58) / 0.36), 1.8);
  if (songOn) {
    if (p >= 1) stopSong();
    else audio.setSongLevel(songLevel);
  }
}

const guitar = $('#guitar');
let songOn = false;
let songLevel = 1;
let noteTimer = null;

function guitarNotes() {
  const r = guitar.getBoundingClientRect();
  const colors = ['#FFD58A', '#F2A7B8', '#C9B8FF', '#8FB8E8'];
  floatNote(r.left + r.width * 0.55, r.top + r.height * 0.55, { color: colors[(Math.random() * 4) | 0] });
}

async function startSong() {
  audio.unlock();
  songOn = true;
  const url = await audio.findSong(CONTENT.song.files);
  if (!songOn) return;
  if (!url) {
    songOn = false;
    toast(CONTENT.music.missing);
    return;
  }
  const el = audio.songElement(url);
  audio.setSongLevel(songLevel);
  try {
    await el.play();
  } catch (e) {
    songOn = false;
    toast(CONTENT.music.missing);
    return;
  }
  guitar.classList.add('playing');
  $('#s-music').classList.add('warm');
  clearInterval(noteTimer);
  noteTimer = setInterval(guitarNotes, 650);
}

export function stopSong({ fade = false } = {}) {
  songOn = false;
  guitar.classList.remove('playing');
  $('#s-music').classList.remove('warm');
  clearInterval(noteTimer);
  const el = audio.songEl;
  if (el && !el.paused) {
    if (fade) {
      const v0 = songLevel;
      let k = 0;
      const iv = setInterval(() => {
        k++;
        audio.setSongLevel(Math.max(0, v0 * (1 - k / 20)));
        if (k >= 20) { clearInterval(iv); el.pause(); }
      }, 80);
    } else el.pause();
  }
}

guitar.addEventListener('click', () => {
  audio.unlock();
  if (songOn) {
    stopSong();
  } else startSong();
});

// ---------- 钢琴（全屏；竖屏时整块横过来；拖顶部的条左右移动） ----------
const pianoPanel = $('#piano');
const pianoStage = $('#piano-stage');
const keysView = $('#keys-view');
const keysEl = $('#keys');
const mmKeys = $('#mm-keys');
const mmWin = $('#mm-win');
const SOLFA = ['do', '', 're', '', 'mi', 'fa', '', 'sol', '', 'la', '', 'si'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const KB = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
const finePointer = matchMedia('(pointer: fine)').matches;
const LOW = 36, HIGH = 96; // C2 – C7，和钢琴采样的范围一致
const whites = [];
for (let m = LOW; m <= HIGH; m++) if (WHITE.includes(m % 12)) whites.push(m);
let keyW = 46, viewW = 0, offset = null, kbBase = 60, rotated = false;

function buildKeys() {
  keysEl.innerHTML = '';
  whites.forEach((mm, i) => {
    const k = document.createElement('div');
    k.className = 'key white';
    k.dataset.m = mm;
    k.style.left = `calc(${i} * var(--kw))`;
    k.innerHTML = `<span class="kb"></span><span class="lbl">${SOLFA[mm % 12]}${mm % 12 === 0 ? Math.floor(mm / 12) - 1 : ''}</span>`;
    keysEl.appendChild(k);
    if (i < whites.length - 1 && [0, 2, 5, 7, 9].includes(mm % 12)) {
      const b = document.createElement('div');
      b.className = 'key black';
      b.dataset.m = mm + 1;
      b.style.left = `calc(${i + 1} * var(--kw) - var(--kw) * .31)`;
      b.innerHTML = '<span class="kb"></span>';
      keysEl.appendChild(b);
    }
  });
  // 迷你键盘
  mmKeys.innerHTML = whites.map((m) => `<i class="${m % 12 === 0 ? 'c' : ''}"></i>`).join('');
  pianoPanel.classList.toggle('has-kb', finePointer);
}
buildKeys();

function layoutPiano() {
  const W = innerWidth, H = innerHeight;
  rotated = H > W;
  pianoPanel.style.setProperty('--W', W + 'px');
  pianoPanel.style.setProperty('--H', H + 'px');
  pianoPanel.classList.toggle('rotated', rotated);
  viewW = keysView.clientWidth;
  const nVisible = Math.min(24, Math.max(10, Math.round(viewW / (finePointer ? 52 : 46))));
  keyW = viewW / nVisible;
  keysEl.style.setProperty('--kw', keyW + 'px');
  keysEl.style.width = whites.length * keyW + 'px';
  if (offset === null) offset = whites.indexOf(nVisible >= 15 ? 48 : 60) * keyW; // 默认从 C3 或 C4 开始
  setOffset(offset);
}

function setOffset(x) {
  const max = Math.max(0, whites.length * keyW - viewW);
  offset = Math.min(max, Math.max(0, x));
  keysEl.style.transform = `translateX(${-offset}px)`;
  const total = whites.length * keyW;
  mmWin.style.left = (offset / total) * 100 + '%';
  mmWin.style.width = (viewW / total) * 100 + '%';
  // 电脑键盘映射到当前看得见的第一个 C
  const first = Math.ceil(offset / keyW - 0.01);
  let c = whites[Math.min(whites.length - 1, first)];
  while (c % 12 !== 0) c++;
  if (c !== kbBase) {
    kbBase = Math.min(c, HIGH - 17);
    const inv = {};
    Object.entries(KB).forEach(([k, off]) => (inv[kbBase + off] = k === ';' || k === "'" ? k : k.toUpperCase()));
    // 键上的字母只有电脑上显示；平板、手机上不用每拖过一个 C 就改一遍整排琴键
    if (finePointer) keysEl.querySelectorAll('.key').forEach((k) => (k.querySelector('.kb').textContent = inv[k.dataset.m] || ''));
  }
}

// 拖动顶部的条（或迷你键盘）左右移动；竖屏旋转时，手指沿屏幕竖向移动对应琴键横向
const dragBar = $('#piano-drag');
let drag = null;
const along = (e) => (rotated ? e.clientY : e.clientX);
dragBar.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#piano-close')) return;
  e.preventDefault();
  try { dragBar.setPointerCapture(e.pointerId); } catch (err) {}
  const onMap = e.target.closest('#minimap');
  if (onMap && !e.target.closest('#mm-win')) {
    // 点迷你键盘：直接跳过去
    const r = $('#minimap').getBoundingClientRect();
    const frac = rotated ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    setOffset(frac * whites.length * keyW - viewW / 2);
  }
  const mapLen = onMap ? $('#minimap').getBoundingClientRect()[rotated ? 'height' : 'width'] : 0;
  drag = { id: e.pointerId, start: along(e), off: offset, map: !!onMap, mapLen, to: null, raf: 0 };
  dragBar.classList.add('dragging');
  keysEl.classList.add('moving');
});
// 手指移动时只记下位置，每帧最多挪一次琴键（平板的触摸一帧能报好几次）
dragBar.addEventListener('pointermove', (e) => {
  if (!drag || drag.id !== e.pointerId) return;
  const d = along(e) - drag.start;
  const scale = drag.map ? (whites.length * keyW) / drag.mapLen : -1.6;
  drag.to = drag.off + d * scale;
  if (!drag.raf) drag.raf = requestAnimationFrame(() => { if (!drag) return; drag.raf = 0; setOffset(drag.to); });
});
const endDrag = () => {
  if (drag) { cancelAnimationFrame(drag.raf); if (drag.to !== null) setOffset(drag.to); }
  drag = null;
  dragBar.classList.remove('dragging');
  keysEl.classList.remove('moving');
};
dragBar.addEventListener('pointerup', endDrag);
dragBar.addEventListener('pointercancel', endDrag);
keysView.addEventListener('wheel', (e) => { e.preventDefault(); setOffset(offset + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)); }, { passive: false });

const NOTE_COLORS = ['#C9B8FF', '#F2A7B8', '#8FB8E8', '#FFD58A'];
function localNote(key) {
  const n = document.createElement('span');
  n.className = 'local-note';
  n.textContent = ['♪', '♫', '♩', '♬'][(Math.random() * 4) | 0];
  const m = +key.dataset.m;
  n.style.color = NOTE_COLORS[m % 4];
  n.style.left = keysView.offsetLeft + key.offsetLeft - offset + key.offsetWidth / 2 + 'px';
  n.style.top = keysView.offsetTop - 6 + 'px';
  pianoStage.appendChild(n);
  const dx = (Math.random() - 0.5) * 60;
  const rise = Math.max(60, keysView.offsetTop * 0.8);
  n.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% - ${rise * 0.3}px)) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) scale(1.1)`, opacity: 0 },
    ],
    { duration: 1600, easing: 'ease-out' }
  ).onfinish = () => n.remove();
}

const held = new Map(); // pointerId / 键盘按键 -> { key, h }
function press(id, key) {
  if (!key) return;
  key.classList.add('down');
  const h = audio.key(+key.dataset.m, { vel: 0.8, vol: 1.35 }); // 音量比原来大约高 2.6 分贝
  held.set(id, { key, h });
  localNote(key);
}
function releaseId(id) {
  const v = held.get(id);
  if (!v) return;
  held.delete(id);
  if (![...held.values()].some((o) => o.key === v.key)) v.key.classList.remove('down');
  v.h && v.h.release(0, 0.38);
}
const keyAt = (x, y) => {
  const el = document.elementFromPoint(x, y);
  return el && el.closest ? el.closest('.key') : null;
};
keysView.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  try { keysView.setPointerCapture(e.pointerId); } catch (err) {}
  press(e.pointerId, keyAt(e.clientX, e.clientY));
});
keysView.addEventListener('pointermove', (e) => {
  const v = held.get(e.pointerId);
  if (!v) return;
  const k = keyAt(e.clientX, e.clientY);
  if (k && k !== v.key) {
    releaseId(e.pointerId);
    press(e.pointerId, k);
  }
});
keysView.addEventListener('pointerup', (e) => releaseId(e.pointerId));
keysView.addEventListener('pointercancel', (e) => releaseId(e.pointerId));
addEventListener('keydown', (e) => {
  if (pianoPanel.hidden || e.repeat || e.metaKey || e.ctrlKey) return;
  if (e.key === 'Escape') return closePiano();
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setOffset(offset + (e.key === 'ArrowLeft' ? -7 : 7) * keyW); return; }
  const off = KB[e.key.toLowerCase()];
  if (off === undefined) return;
  const key = keysEl.querySelector(`[data-m="${kbBase + off}"]`);
  if (key) { e.preventDefault(); audio.unlock(); press('kb' + e.code, key); }
});
addEventListener('keyup', (e) => releaseId('kb' + e.code));

let pianoReturn = 0.4;
function openPiano() {
  audio.unlock();
  pianoReturn = progress(musicSec);
  if (bgmEl && !bgmEl.paused) bgmEl.pause();
  audio.loadPiano();
  pianoPanel.hidden = false;
  syncGlints();
  layoutPiano();
  document.body.classList.add('piano-open');
  $('#piano-btn').classList.add('active');
  // 安卓浏览器能真的切到横屏；iOS 和微信里做不到，就用 CSS 旋转
  const el = document.documentElement;
  if (!finePointer && el.requestFullscreen && screen.orientation && screen.orientation.lock) {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation.lock('landscape'))
      .then(() => setTimeout(layoutPiano, 300))
      .catch(() => {});
  }
}
export function closePiano() {
  if (pianoPanel.hidden) return;
  [...held.keys()].forEach(releaseId);
  pianoPanel.hidden = true;
  syncGlints();
  document.body.classList.remove('piano-open');
  $('#piano-btn').classList.remove('active');
  try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  // 退出全屏/横屏后页面高度会变，按进入前在琴房里的位置滚回去
  setTimeout(() => {
    measure();
    scrollTo(0, musicSec.offsetTop + (musicSec.offsetHeight - document.documentElement.clientHeight) * pianoReturn);
    onScroll();
  }, 450);
}
$('#piano-btn').addEventListener('click', () => (pianoPanel.hidden ? openPiano() : closePiano()));
$('#piano-close').addEventListener('click', closePiano);
addEventListener('resize', () => { if (!pianoPanel.hidden) layoutPiano(); });

// ---------- 云上的背景音乐：她自己录的《致青春》 ----------
let bgmEl = null;
let bgmGain = null;
async function startDreamBgm() {
  if (bgmEl) return;
  for (const u of CONTENT.dreamBgm.files) {
    try {
      const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
      if (!r.ok) continue;
      bgmEl = new Audio(u);
      bgmEl.loop = true;
      bgmEl.setAttribute('playsinline', '');
      // 经过 Web Audio 的增益节点调音量（iOS 不允许直接改 audio.volume）
      if (audio.ctx) {
        try {
          const src = audio.ctx.createMediaElementSource(bgmEl);
          bgmGain = audio.ctx.createGain();
          bgmGain.gain.value = 0;
          src.connect(bgmGain).connect(audio.master);
        } catch (e) { bgmGain = null; }
      }
      if (!bgmGain) bgmEl.volume = 0;
      bgmEl.play().catch(() => {});
      return;
    } catch (e) {}
  }
}
// 在云上时音量慢慢起来，快到琴房时淡出；吉他响的时候让开
function bgmLevel(cloudP, musicP) {
  if (!bgmEl) return;
  if (!bgmGain) bgmEl.muted = audio.muted;
  let v = 0;
  if (!$('#dream').hidden) {
    if (cloudP < 1) v = Math.min(1, cloudP / 0.05 + 0.3);
    if (cloudP >= 0.85) v *= Math.max(0, 1 - (cloudP - 0.85) / 0.15);
    if (musicP > 0) v = 0;
  }
  if (songOn || !pianoPanel.hidden) v = 0;
  if (bgmGain) bgmGain.gain.setTargetAtTime(v * 0.8, audio.now, 0.25);
  else try { bgmEl.volume = v * 0.7; } catch (e) {}
  if (v === 0 && !bgmEl.paused && (musicP > 0.05 || $('#dream').hidden || !pianoPanel.hidden)) bgmEl.pause();
  if (v > 0 && bgmEl.paused) bgmEl.play().catch(() => {});
}

// ---------- 黑红：剑气与彼岸花 ----------
const embers = new Embers($('#embers'));
const slashSvg = $('#slashes');
const lily = $('#lily');
// 一笔有粗细变化的“剑气”：沿二次曲线生成两侧轮廓，再用同一条线的描边做遮罩，按进度露出来
function brushStroke(id, p0, c, p1, maxW, fill) {
  const N = 40, L = [], R = [];
  const at = (t) => [
    (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0],
    (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1],
  ];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = at(t);
    const [x2, y2] = at(Math.min(1, t + 0.001));
    const [x1, y1] = at(Math.max(0, t - 0.001));
    let nx = -(y2 - y1), ny = x2 - x1;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const w = maxW * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.6) * (t > 0.87 ? (1 - t) / 0.13 : 1);
    L.push([x + nx * w / 2, y + ny * w / 2]);
    R.push([x - nx * w / 2, y - ny * w / 2]);
  }
  const pts = L.concat(R.reverse());
  const d = 'M' + pts.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L') + 'Z';
  const centre = `M${p0[0]} ${p0[1]} Q${c[0]} ${c[1]} ${p1[0]} ${p1[1]}`;
  return `<mask id="m${id}" maskUnits="userSpaceOnUse"><path class="reveal" d="${centre}" pathLength="1" stroke="#fff" stroke-width="${maxW * 1.6}" fill="none" stroke-dasharray="1" stroke-dashoffset="1"/></mask><g mask="url(#m${id})"><path d="${d}" fill="none" stroke="${fill}" stroke-width="${maxW * 0.7}" stroke-linejoin="round" opacity=".2"/><path d="${d}" fill="${fill}"/></g>`;
}
function buildSlashes() {
  const W = innerWidth, H = innerHeight;
  slashSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const big = Math.min(W, H) * 0.09;
  slashSvg.innerHTML =
    `<defs><linearGradient id="sg1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7A0819"/><stop offset=".5" stop-color="#E3243B"/><stop offset="1" stop-color="#FF7A86"/></linearGradient></defs>` +
    brushStroke(1, [-0.12 * W, 0.8 * H], [0.45 * W, 0.42 * H], [1.12 * W, 0.16 * H], big, 'url(#sg1)') +
    brushStroke(2, [1.1 * W, 0.66 * H], [0.5 * W, 0.5 * H], [-0.1 * W, 0.26 * H], big * 0.18, '#FFD58A');
}
buildSlashes();
const slashMasks = () => $$('#slashes .reveal');

// 彼岸花过场：先开花，两刀切开，再化成同色的星光慢慢散掉。
// 画面跟着一个平滑过的进度走，手指一顿一顿地滑，画面也是连续的
const field = new LilyField($('#lily'));
const inkGlow = $('#s-ink .ink-glow');
const mountains = $('#s-ink .mountains');
const plum = $('#s-ink .plum');
let loadingFired = false;
let inkGoal = 0, inkP = 0, inkOn = false, inkLoop = false;

function renderInk(p, visible) {
  inkGoal = p;
  inkOn = visible && !loadingFired;
  if (visible) field.prepare();
  else embers.set(0);
  if (inkOn && !inkLoop) {
    inkLoop = true;
    requestAnimationFrame(inkFrame);
  }
}
function inkFrame(time) {
  inkP += (inkGoal - inkP) * 0.1;
  if (Math.abs(inkGoal - inkP) < 0.0004) inkP = inkGoal;
  paintInk(inkP, time);
  if (inkOn) requestAnimationFrame(inkFrame);
  else inkLoop = false;
}
function paintInk(p, time) {
  embers.set(clamp(p / 0.3));
  inkGlow.style.opacity = clamp(p / 0.3);
  const m = slashMasks();
  const c1 = ease(clamp((p - 0.42) / 0.12));
  const c2 = ease(clamp((p - 0.5) / 0.12));
  if (m[0]) m[0].style.strokeDashoffset = 1 - c1;
  if (m[1]) m[1].style.strokeDashoffset = 1 - c2;
  slashSvg.style.opacity = 1 - clamp((p - 0.62) / 0.14);
  lily.style.opacity = clamp(p / 0.03);
  field.draw({
    open: [clamp((p - 0.12) / 0.34), clamp((p - 0.06) / 0.34), clamp(p / 0.42)],
    cut: [c1, c2],
    gone: clamp((p - 0.6) / 0.32),
    time,
  });
  mountains.style.transform = `translateY(${(1 - ease(clamp(p / 0.6))) * 60}%)`;
  plum.style.opacity = clamp((p - 0.3) / 0.25) * (1 - clamp((p - 0.7) / 0.2));
  plum.style.transform = `translateX(${(1 - clamp((p - 0.3) / 0.25)) * -30}px)`;
  if (p > 0.93 && !loadingFired) {
    loadingFired = true;
    inkOn = false;
    embers.stopNow();
    startLoading();
  }
}

// ---------- 滚动循环 ----------
const cloudSec = $('#s-cloud');
const musicSec = $('#s-music');
const inkSec = $('#s-ink');
let ticking = false;
function onScroll() {
  if (ticking || !pianoPanel.hidden) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY;
    paintBg(y);
    const cp = progress(cloudSec), mp = progress(musicSec);
    renderCloud(cp);
    renderMusic(mp);
    bgmLevel(scrollY < cloudSec.offsetTop ? 0 : cp, scrollY < musicSec.offsetTop ? 0 : mp);
    const ip = progress(inkSec);
    const vh = document.documentElement.clientHeight;
    renderInk(ip, TRANS === 'lily' && y + vh > inkSec.offsetTop && !$('#dream').hidden);
    if (TRANS !== 'lily' && entered && !loadingFired && !$('#dream').hidden && mp > 0.97) runTransition();
    const mid = y + vh / 2;
    if (entered && !$('#dream').hidden) reachChapter(mid >= inkSec.offsetTop ? 'ink' : mid >= musicSec.offsetTop ? 'music' : 'cloud');
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => {
  setScale();
  measure();
  setupStars();
  buildSlashes();
  field.resize();
  onScroll();
});

// ---------- 入口：长按 ----------
const hold = $('#hold');
const ring = hold.querySelector('.ring');
let holdRaf, holdStart = 0, entered = false;
const HOLD_MS = 1100;
function holdTick(t) {
  const k = clamp((t - holdStart) / HOLD_MS);
  ring.style.strokeDashoffset = 182.2 * (1 - k);
  if (k >= 1) return enterDream();
  holdRaf = requestAnimationFrame(holdTick);
}
hold.addEventListener('pointerdown', (e) => {
  if (entered) return;
  e.preventDefault();
  audio.unlock();
  hold.classList.add('pressing');
  holdStart = performance.now();
  audio.bell(72, { vol: 0.08, dur: 1.4 });
  holdRaf = requestAnimationFrame(holdTick);
});
const cancelHold = () => {
  if (entered) return;
  hold.classList.remove('pressing');
  cancelAnimationFrame(holdRaf);
  ring.style.transition = 'stroke-dashoffset .4s';
  ring.style.strokeDashoffset = 182.2;
  setTimeout(() => (ring.style.transition = ''), 400);
};
hold.addEventListener('pointerup', cancelHold);
hold.addEventListener('pointerleave', cancelHold);
hold.addEventListener('pointercancel', cancelHold);
hold.addEventListener('contextmenu', (e) => e.preventDefault());
hold.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); audio.unlock(); enterDream(); }
});

async function enterDream({ instant = false } = {}) {
  if (entered) return;
  entered = true;
  cancelAnimationFrame(holdRaf);
  const bloom = $('#bloom');
  soundBtn.hidden = false;
  if (!instant) {
    [72, 76, 79, 84, 88].forEach((m, i) => audio.bell(m, { t: i * 0.12, vol: 0.12, dur: 2.4 }));
    audio.whoosh(1.4, true);
    await bloom.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-in', fill: 'forwards' }).finished;
  }
  audio.loadPiano();
  startDreamBgm();
  document.body.classList.remove('no-scroll');
  measure();
  scrollTo(0, cloudSec.offsetTop);
  onScroll();
  if (!instant) {
    await sleep(120);
    bloom.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
  }
}

// ---------- 加载页：一片发光的彼岸花 ----------
// 每朵画在自己的小画布上，生长和摇摆都交给 CSS，不用每帧重画
function buildLdLilies() {
  const box = $('#ld-lilies');
  box.innerHTML = '';
  const W = innerWidth, H = box.getBoundingClientRect().height || innerHeight * 0.28;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const n = Math.max(5, Math.round(W / 120));
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (a % 2) - (b % 2) || a - b);
  order.forEach((i, idx) => {
    const back = i % 2 === 0; // 后排小一些、暗一些
    const R = Math.min(W / n, H * 0.62) * (back ? 0.52 : 0.72);
    const cw = R * 3.4, ch = H + R * 1.5;
    const c = document.createElement('canvas');
    c.className = 'ld-lily';
    c.width = Math.round(cw * dpr);
    c.height = Math.round(ch * dpr);
    const x = (W / n) * (i + 0.5) + (Math.random() - 0.5) * (W / n) * 0.3;
    c.style.cssText = `left:${(x - cw / 2).toFixed(1)}px;width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px;animation-delay:${(idx * 0.16).toFixed(2)}s,${(-idx * 0.7).toFixed(2)}s`;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const top = ch - H * (back ? 0.62 + Math.random() * 0.2 : 0.42 + Math.random() * 0.22);
    drawStem(ctx, cw / 2, ch, cw / 2, top, (Math.random() - 0.5) * 24, Math.max(2, R * 0.07));
    drawHead(ctx, cw / 2, top, R, { tilt: 0.75 + Math.random() * 0.35, roll: (Math.random() - 0.5) * 0.6, seed: i * 3 + 5, light: back ? 0.66 : 0.95, detail: 9 });
    addBloom(ctx, c, back ? 0.3 : 0.5);
    box.appendChild(c);
  });
}

// ---------- 章节进度条 ----------
// 只亮看过的章节，没看过的不露名字。回到某一章时重新载入页面，这样不用逐个清理烟花和计时器
const CHAPTERS = CONTENT.chapters.list;
const CHAPTER_KEY = 'shiyi-chapter';
const chaptersBtn = $('#chapters-btn');
const chaptersEl = $('#chapters');
const chBar = $('#ch-bar');
let chapterNow = -1, chapterMax = -1;
// 只有从章节菜单跳回来（地址里带 from=chapter）才接着用之前的进度；
// 别的方式进来都从头锁住。同一个标签页里离开再回来，sessionStorage 还在，所以要主动清掉。
// 预览时直接 ?jump= 到某一章不算看过，不存
const fromChapter = params.get('from') === 'chapter';
const keepProgress = !JUMP || fromChapter;
try {
  localStorage.removeItem(CHAPTER_KEY); // 以前存在这里，会一直留着，清掉
  if (fromChapter) {
    const saved = parseInt(sessionStorage.getItem(CHAPTER_KEY), 10);
    if (saved >= 0) chapterMax = Math.min(saved, CHAPTERS.length - 1);
  } else sessionStorage.removeItem(CHAPTER_KEY);
} catch {}
chaptersBtn.setAttribute('aria-label', CONTENT.chapters.label);

function reachChapter(id) {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  if (i < 0 || i === chapterNow) return;
  chapterNow = i;
  chaptersBtn.hidden = false;
  if (i <= chapterMax) return;
  chapterMax = i;
  if (!keepProgress) return;
  try {
    sessionStorage.setItem(CHAPTER_KEY, i);
  } catch {}
}

function renderChapters() {
  // 竖线从按钮底部算起，到最后一个节点的中心
  chBar.style.setProperty('--fill', (chapterMax + 0.5) / (CHAPTERS.length - 0.5));
  chBar.innerHTML = '';
  CHAPTERS.forEach((c, i) => {
    const seen = i <= chapterMax;
    const el = document.createElement('button');
    el.className = 'ch-node' + (i === chapterNow ? ' now' : '');
    el.disabled = !seen;
    el.setAttribute('aria-label', seen ? c.name : CONTENT.chapters.locked);
    el.innerHTML = `<i></i><span>${seen ? c.name : ''}</span>`;
    el.addEventListener('click', () => {
      const q = new URLSearchParams(location.search);
      q.set('jump', c.id);
      q.set('from', 'chapter');
      location.href = location.pathname + '?' + q;
    });
    chBar.appendChild(el);
  });
}
const CH_ROLLED = { clipPath: 'inset(0 0 100% 0)' }, CH_OPEN = { clipPath: 'inset(0 0 0 0)' };
function closeChapters() {
  chaptersBtn.classList.remove('open');
  const a = chBar.animate([CH_OPEN, CH_ROLLED], { duration: 160, easing: 'ease-in', fill: 'forwards' });
  a.finished.then(() => {
    if (!chaptersBtn.classList.contains('open')) chaptersEl.hidden = true;
    a.cancel();
  });
}
chaptersBtn.addEventListener('click', () => {
  if (chaptersBtn.classList.contains('open')) return closeChapters();
  renderChapters();
  chaptersEl.hidden = false;
  chaptersBtn.classList.add('open');
  chBar.animate([CH_ROLLED, CH_OPEN], { duration: 280, easing: 'cubic-bezier(.2,.9,.3,1)' });
});
chaptersEl.addEventListener('click', (e) => {
  if (!e.target.closest('.ch-node')) closeChapters();
});

// 新转场：滑到琴房尽头自动播放，不再跟着手指一点点放
async function runTransition() {
  loadingFired = true;
  reachChapter('ink');
  closePiano();
  stopSong({ fade: true });
  document.body.classList.add('no-scroll');
  let revealed;
  const shown = new Promise((r) => (revealed = r));
  await playTransition(TRANS, {
    onDark: () => startLoading({ after: shown }),
    sfx: (n) => {
      if (n === 'slash') audio.whoosh(0.5, true);
      if (n === 'burn') audio.crackle({ spread: 2 });
      if (n === 'drop') audio.thud(0.35);
      if (n === 'petal') audio.whoosh(2, false);
    },
  });
  revealed();
}

// ---------- 水墨加载 ----------
const stage = new Stage({ toast, stopSong, closePiano, onChapter: reachChapter });
// after：转场揭开以后才开始走进度，之前一直停在 0%
async function startLoading({ instant = false, after } = {}) {
  closePiano();
  stopSong({ fade: true });
  document.body.classList.add('no-scroll');
  const ld = $('#loading');
  ld.hidden = false;
  buildLdLilies();
  const ldEmbers = new Embers($('#ld-embers'));
  ldEmbers.set(0.7);
  audio.thud(0.5);
  audio.whoosh(1.6, false);
  const bar = $('#bar');
  const paint = () => paintBrush(bar, $('#bar-track'));
  paint();
  addEventListener('resize', paint);
  const pct = $('#ld-pct');
  const tip = $('#ld-tip');
  const tips = CONTENT.ink.tips;
  const DUR = instant ? 300 : tips.length * 2000; // 每条提示停 2 秒
  bar.style.setProperty('--x', '0px');
  pct.textContent = '0%';
  tip.textContent = tips[0];
  if (after) await after;
  const t0 = performance.now();
  let lastTip = 0;
  await new Promise((res) => {
    const step = (t) => {
      const k = clamp((t - t0) / DUR);
      // 像真的加载一样，中间会顿一下
      const shown = k < 0.55 ? ease(k / 0.55) * 0.62 : k < 0.7 ? 0.62 + (k - 0.55) * 0.2 : 0.65 + ease((k - 0.7) / 0.3) * 0.35;
      bar.style.setProperty('--x', `${shown * (bar.clientWidth + 18)}px`);
      pct.textContent = Math.round(shown * 100) + '%';
      const ti = Math.min(tips.length - 1, Math.floor(k * tips.length));
      if (ti !== lastTip) {
        lastTip = ti;
        tip.textContent = tips[ti];
      }
      if (k < 1) requestAnimationFrame(step);
      else res();
    };
    requestAnimationFrame(step);
  });
  const tap = $('#ld-tap');
  tap.classList.add('show');
  tip.style.opacity = 0;
  audio.thud(0.3);
  await new Promise((res) => ld.addEventListener('click', res, { once: true }));
  audio.unlock();
  // 先把加载页的内容淡掉，只剩黑底；停一下，蛋糕再从黑里淡入
  await Promise.all([...ld.children].map((c) => c.animate([{ opacity: getComputedStyle(c).opacity }, { opacity: 0 }], { duration: 800, easing: 'ease-in', fill: 'forwards' }).finished));
  ldEmbers.stopNow();
  $('#dream').hidden = true;
  starsOn = false;
  embers.stopNow();
  scrollTo(0, 0);
  stage.begin('cake');
  await sleep(350);
  await ld.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out', fill: 'forwards' }).finished;
  ld.hidden = true;
  ldEmbers.stopNow();
  removeEventListener('resize', paint);
}

// ---------- 锁与启动 ----------
const unlockAt = new Date(CONTENT.unlockAt).getTime();
function boot() {
  measure();
  onScroll();
  if (!JUMP) return;
  if (params.get('from') !== 'chapter') return jump(JUMP);
  // 重新载入后浏览器要先点一下才肯出声
  const resume = $('#resume');
  resume.textContent = CONTENT.chapters.resume;
  resume.hidden = false;
  resume.addEventListener('click', () => {
    resume.hidden = true;
    jump(JUMP, { top: true });
  }, { once: true });
}

async function jump(where, { top = false } = {}) {
  const dreamTargets = { cloud: cloudSec, music: musicSec, ink: inkSec };
  if (dreamTargets[where]) {
    await enterDream({ instant: true });
    measure();
    const el = dreamTargets[where];
    // 从章节回来时停在内容刚出现的位置，琴房最开头还是空的
    const at = top ? { cloud: 0, music: 0.18, ink: 0.08 }[where] : where === 'ink' ? 0 : 0.3;
    scrollTo(0, el.offsetTop + (el.offsetHeight - innerHeight) * at);
    onScroll();
    return;
  }
  if (where === 'loading') {
    entered = true;
    soundBtn.hidden = false;
    loadingFired = true;
    return startLoading();
  }
  entered = true;
  soundBtn.hidden = false;
  $('#dream').hidden = true;
  starsOn = false;
  document.addEventListener('pointerdown', () => audio.loadPiano(), { once: true });
  stage.begin(where);
}

if (!PREVIEW && Date.now() < unlockAt) {
  const lock = $('#lock');
  lock.hidden = false;
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const ms = unlockAt - Date.now();
    if (ms <= 0) {
      lock.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, fill: 'forwards' }).finished.then(() => (lock.hidden = true));
      boot();
      return;
    }
    const s = Math.floor(ms / 1000);
    $('#cd-d').textContent = Math.floor(s / 86400);
    $('#cd-h').textContent = pad(Math.floor((s % 86400) / 3600));
    $('#cd-m').textContent = pad(Math.floor((s % 3600) / 60));
    $('#cd-s').textContent = pad(s % 60);
    setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  tick();
} else {
  boot();
}

if (reduceMotion) document.documentElement.classList.add('reduce');
