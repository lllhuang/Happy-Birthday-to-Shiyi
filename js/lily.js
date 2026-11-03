// 彼岸花：按真实结构算出来的，不是描线。
// 一个花头有 6～7 朵小花，每朵 6 片细长反卷、边缘起皱的花瓣和 6 根又长又翘的花蕊。
// 花瓣切成一小段一小段，每段按朝向算明暗，再从后往前画，最后加一层泛光。

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const rng = (seed) => {
  let s = (seed * 7919 + 13) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

// 从花瓣的暗部到高光
const RAMP = [[30, 1, 10], [84, 3, 18], [156, 7, 28], [214, 18, 40], [246, 58, 66], [255, 128, 112]];
function ramp(v) {
  const x = clamp(v) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, x | 0);
  const k = x - i;
  const [a, b] = [RAMP[i], RAMP[i + 1]];
  return `rgb(${(a[0] + (b[0] - a[0]) * k) | 0},${(a[1] + (b[1] - a[1]) * k) | 0},${(a[2] + (b[2] - a[2]) * k) | 0})`;
}
const LIGHT = norm([-0.35, 0.55, 0.76]);

// cx, cy 是花头中心，R 是花头半径（花蕊会伸到 R 外面一点）
// open：0 是花苞，1 是全开；tilt：花头往上仰的角度；roll：在画面里的歪斜
export function drawHead(ctx, cx, cy, R, { open = 1, tilt = 0.55, roll = 0, seed = 7, light = 1, detail = 14 } = {}) {
  if (open <= 0.001) return;
  const rnd = rng(seed);
  const e = open * open * (3 - 2 * open);
  const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
  // 花头局部坐标（z 是花头朝向）转到画面坐标（y 朝上，z 朝观众）
  const view = ([x, y, z]) => {
    const y1 = y * ct - z * st;
    const z1 = y * st + z * ct;
    return [x * cr - y1 * sr, x * sr + y1 * cr, z1];
  };
  const screen = (p) => {
    const k = 1 / (1 - p[2] / (R * 5));
    return [cx + p[0] * k, cy - p[1] * k, p[2]];
  };
  const items = [];
  const florets = 6 + (seed % 2);
  for (let i = 0; i < florets; i++) {
    const az = (i / florets) * TAU + (rnd() - 0.5) * 0.4;
    const pol = (0.32 + 0.72 * e) * (0.9 + rnd() * 0.25);
    const a = [Math.sin(pol) * Math.cos(az), Math.sin(pol) * Math.sin(az), Math.cos(pol)];
    const e1 = norm(cross(a, [0.3, 0.2, 1]));
    const e2 = cross(a, e1);
    const base = [a[0] * R * 0.05, a[1] * R * 0.05, a[2] * R * 0.05];
    const size = 0.9 + rnd() * 0.22;

    for (let k = 0; k < 6; k++) {
      const psi = (k / 6) * TAU + rnd() * 0.3;
      const r = add([e1[0] * Math.cos(psi), e1[1] * Math.cos(psi), e1[2] * Math.cos(psi)], e2, Math.sin(psi));
      const side = norm(cross(a, r));
      const L = R * 0.66 * size * (0.25 + 0.75 * e) * (0.9 + rnd() * 0.2);
      const curl = (0.4 + 2.9 * e) * (0.85 + rnd() * 0.3);
      const phi0 = 0.14 + 0.26 * e;
      const W = R * 0.066 * (0.85 + rnd() * 0.3);
      const ph = rnd() * TAU;
      let P = base;
      let lastL = null, lastR = null, lastM = null;
      for (let j = 0; j <= detail; j++) {
        const t = j / detail;
        const phi = phi0 + curl * Math.pow(t, 1.7);
        const c = Math.cos(phi), s = Math.sin(phi);
        const d = norm([a[0] * c + r[0] * s, a[1] * c + r[1] * s, a[2] * c + r[2] * s]);
        const n = cross(d, side);
        const wid = W * Math.pow(Math.sin(Math.PI * clamp(t * 0.97 + 0.03)), 0.7) * (1 - 0.3 * t);
        const ruffle = R * 0.014 * Math.sin(t * 13 + ph) * Math.min(1, t * 3);
        const lift = R * 0.018 * Math.sin(t * 10 + ph * 2);
        const pl = screen(view(add(add(P, side, wid + ruffle), n, lift)));
        const pr = screen(view(add(add(P, side, -wid + ruffle * 0.5), n, -lift * 0.7)));
        const pm = screen(view(P));
        if (j > 0) {
          const nv = view(n);
          const lam = Math.abs(dot(nv, LIGHT));
          const front = nv[2] > 0 ? 1 : 0.62;
          const shade = (0.1 + 0.6 * lam * front + 0.2 * t + (pm[2] / R) * 0.1 - (t < 0.14 ? 0.12 : 0)) * light;
          const z = (lastM[2] + pm[2]) / 2;
          items.push({ z, q: [lastL, pl, pr, lastR], c: ramp(shade) });
          // 花瓣中间那条脉，和亮起来的一条边
          items.push({ z: z + 0.1, l: [lastM, pm], c: ramp(shade + 0.13), w: R * 0.006 * (1 - t * 0.6) });
          items.push({ z: z + 0.1, l: [lastL, pl], c: ramp(shade + 0.17), w: R * 0.004 });
        }
        lastL = pl; lastR = pr; lastM = pm;
        P = add(P, d, L / detail);
      }
    }

    // 花蕊：先顺着小花往外，再一起往上翘
    const sten = clamp((open - 0.2) / 0.8);
    if (sten > 0) {
      for (let m = 0; m < 7; m++) {
        const b = (m / 7) * TAU + rnd();
        const dir = norm(add(add(a, e1, Math.cos(b) * 0.2), e2, Math.sin(b) * 0.2));
        const dv = view(dir);
        const upv = norm(add(dv, [0, 0.9, 0.2]));
        const len = R * (m === 6 ? 1.3 : 0.98 + rnd() * 0.24) * sten;
        const steps = Math.max(6, detail - 3);
        let P = view(base);
        let last = screen(P);
        for (let j = 1; j <= steps; j++) {
          const t = j / steps;
          const w = Math.pow(t, 1.4);
          P = add(P, norm([dv[0] + (upv[0] - dv[0]) * w, dv[1] + (upv[1] - dv[1]) * w, dv[2] + (upv[2] - dv[2]) * w]), len / steps);
          const q = screen(P);
          items.push({ z: (last[2] + q[2]) / 2 + 0.2, l: [last, q], c: ramp((0.38 + 0.5 * t) * light), w: R * 0.01 * (1 - 0.6 * t) });
          last = q;
        }
        if (m < 6) items.push({ z: last[2] + 0.3, a: last, r: R * 0.022 * sten, rot: rnd() * 3, light });
      }
    }
  }

  items.sort((p, q) => p.z - q.z);
  ctx.lineCap = 'round';
  for (const it of items) {
    if (it.q) {
      const [a, b, c, d] = it.q;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
      ctx.fillStyle = it.c;
      ctx.strokeStyle = it.c;
      ctx.lineWidth = 0.7;
      ctx.fill();
      ctx.stroke();
    } else if (it.l) {
      ctx.beginPath();
      ctx.moveTo(it.l[0][0], it.l[0][1]);
      ctx.lineTo(it.l[1][0], it.l[1][1]);
      ctx.strokeStyle = it.c;
      ctx.lineWidth = Math.max(0.5, it.w);
      ctx.stroke();
    } else {
      // 花药：金色的一小粒
      ctx.beginPath();
      ctx.ellipse(it.a[0], it.a[1], it.r * 1.5, it.r * 0.6, it.rot, 0, TAU);
      ctx.fillStyle = it.light < 0.8 ? '#D9A95C' : '#FFE0A0';
      ctx.fill();
    }
  }
}

// 花茎：光秃秃的一根，没有叶子，这也是彼岸花的特点
export function drawStem(ctx, x0, y0, x1, y1, bend, width) {
  const cx = (x0 + x1) / 2 + bend;
  const cy = (y0 + y1) / 2;
  const g = ctx.createLinearGradient(0, y1, 0, y0);
  g.addColorStop(0, '#6E2A3A');
  g.addColorStop(0.45, '#35301F');
  g.addColorStop(1, '#141A10');
  ctx.lineCap = 'round';
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,120,120,.28)';
  ctx.lineWidth = Math.max(0.6, width * 0.22);
  ctx.beginPath();
  ctx.moveTo(x0 - width * 0.25, y0);
  ctx.quadraticCurveTo(cx - width * 0.25, cy, x1 - width * 0.25, y1);
  ctx.stroke();
}

// 泛光：把画面缩小再放大叠回来。不用 ctx.filter，iOS 上不支持
const blurA = document.createElement('canvas');
const blurB = document.createElement('canvas');
export function addBloom(ctx, canvas, strength = 0.8) {
  const w = canvas.width, h = canvas.height;
  blurA.width = Math.max(1, w >> 3);
  blurA.height = Math.max(1, h >> 3);
  blurB.width = Math.max(1, w >> 5);
  blurB.height = Math.max(1, h >> 5);
  const a = blurA.getContext('2d'), b = blurB.getContext('2d');
  a.imageSmoothingQuality = 'high';
  b.imageSmoothingQuality = 'high';
  a.drawImage(canvas, 0, 0, blurA.width, blurA.height);
  b.drawImage(blurA, 0, 0, blurB.width, blurB.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = strength * 0.55;
  ctx.drawImage(blurA, 0, 0, w, h);
  ctx.globalAlpha = strength;
  ctx.drawImage(blurB, 0, 0, w, h);
  ctx.restore();
}

// 黑红过场用的三朵花。每朵的开放过程提前画成十来张图，播放时只贴图，手机上也不卡。
// 被切开以后按两条刀痕分成四块错开，再从像素里取样，变成同色的星光飘散
const FRAMES = 10;
const smooth = (t) => t * t * (3 - 2 * t);

function dotSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, '#FFF6E6');
  g.addColorStop(0.18, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return c;
}
function starSprite(color) {
  const c = dotSprite(color);
  const x = c.getContext('2d');
  x.fillStyle = '#FFF6E6';
  x.beginPath();
  x.moveTo(16, 0);
  x.quadraticCurveTo(17, 15, 32, 16);
  x.quadraticCurveTo(17, 17, 16, 32);
  x.quadraticCurveTo(15, 17, 0, 16);
  x.quadraticCurveTo(15, 15, 16, 0);
  x.fill();
  return c;
}

export class LilyField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dots = [dotSprite('#FF3B4E'), dotSprite('#FF8A7A'), dotSprite('#FFD58A')];
    this.stars = [starSprite('#FF3B4E'), starSprite('#FF8A7A'), starSprite('#FFD58A')];
    this.resize();
  }

  resize() {
    const W = (this.W = innerWidth), H = (this.H = innerHeight);
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    const R = Math.min(W * 0.4, H * 0.25);
    this.flowers = [
      { x: W * 0.14, y: H * 0.64, r: R * 0.5, tilt: 0.95, roll: -0.3, seed: 3, light: 0.68, bend: 22, late: 0.1 },
      { x: W * 0.87, y: H * 0.6, r: R * 0.58, tilt: 0.9, roll: 0.34, seed: 8, light: 0.72, bend: -26, late: 0.05 },
      { x: W * 0.5, y: H * 0.46, r: R, tilt: 0.6, roll: 0.08, seed: 11, light: 1, bend: -34, late: 0 },
    ];
    // 两刀的方向，和 main.js 里的剑气一致；都穿过大花的花心
    const unit = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
    this.u = unit(1.24 * W, -0.64 * H);
    this.v = unit(1.2 * W, 0.4 * H);
    this.flowers.forEach((f) => { f.sprites = []; f.ps = null; });
    this.queue = null;
    if (this.started) { this.started = false; this.prepare(); }
  }

  // 分批画，不卡住滚动
  prepare() {
    if (this.started) return;
    this.started = true;
    this.queue = [];
    this.flowers.forEach((f) => { for (let k = 0; k < FRAMES; k++) this.queue.push([f, k]); });
    // 先把每朵的全开图画好，万一滑得很快也有东西可看
    this.queue.sort((a, b) => (b[1] === FRAMES - 1) - (a[1] === FRAMES - 1));
    const step = () => {
      if (!this.queue || !this.queue.length) return;
      const [f, k] = this.queue.shift();
      this.bake(f, k);
      setTimeout(step, 16);
    };
    step();
  }

  bake(f, k) {
    const sd = Math.min(this.dpr, 1.5);
    const size = f.r * 3.8;
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(size * sd);
    const x = c.getContext('2d');
    x.scale(sd, sd);
    drawHead(x, size / 2, size / 2, f.r, { open: Math.max(0.02, k / (FRAMES - 1)), tilt: f.tilt, roll: f.roll, seed: f.seed, light: f.light, detail: f.r > 90 ? 14 : 10 });
    addBloom(x, c, 0.5);
    f.sprites[k] = c;
    if (k === FRAMES - 1) this.sample(f, c, size);
  }

  // 从全开的花上取样，星光的位置和颜色都来自花本身
  sample(f, c, size) {
    const n = Math.round((innerWidth < 700 ? 1100 : 1900) * (f.r / this.flowers[2].r));
    const g = 72;
    const t = document.createElement('canvas');
    t.width = t.height = g;
    const x = t.getContext('2d', { willReadFrequently: true });
    x.drawImage(c, 0, 0, g, g);
    const d = x.getImageData(0, 0, g, g).data;
    const cells = [];
    for (let i = 0; i < g * g; i++) {
      if (d[i * 4 + 3] > 50 && d[i * 4] + d[i * 4 + 1] > 90) cells.push(i);
    }
    const cell = size / g;
    f.ps = [];
    for (let i = 0; i < n && cells.length; i++) {
      const id = cells[(Math.random() * cells.length) | 0];
      const r = d[id * 4], gr = d[id * 4 + 1];
      const px = ((id % g) + Math.random()) * cell - size / 2;
      const py = (((id / g) | 0) + Math.random()) * cell - size / 2;
      const a = Math.random() * TAU;
      const sp = f.r * (0.35 + Math.random() * 1.1);
      f.ps.push({
        px, py,
        hue: gr > 170 ? 2 : gr > 70 && r > 200 ? 1 : 0,
        dx: px * 0.5 + Math.cos(a) * sp,
        dy: py * 0.5 + Math.sin(a) * sp * 0.6 - f.r * (0.5 + Math.random() * 1.1),
        size: 1.6 + Math.random() * Math.random() * 5,
        star: Math.random() < 0.09,
        delay: Math.min(0.42, (Math.hypot(px, py) / (f.r * 1.8)) * 0.3 + Math.random() * 0.14),
        ph: Math.random() * TAU,
        tw: 1.5 + Math.random() * 3,
      });
    }
  }

  // 贴一张开放到 open 的花；相邻两张叠着过渡，看不出跳帧
  head(ctx, f, x, y, open) {
    const v = open * (FRAMES - 1);
    let i = Math.floor(v);
    while (i > 0 && !f.sprites[i]) i--;
    const a = f.sprites[i] || f.sprites[FRAMES - 1];
    if (!a) return;
    const size = f.r * 3.8;
    const base = ctx.globalAlpha;
    ctx.drawImage(a, x - size / 2, y - size / 2, size, size);
    const b = f.sprites[i + 1];
    if (b && v > i) {
      ctx.globalAlpha = base * (v - i);
      ctx.drawImage(b, x - size / 2, y - size / 2, size, size);
      ctx.globalAlpha = base;
    }
  }

  // 大花被切开：按两条刀痕分成四块，慢慢错开
  cutHead(ctx, f, x, y, open, gap) {
    const [ux, uy] = this.u, [vx, vy] = this.v;
    const L = f.r * 3;
    for (const s1 of [-1, 1]) {
      for (const s2 of [-1, 1]) {
        ctx.save();
        const ax = ux * s1 * L, ay = uy * s1 * L, bx = vx * s2 * L, by = vy * s2 * L;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ax, y + ay);
        ctx.lineTo(x + ax + bx, y + ay + by);
        ctx.lineTo(x + bx, y + by);
        ctx.closePath();
        ctx.clip();
        this.head(ctx, f, x + (ux * s1 + vx * s2) * gap, y + (uy * s1 + vy * s2) * gap, open);
        ctx.restore();
      }
    }
  }

  draw({ open, cut, gone, time }) {
    const { ctx, W, H, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.flowers.forEach((f, i) => {
      const o = open[i];
      if (o <= 0) return;
      const t = clamp((gone - f.late) / 0.5);
      const fade = 1 - smooth(t);
      const top = H + (f.y - H) * smooth(clamp(o * 2.2));
      if (fade > 0.005) {
        ctx.globalAlpha = fade;
        drawStem(ctx, f.x, H, f.x, top, f.bend, Math.max(2.4, f.r * 0.05));
        const gap = f.r * (0.04 * Math.min(cut[0], cut[1]) + 0.16 * smooth(gone));
        if (i === 2 && cut[0] > 0.5) this.cutHead(ctx, f, f.x, top, o, gap);
        else this.head(ctx, f, f.x, top, o);
        ctx.globalAlpha = 1;
      }
      if (gone > f.late && f.ps) this.dust(ctx, f, top, clamp((gone - f.late) / (1 - f.late)), time);
    });
    ctx.globalAlpha = 1;
  }

  // 星光：一粒一粒从花上离开，飘起来，闪着慢慢淡掉
  dust(ctx, f, top, g, time) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of f.ps) {
      const u = clamp((g - p.delay) / (1 - p.delay * 0.6));
      if (u <= 0) continue;
      const e = 1 - Math.pow(1 - u, 2.2);
      const wob = Math.sin(time * 0.001 * p.tw + p.ph);
      const a = Math.min(1, u * 5) * Math.pow(1 - u, 1.3) * (0.62 + 0.38 * wob);
      if (a < 0.01) continue;
      const x = f.x + p.px + p.dx * e + wob * 5 * u;
      const y = top + p.py + p.dy * e;
      const s = p.size * (p.star ? 3.4 : 2) * (1 - u * 0.4);
      ctx.globalAlpha = a;
      ctx.drawImage(p.star ? this.stars[p.hue] : this.dots[p.hue], x - s / 2, y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
