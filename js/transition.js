// 琴房到加载页的转场，三个版本，预览时用 ?tr= 切换：
// burn  刀光以 60 度切开黑色羊皮纸，纸从刀口往两边烧掉
// ink   一滴红墨落下溅开，晕染开，墨晕里透出加载页
// petal 一大片彼岸花瓣和花头从左边卷过去
// 都是先从琴房变全黑，加载页在黑幕底下开始走进度，再用各自的方式把黑幕去掉。
// 烧纸和晕染用一张低分辨率的“到达时间”图：每格记下几时被烧到或染到，逐帧和当前进度比较，
// 算出透明度和火光/墨色两张小图，放大后叠在满分辨率的纸纹上。每帧只算几万个格子，边缘放大后自然柔和
import { drawHead } from './lily.js?v=202611030439';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const DPR = Math.min(devicePixelRatio || 1, 2);
const animate = (dur, frame) =>
  new Promise((res) => {
    const t0 = performance.now();
    const f = (t) => {
      const k = clamp((t - t0) / dur);
      frame(k, (t - t0) / 1000);
      if (k < 1) requestAnimationFrame(f);
      else res();
    };
    requestAnimationFrame(f);
  });

// 平滑的值噪声，返回 0～1
function makeNoise(seed = 7) {
  const N = 64, g = new Float32Array(N * N);
  let s = seed;
  for (let i = 0; i < g.length; i++) g[i] = (s = (s * 16807) % 2147483647) / 2147483647;
  const at = (x, y) => g[(y & 63) * N + (x & 63)];
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  return (x, y) => n(x, y) * 0.55 + n(x * 2.1 + 17, y * 2.1 + 5) * 0.3 + n(x * 4.3 + 3, y * 4.3 + 29) * 0.15;
}

function offscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
// 铺满屏幕的画布。烧纸和晕染每帧要叠三层整屏的图，用 1 倍像素就够，纸纹本来就是柔的
function view(el, dpr = 1) {
  const w = innerWidth, h = innerHeight;
  const c = offscreen(Math.round(w * dpr), Math.round(h * dpr));
  el.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingQuality = 'high';
  return { ctx, w, h };
}

// 纸：底色、大块的明暗、细纤维、暗角，一次画好
function paper(w, h, { base, fiber, fibers, seed }) {
  const c = offscreen(w, h);
  const x = c.getContext('2d');
  x.fillStyle = `rgb(${base})`;
  x.fillRect(0, 0, w, h);
  const noise = makeNoise(seed);
  const bw = 72, bh = Math.round((72 * h) / w);
  const blot = offscreen(bw, bh);
  const bx = blot.getContext('2d');
  const img = bx.createImageData(bw, bh);
  for (let i = 0; i < bw * bh; i++) {
    const v = noise((i % bw) / 9, Math.floor(i / bw) / 9);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.max(0, v - 0.42) * 70;
  }
  bx.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'overlay';
  x.drawImage(blot, 0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  for (let i = 0; i < fibers; i++) {
    const px = Math.random() * w, py = Math.random() * h, a = rnd(0, Math.PI), l = rnd(6, 26);
    x.strokeStyle = `rgba(${fiber},${rnd(0.03, 0.1).toFixed(3)})`;
    x.lineWidth = rnd(0.3, 0.9);
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(a + 0.4) * l * 0.5, py + Math.sin(a + 0.4) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l);
    x.stroke();
  }
  const v = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
  x.fillStyle = v;
  x.fillRect(0, 0, w, h);
  return c;
}

// 低分辨率的到达时间图，外加两张小图：mask 是纸还剩哪儿，glow 是火光或墨色
function grid(T) {
  const cell = innerWidth < 700 ? 3 : 4;
  const W = Math.ceil(innerWidth / cell), H = Math.ceil(innerHeight / cell);
  const t = new Float32Array(W * H), tex = new Float32Array(W * H), fl = new Float32Array(W * H);
  const n1 = makeNoise(31), n2 = makeNoise(53);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      t[i] = T(x * cell, y * cell);
      tex[i] = n1(x * 0.35, y * 0.35);
      fl[i] = n2(x * 0.6, y * 0.6);
    }
  }
  const mk = () => {
    const c = offscreen(W, H);
    const x = c.getContext('2d');
    return { c, x, img: x.createImageData(W, H) };
  };
  return { cell, W, H, t, tex, fl, mask: mk(), glow: mk() };
}
// 纸纹 → 用 mask 裁掉烧没的部分 → 叠火光或墨色
function compose(v, sheet, g) {
  g.mask.x.putImageData(g.mask.img, 0, 0);
  g.glow.x.putImageData(g.glow.img, 0, 0);
  const { ctx, w, h } = v;
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(sheet, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(g.mask.c, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(g.glow.c, 0, 0, w, h);
}

// 柔和的圆点，画烟用
function softDot(rgb) {
  const c = offscreen(64, 64);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},.55)`);
  g.addColorStop(0.5, `rgba(${rgb},.22)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}

// ---------- 第一版：刀光切开黑色羊皮纸，往两边烧掉 ----------
async function burn(el, sfx) {
  const w = innerWidth, h = innerHeight, cx = w / 2, cy = h / 2;
  const a = (60 * Math.PI) / 180;
  const nx = Math.sin(a), ny = Math.cos(a); // 刀痕的法线
  const maxD = Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2;
  const big = makeNoise(11), fine = makeNoise(97);
  // 离刀痕越远烧得越晚；大块噪声让火线参差不齐，细噪声让边缘有毛边
  const g = grid((x, y) => Math.abs((x - cx) * nx + (y - cy) * ny) / maxD + (big(x / 110, y / 110) - 0.5) * 0.38 + (fine(x / 20, y / 20) - 0.5) * 0.05);
  const sheet = paper(w, h, { base: '16,12,11', fiber: '150,120,100', fibers: Math.round((w * h) / 260), seed: 3 });
  const v = view(el);
  el.style.background = 'transparent';
  const smokeDot = softDot('110,96,90');
  const sparks = [], smoke = [];
  let now = 0;
  const paint = (r) => {
    const md = g.mask.img.data, gd = g.glow.img.data;
    for (let i = 0; i < g.t.length; i++) {
      const o = i * 4;
      let u = g.t[i] - r;
      if (u > 0.12) { md[o + 3] = 255; gd[o + 3] = 0; continue; }
      if (u < -0.05) { md[o + 3] = 0; gd[o + 3] = 0; continue; }
      u += (g.fl[i] - 0.5) * 0.012 * Math.sin(now * 9 + g.fl[i] * 30); // 火苗在抖
      md[o + 3] = u <= 0 ? 0 : u < 0.008 ? (u / 0.008) * 255 : 255;
      let R, G, B, A;
      if (u < 0) { const k = -u / 0.05; R = 255; G = 140; B = 50; A = 140 * (1 - k) * (1 - k); } // 照进洞口的火光
      else if (u < 0.014) { const k = u / 0.014; R = 255; G = 240 - 100 * k; B = 175 - 140 * k; A = 255; } // 最亮的火线
      else if (u < 0.045) { const k = (u - 0.014) / 0.031; R = 235 - 150 * k; G = 110 - 92 * k; B = 34 - 28 * k; A = 255 - 30 * k; } // 余烬
      else { const k = (u - 0.045) / 0.075; R = 34; G = 20; B = 12; A = 235 * Math.pow(1 - k, 1.3) * (0.7 + 0.3 * g.tex[i]); } // 焦痕往外淡
      gd[o] = R; gd[o + 1] = G; gd[o + 2] = B; gd[o + 3] = A;
    }
    compose(v, sheet, g);
  };
  const L = Math.hypot(w, h);
  const dx = Math.cos(a), dy = -Math.sin(a);
  const x0 = cx - (dx * L) / 2, y0 = cy - (dy * L) / 2;
  const slash = (p, alpha) => {
    const ctx = v.ctx;
    const x1 = x0 + dx * L * p, y1 = y0 + dy * L * p;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    [[26, 'rgba(195,18,47,.10)'], [12, 'rgba(227,36,59,.28)'], [5, 'rgba(255,120,100,.6)'], [1.6, 'rgba(255,248,240,1)']].forEach(([lw, c]) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    });
    // 刀尖上一团亮光
    if (p < 1) {
      const rg = ctx.createRadialGradient(x1, y1, 0, x1, y1, 26);
      rg.addColorStop(0, 'rgba(255,240,230,.9)');
      rg.addColorStop(1, 'rgba(255,80,80,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x1 - 26, y1 - 26, 52, 52);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };
  paint(-1);
  // 刀光划过
  sfx('slash');
  await animate(240, (k) => {
    paint(-1);
    slash(1 - Math.pow(1 - k, 3), 1);
  });
  // 划完闪一下白，整张纸轻轻一震
  el.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(-2px,2px)' }, { transform: 'translate(0,0)' }], { duration: 180 });
  sfx('burn');
  let last = 0;
  await animate(3200, (k, s) => {
    const dt = s - last;
    last = s;
    now = s;
    const r = 1.34 * Math.pow(k, 1.5) - 0.012;
    paint(r);
    const ctx = v.ctx;
    if (k < 0.08) {
      ctx.globalAlpha = 0.22 * (1 - k / 0.08);
      ctx.fillStyle = '#FFF4EC';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (k < 0.25) slash(1, 1 - k / 0.25);
    // 在火线附近随机找点，冒火星和烟
    for (let n = 0; n < 90; n++) {
      const i = (Math.random() * g.t.length) | 0;
      const u = g.t[i] - r;
      if (u < 0 || u > 0.02) continue;
      const px = (i % g.W) * g.cell, py = ((i / g.W) | 0) * g.cell;
      if (Math.random() < 0.45 && sparks.length < 220) sparks.push({ x: px, y: py, px, py, vx: rnd(-22, 22), vy: rnd(-90, -25), life: 1, decay: rnd(0.7, 1.5), s: rnd(0.7, 2), c: Math.random() < 0.55 ? '255,214,130' : '255,140,60' });
      if (Math.random() < 0.05 && smoke.length < 70) smoke.push({ x: px, y: py, vx: rnd(-8, 8), vy: rnd(-34, -16), life: 1, decay: rnd(0.45, 0.8), s: rnd(18, 34) });
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) { smoke.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const sz = p.s * (1.8 - p.life);
      ctx.globalAlpha = 0.32 * p.life;
      ctx.drawImage(smokeDot, p.x - sz, p.y - sz, sz * 2, sz * 2);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.px = p.x;
      p.py = p.y;
      p.vy -= 14 * dt;
      p.x += (p.vx + Math.sin(p.y * 0.05 + i) * 10) * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = p.life * (0.6 + 0.4 * Math.random());
      ctx.strokeStyle = `rgb(${p.c})`;
      ctx.lineWidth = p.s;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y + 0.01);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  });
}

// ---------- 第二版：一滴红墨落下溅开，晕染开 ----------
async function ink(el, sfx) {
  const w = innerWidth, h = innerHeight, cx = w / 2, cy = h * 0.46;
  const maxD = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const big = makeNoise(23), fine = makeNoise(71);
  // 落下时溅出去的几滴，落在哪儿，哪儿就晚一点晕开一小团
  const drops = Array.from({ length: 4 + ((Math.random() * 3) | 0) }, () => {
    const ang = rnd(0, Math.PI * 2), dist = rnd(0.1, 0.32) * Math.min(w, h);
    return { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist, s: rnd(1.6, 3.4), late: rnd(0.06, 0.18), r: rnd(2, 4.5) };
  });
  const g = grid((x, y) => {
    const d = Math.hypot(x - cx, y - cy) / maxD;
    let t = d * (0.7 + 0.6 * big(x / 150, y / 150)) + (fine(x / 26, y / 26) - 0.5) * 0.06;
    drops.forEach((p) => { t = Math.min(t, p.late + (Math.hypot(x - p.x, y - p.y) / maxD) * p.s * (0.8 + 0.4 * big(x / 60 + 9, y / 60))); });
    return t;
  });
  const sheet = paper(w, h, { base: '8,6,8', fiber: '120,90,100', fibers: Math.round((w * h) / 700), seed: 9 });
  const v = view(el);
  el.style.background = 'transparent';
  const paint = (r) => {
    const md = g.mask.img.data, gd = g.glow.img.data;
    for (let i = 0; i < g.t.length; i++) {
      const o = i * 4;
      const t = g.t[i], u = t - r;
      if (u > 0.02) { md[o + 3] = 255; gd[o + 3] = 0; continue; }
      if (u < -0.32) { md[o + 3] = 0; gd[o + 3] = 0; continue; }
      md[o + 3] = u > 0.004 ? 255 : u > -0.004 ? ((u + 0.004) / 0.008) * 255 : 0;
      const tx = g.tex[i];
      if (u > -0.008) {
        // 墨的边缘积得深，像水痕
        const k = Math.max(0, u) / 0.02;
        gd[o] = 104; gd[o + 1] = 4; gd[o + 2] = 18; gd[o + 3] = 255 * (1 - k);
      } else {
        // 墨晕里面：一圈圈淡淡的水痕，颗粒感，越往里越淡，露出底下的加载页
        const k = -u / 0.32;
        const ring = 0.8 + 0.2 * Math.sin(t * 95);
        gd[o] = (128 + 70 * tx) * ring; gd[o + 1] = (6 + 10 * tx) * ring; gd[o + 2] = (22 + 16 * tx) * ring;
        gd[o + 3] = 245 * Math.pow(1 - k, 1.6) * (0.75 + 0.25 * tx);
      }
    }
    compose(v, sheet, g);
  };
  paint(-1);
  const drawDrop = (ctx, x, y, s, stretch) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / stretch, s * stretch);
    const gr = ctx.createRadialGradient(-3, 3, 1, 0, 5, 13);
    gr.addColorStop(0, '#FF6B78');
    gr.addColorStop(0.45, '#C3122F');
    gr.addColorStop(1, '#5C0512');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.bezierCurveTo(6, -8, 12, 1, 12, 8);
    ctx.arc(0, 8, 12, 0, Math.PI);
    ctx.bezierCurveTo(-12, 1, -6, -8, 0, -20);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,232,.7)';
    ctx.beginPath();
    ctx.ellipse(-4.5, 4, 2.2, 3.6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  // 墨滴落下，越落越快，拉长一点
  await animate(620, (k) => {
    paint(-1);
    drawDrop(v.ctx, cx, -40 + (cy + 32) * k * k, 1, 1 + k * 0.35);
  });
  sfx('drop');
  // 溅开：水花往外飞，落到各自的位置
  const splash = drops.map((p) => ({ ...p, vx: p.x - cx, vy: p.y - cy }));
  let last = 0;
  await animate(3000, (k, s) => {
    last = s;
    const r = 1.45 * (1 - Math.pow(1 - k, 2.4)) * Math.min(1, 0.3 + k * 1.3);
    paint(r);
    const ctx = v.ctx;
    // 落点的一圈涟漪
    if (k < 0.18) {
      const q = k / 0.18;
      ctx.strokeStyle = `rgba(255,120,130,${0.5 * (1 - q)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14 + q * 70, 6 + q * 28, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 飞出去的小墨滴，在 late 之前落地
    splash.forEach((p) => {
      const q = clamp(k / (p.late * 2));
      if (q >= 1) return;
      const e = 1 - Math.pow(1 - q, 2);
      const arc = Math.sin(q * Math.PI) * 26;
      ctx.fillStyle = '#C3122F';
      ctx.beginPath();
      ctx.arc(cx + p.vx * e, cy + p.vy * e - arc, p.r * (1 - q * 0.4), 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

// ---------- 第三版：彼岸花瓣和花头从左边卷过去 ----------
// 彼岸花的花瓣：细长，边缘起伏，往后卷
function lilyPetal(len, wid, curl, seed) {
  const c = offscreen(Math.round(len + 10), Math.round(wid * 2 + curl + 14));
  const x = c.getContext('2d');
  const mid = wid + curl + 6;
  const top = [], bot = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const yc = mid - curl * t * t;
    const wd = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.8) * (1 + 0.2 * Math.sin(t * Math.PI * 7 + seed));
    top.push([5 + len * t, yc - wd]);
    bot.push([5 + len * t, yc + wd * 0.75]);
  }
  const g = x.createLinearGradient(5, 0, len + 5, 0);
  g.addColorStop(0, '#4E0410');
  g.addColorStop(0.35, '#B5102B');
  g.addColorStop(0.72, '#E8364A');
  g.addColorStop(1, '#FF8A93');
  x.fillStyle = g;
  x.beginPath();
  top.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  bot.reverse().forEach(([px, py]) => x.lineTo(px, py));
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(70,0,10,.35)';
  x.lineWidth = 0.6;
  x.stroke();
  // 中间一道浅色的脉
  x.strokeStyle = 'rgba(255,190,196,.4)';
  x.lineWidth = 0.7;
  x.beginPath();
  for (let i = 1; i <= 22; i++) {
    const t = i / 24;
    const px = 5 + len * t, py = mid - curl * t * t - wid * 0.05;
    i === 1 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
  x.stroke();
  return c;
}
// 花蕊：长长的细丝，头上一点花药
function stamen(len, curl) {
  const c = offscreen(Math.round(len + 10), Math.round(curl + 14));
  const x = c.getContext('2d');
  x.strokeStyle = '#E3243B';
  x.lineWidth = 0.9;
  x.beginPath();
  x.moveTo(3, curl + 8);
  x.quadraticCurveTo(len * 0.6, curl + 6, len + 3, 7);
  x.stroke();
  x.fillStyle = '#FFC2C8';
  x.beginPath();
  x.ellipse(len + 3, 7, 2.2, 1.3, -0.4, 0, Math.PI * 2);
  x.fill();
  return c;
}
function lilyHead(R, seed) {
  const c = offscreen(Math.ceil(R * 3.6), Math.ceil(R * 3.6));
  drawHead(c.getContext('2d'), c.width / 2, c.height / 2, R, { tilt: rnd(0.3, 0.9), roll: rnd(-0.6, 0.6), seed, light: 0.95, detail: 8 });
  return c;
}

async function petal(el, sfx) {
  const w = innerWidth, h = innerHeight;
  const v = view(el, Math.min(DPR, 1.5));
  el.style.background = 'transparent';
  const S = Math.max(0.75, Math.min(1.6, Math.min(w, h) / 420));
  const petals = [lilyPetal(70, 6, 10, 1), lilyPetal(58, 5, 14, 2), lilyPetal(80, 5.5, 6, 3), lilyPetal(50, 6.5, 11, 4), lilyPetal(64, 4.5, 16, 5)];
  const stamens = [stamen(70, 10), stamen(56, 16), stamen(80, 6)];
  const heads = [lilyHead(16, 3), lilyHead(19, 8), lilyHead(14, 13)];
  const noise = makeNoise(5);
  // 前沿：从左往右推过去，边缘起伏
  const front = (y, e) => -0.3 * w + e * 1.62 * w + Math.sin((y / h) * 5.2 + e * 4) * 0.05 * w + (noise(y / 120, e * 3) - 0.5) * 0.12 * w;
  // 黑幕画在小画布上再放大，前沿就是柔和的羽化边
  const lc = offscreen(Math.ceil(w / 6), Math.ceil(h / 6));
  const lx = lc.getContext('2d');
  lx.scale(1 / 6, 1 / 6);
  const N = Math.round(300 * Math.min(1.7, Math.sqrt((w * h) / (375 * 812))));
  const ps = Array.from({ length: N }, (_, i) => {
    const r = Math.random();
    const z = r < 0.35 ? 0.55 : r < 0.82 ? 1 : 1.6; // 远、中、近三层
    const kind = i < 12 ? 'head' : Math.random() < 0.13 ? 'stamen' : 'petal';
    const set = kind === 'head' ? heads : kind === 'stamen' ? stamens : petals;
    return {
      z, kind, sp: set[(Math.random() * set.length) | 0],
      y0: rnd(-0.1, 1.1) * h,
      // 大多挤在前沿上，把黑边盖住；一部分拖在后面，少数跑在前面
      lead: Math.random() < 0.7 ? -Math.pow(Math.random(), 2) * 0.22 * w : Math.random() < 0.6 ? rnd(-0.6, -0.2) * w : rnd(0, 0.14) * w,
      rot: rnd(0, Math.PI * 2), spin: rnd(-3.2, 3.2) * (kind === 'head' ? 0.4 : 1),
      flip: rnd(2, 6), ph: rnd(0, Math.PI * 2),
      size: rnd(0.75, 1.3) * S * z,
      rise: rnd(0.05, 0.3) * h, drift: rnd(0.1, 0.35) * w,
      swirl: rnd(14, 50) * S, om: rnd(1.5, 3.5),
      alpha: z < 1 ? 0.5 : z > 1 ? 0.95 : 0.88,
    };
  }).sort((a, b) => a.z - b.z);
  sfx('petal');
  await animate(3200, (k, s) => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const ctx = v.ctx;
    lx.clearRect(0, 0, w, h);
    lx.fillStyle = '#050308';
    lx.beginPath();
    lx.moveTo(w + 30, -30);
    for (let y = -30; y <= h + 30; y += 24) lx.lineTo(front(y, e), y);
    lx.lineTo(w + 30, h + 30);
    lx.closePath();
    lx.fill();
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(lc, 0, 0, w, h);
    // 花瓣跟着前沿卷过去，打着旋，越到后面越往上飘、越淡；近处的走得快
    ps.forEach((p) => {
      const behind = clamp(-p.lead / (0.6 * w));
      const x = front(p.y0, e) + p.lead * p.z + e * p.drift * p.z + Math.cos(s * p.om + p.ph) * p.swirl * p.z;
      const y = p.y0 - e * p.rise * p.z + Math.sin(s * p.om + p.ph) * p.swirl * 0.6 * p.z;
      if (x < -120 || x > w + 120) return;
      const fade = clamp(1.4 - behind * 1.1 - Math.max(0, e - 0.78) * 3.4) * p.alpha;
      if (fade <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.spin * s);
      const fl = p.kind === 'head' ? 1 : Math.cos(s * p.flip + p.ph);
      ctx.scale(p.size, p.size * (0.25 + 0.75 * Math.abs(fl)) * Math.sign(fl || 1));
      ctx.drawImage(p.sp, -p.sp.width / 2, -p.sp.height / 2);
      ctx.restore();
    });
  });
}

export async function playTransition(kind, { onDark, sfx = () => {} }) {
  const el = document.createElement('div');
  el.className = 'trans';
  document.body.appendChild(el);
  // 先从琴房变全黑
  await el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-in', fill: 'forwards' }).finished;
  onDark();
  await new Promise((r) => setTimeout(r, 350));
  if (kind === 'burn') await burn(el, sfx);
  else if (kind === 'ink') await ink(el, sfx);
  else await petal(el, sfx);
  el.remove();
}
