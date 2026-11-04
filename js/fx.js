// 视觉小特效：星星、彩纸、烟花

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAR_PATH = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z';

export function sparkle(x, y, { color = '#fff', count = 7, spread = 70, layer = document.body } = {}) {
  for (let i = 0; i < count; i++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.classList.add('fx-star');
    const size = 8 + Math.random() * 14;
    s.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;color:${color}`;
    s.innerHTML = `<path d="${STAR_PATH}" fill="currentColor"/>`;
    layer.appendChild(s);
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.6);
    const anim = s.animate(
      [
        { transform: 'translate(0,0) scale(0.2) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(1) rotate(${90 + Math.random() * 90}deg)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * d * 1.2}px,${Math.sin(a) * d * 1.2 + 20}px) scale(0) rotate(180deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }
    );
    anim.onfinish = () => s.remove();
  }
}

export function floatNote(x, y, { color = '#fff', layer = document.body, rise = 160, cls = '' } = {}) {
  const n = document.createElement('span');
  n.className = 'fx-note' + (cls ? ' ' + cls : '');
  n.textContent = ['♪', '♫', '♩', '♬'][(Math.random() * 4) | 0];
  n.style.cssText = `left:${x}px;top:${y}px;color:${color}`;
  layer.appendChild(n);
  const dx = (Math.random() - 0.5) * 80;
  const anim = n.animate(
    [
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.4}px),calc(-50% - ${rise * 0.3}px)) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${dx}px),calc(-50% - ${rise}px)) scale(1.1) rotate(${dx / 4}deg)`, opacity: 0 },
    ],
    { duration: 2200 + Math.random() * 800, easing: 'ease-out' }
  );
  anim.onfinish = () => n.remove();
}

// zoom：画布被 CSS 放大了几倍，分辨率跟着提高，放大后才不糊。尺寸取排版里的大小，不受放大影响
function fitCanvas(c, maxDpr = 2, zoom = 1) {
  const dpr = Math.min(Math.min(window.devicePixelRatio || 1, maxDpr) * zoom, Math.max(maxDpr, 2));
  const r = c.getBoundingClientRect();
  const w = c.offsetWidth || r.width, h = c.offsetHeight || r.height;
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// 彩纸
export function confetti(canvas, { count = 140, colors = ['#F2A7B8', '#8FB8E8', '#FFD58A', '#FFFFFF', '#D7263D'] } = {}) {
  const { ctx, w, h } = fitCanvas(canvas, 1.5);
  const ps = [];
  for (let i = 0; i < count; i++) {
    ps.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.55,
      vx: (Math.random() - 0.5) * 11,
      vy: -8 - Math.random() * 9,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: 5 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.3,
    });
  }
  let alive = true;
  const t0 = performance.now();
  const step = () => {
    ctx.clearRect(0, 0, w, h);
    const age = (performance.now() - t0) / 1000;
    ps.forEach((p) => {
      p.vy += 0.22;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx + Math.sin(age * 3 + p.r) * 0.6;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 5);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(1, Math.cos(age * 6 + p.r));
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      }
      ctx.restore();
    });
    if (age < 5 && alive) requestAnimationFrame(step);
    else ctx.clearRect(0, 0, w, h);
  };
  requestAnimationFrame(step);
  return () => (alive = false);
}

// 文字/图形转成点阵，给烟花拼形状用
function shapePoints(kind, gap = 6) {
  if (kind === 'heart') {
    const pts = [];
    for (let i = 0; i < 70; i++) {
      const t = (i / 70) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push([x / 17, y / 17]);
    }
    return pts;
  }
  if (kind === 'star') {
    // 五角星的轮廓：外角半径 1、内角半径 0.382，一共 10 条边，点沿边均匀撒开；放的时候再随机转个角度
    const v = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.382 : 1;
      v.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const pts = [];
    const per = 7; // 每条边 7 个点，一共 70 个，和爱心一样多
    for (let i = 0; i < 10; i++) {
      const [x0, y0] = v[i], [x1, y1] = v[(i + 1) % 10];
      for (let k = 0; k < per; k++) pts.push([x0 + ((x1 - x0) * k) / per, y0 + ((y1 - y0) * k) / per]);
    }
    return pts;
  }
  // “25”保持原样；中文用页面已加载的悠哉字体，描边加粗，细笔画才不会漏点
  const cjk = kind !== '25';
  const W = cjk ? kind.length * 130 + 20 : 220;
  const step = cjk ? gap : 7;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = 140;
  const x = c.getContext('2d');
  x.fillStyle = x.strokeStyle = '#000';
  x.font = cjk ? '120px Yozai, sans-serif' : 'bold 120px "WenKai", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(kind, W / 2, 74);
  if (cjk) {
    x.lineWidth = 7;
    x.lineJoin = 'round';
    x.strokeText(kind, W / 2, 74);
  }
  const d = x.getImageData(0, 0, W, 140).data;
  const pts = [];
  for (let yy = 0; yy < 140; yy += step) {
    for (let xx = 0; xx < W; xx += step) {
      if (d[(Math.floor(yy) * W + Math.floor(xx)) * 4 + 3] < 128) continue;
      // 中文的点位错开一点，不像整齐的像素格
      const j = cjk ? step * 0.28 : 0;
      pts.push([(xx - W / 2 + rnd(-j, j)) / 70, (yy - 70 + rnd(-j, j)) / 70]);
    }
  }
  return pts;
}

// 浅色：白、香槟、粉、金、浅蓝。深色：玫红、蓝、紫、青、橙、珊瑚
const FW_LIGHT = ['#FFFFFF', '#F7DFA8', '#FF9CC2', '#FFC94A', '#8FD3FF'];
const FW_DARK = ['#FF3D7F', '#3F8CFF', '#A66BFF', '#3FD6C6', '#FF8A3D', '#FF7A6B'];
const RAINBOW = [...FW_LIGHT, ...FW_DARK];
const GOLD = ['#FFD58A', '#FFB65C', '#FFF0C2'];
// 牡丹用精修的 B 版（球形炸开、先猛后悬、熄灭有先后）；?fw=a 还能看原来的 A 版
const FW_B = new URLSearchParams(location.search).get('fw') !== 'a';
const GLITTER = ['#FFF4D6', '#F7DFA8', '#FFD58A'];
// 每发两种颜色：一半是一浅一深，一半是两种不同的浅色
function twoColors() {
  const a = pick(FW_LIGHT);
  if (Math.random() < 0.5) return [a, pick(FW_DARK)];
  let b = pick(FW_LIGHT);
  while (b === a) b = pick(FW_LIGHT);
  return [a, b];
}
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// 烟花：每一发都有自己的上升时间 T，上升和炸开的瞬间各回调一次（声音靠这个对齐）
export class Fireworks {
  constructor(canvas, { onLaunch, onBurst, onCrackle } = {}) {
    this.canvas = canvas;
    Object.assign(this, { onLaunch, onBurst, onCrackle });
    this.rockets = [];
    this.parts = [];
    this.flashes = [];
    this.timers = [];
    this.running = false;
    this.shapes = {};
    this.Z = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    // 烟花本来就是发光的细线，1.5 倍分辨率看不出差别，要填的像素却少将近一半
    const f = fitCanvas(this.canvas, 1.5, this.Z);
    this.ctx = f.ctx;
    this.w = f.w;
    this.h = f.h;
    // 窗户当背景：镜头推近只放大背景，烟花在屏幕上的大小和速度不变，所以烟花尺度要除以放大倍数 Z
    const s0 = Math.max(0.6, Math.min(this.w, this.h) / 420);
    this.S = s0 / this.Z;
    // 火星线宽也跟着窗户缩放：手机上窗户小，线还一样粗就显得像塑料。
    // 镜头推近时窗户被放大 Z 倍，线宽再除以 Z，屏幕上的粗细和推近前一样
    this.L = Math.min(1, s0) / this.Z;
    this.Q = innerWidth < 700 ? 0.62 : 1; // 手机上粒子少一些
    this.cap = innerWidth < 700 ? 1500 : 3000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 镜头推近时窗户被放大 z 倍，画布分辨率跟着提高
  zoom(z) {
    if (Math.abs(z - this.Z) < 0.01) return;
    this.Z = z;
    this.resize();
  }

  // 文字点阵提前算好，炸开那一帧不用现算
  prepare(texts) {
    texts.forEach((t) => this._textShape(t));
  }

  // 字的大小跟着窗宽走，取点的间隔也跟着变：大屏上点不会太稀，手机上点不会太挤
  _textShape(text) {
    // base 是推近前的大小；推近后画布被放大 Z 倍，所以画小 Z 倍，屏幕上一样大，取点疏密也一样
    const base = Math.min(Math.min(this.w, this.h) * 0.3, (this.w * 0.4 * 70) / (text.length * 60));
    const scale = base / this.Z;
    const gap = Math.round(Math.max(3.5, Math.min(6, (4.2 * 70) / base)) * 2) / 2;
    const key = text + '|' + gap;
    return { scale, pts: this.shapes[key] || (this.shapes[key] = shapePoints(text, gap)) };
  }

  stop() {
    this.running = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.rockets = [];
    this.parts = [];
    this.flashes = [];
    this.ctx && this.ctx.clearRect(0, 0, this.w, this.h);
  }

  // type: peony | chrys | willow | crackle | heart | star | 25 | text | special
  // text：拼出 text 里的字；hold：造型烟花亮多久（秒）
  launch(x, { y, type, palette, delay = 0, text, hold } = {}) {
    const go = () => {
      if (!this.w) this.resize();
      const special = type === 'special';
      const ty = y ?? this.h * rnd(0.16, 0.42);
      // 推近后窗户在屏幕上变高了，升空时间跟着放大倍数拉长，屏幕上升得一样快
      const T = (special ? rnd(1.25, 1.45) : rnd(0.85, 1.25)) * this.Z;
      const r = {
        x0: x, y0: this.h + 8, x1: x + rnd(-14, 14), y1: ty, x, y: this.h + 8, t: 0, T,
        type: type || pick(['peony', 'peony', 'willow', 'crackle']), // 都是牡丹的形状，柳和碎金只是火星烧法不同
        pal: palette || twoColors(), special, text, hold,
      };
      r.pan = Math.max(-1, Math.min(1, (x / this.w) * 2 - 1)) * 0.7;
      this.rockets.push(r);
      this.onLaunch && this.onLaunch(r);
    };
    if (delay) this.timers.push(setTimeout(go, delay * 1000));
    else go();
  }

  _add(p) {
    if (this.parts.length < this.cap) this.parts.push(p);
  }

  // pop：火星烧到剩这么多寿命时噼啪一闪，变成闪烁的碎金（0 表示不闪）
  _burst(x, y, { n, speed, life, colors, drag = 0.982, g = 30, trail = 0.5, width = 1.8, twinkle = false, crackle = false, pop = 0 }) {
    const S = this.S;
    n = Math.round(n * this.Q);
    width *= this.L;
    if (FW_B) {
      // 空气阻力和速度的平方成正比：刚炸开那一下最快，越往外减速越平缓，最后被重力拉着往下坠。
      // a 越大，开头减速越猛；每朵在 30 到 48 之间随机，快慢略有不同。
      // 按“1.3 秒时飞到 A 版的大小”反推初速：距离 = ln(1 + a·t) / k，k = a / 初速
      const a0 = rnd(30, 48);
      const base = (speed * S * 0.7 * a0) / Math.log(1 + a0 * 1.3);
      const q = a0 / base;
      for (let i = 0; i < n; i++) {
        // 球形炸开：约八成火星在外圈，按最大半径的 ±1/15 抖动；两成朝前或朝后飞，投影落在圈里面。
        // pf 是投影比例，算阻力时用火星真实的速度
        const pf = Math.random() < 0.2 ? rnd(0.42, 0.88) : 1 + rnd(-1, 1) / 15;
        const a = ((i + rnd(-0.5, 0.5)) / n) * Math.PI * 2;
        this._add({ x, y, px: x, py: y, vx: Math.cos(a) * base * pf, vy: Math.sin(a) * base * pf, q, pf, life: 1, decay: 1 / (life * rnd(0.75, 1.2)), c: pick(colors), drag: 1, g: g * S * 1.3, trail, width, twinkle, crackle, pop });
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.04, 0.04);
      const sp = speed * S * rnd(0.82, 1.05);
      const burn = rnd(0.85, 1.15);
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      this._add({ x, y, px: x, py: y, vx, vy, life: 1, decay: 1 / (life * burn), c: pick(colors), drag, g: g * S, trail, width, twinkle, crackle, pop });
    }
  }

  _explode(r) {
    const { x, y, pal, type } = r;
    const big = r.special;
    this.flashes.push({ x, y, life: 1, rad: (big ? 150 : 90) * this.S, c: pal[1] });
    // 牡丹用 9882db0 那一版的数值。柳和碎金炸开的形状、大小和牡丹一样，只是火星的烧法不同
    if (type === 'peony') this._burst(x, y, { n: 110, speed: 190, life: 1.3, colors: pal, trail: 0.35, width: 2 });
    if (type === 'chrys') this._burst(x, y, { n: 120, speed: 200, life: 2, colors: pal, trail: 1.7, width: 1.3 });
    // 柳：金色火星烧得久，后半段在重力下慢慢往下垂
    if (type === 'willow') this._burst(x, y, { n: 110, speed: 190, life: 2.8, colors: GOLD, g: 62, trail: 0.8, width: 1.8 });
    // 碎金：火星飞到半路噼啪一闪，之后一闪一闪地烧完
    if (type === 'crackle') {
      this._burst(x, y, { n: 110, speed: 190, life: 1.7, colors: pal, trail: 0.35, width: 2, pop: 0.5 });
      this.onCrackle && this.timers.push(setTimeout(() => this.onCrackle(r), 850));
    }
    if (type === 'heart' || type === 'star' || type === '25' || type === 'text') {
      let pts, scale;
      if (type === 'text') ({ pts, scale } = this._textShape(r.text));
      else {
        pts = this.shapes[type] || (this.shapes[type] = shapePoints(type));
        // 五角星比别的烟花小一圈
        scale = (Math.min(this.w, this.h) * (type === 'heart' ? 0.22 : type === 'star' ? 0.15 : 0.3)) / this.Z;
      }
      const hold = r.hold || 2;
      // 五角星每朵转一个随机角度，朝向各不相同（转 72 度就和原来重合，所以在 0 到 72 度里挑）
      if (type === 'star') {
        const a = rnd(0, Math.PI * 0.4), ca = Math.cos(a), sa = Math.sin(a);
        pts = pts.map(([px, py]) => [px * ca - py * sa, px * sa + py * ca]);
      }
      // 造型不受粒子上限限制，缺几颗就看不出是什么形状了。火星停下后线长接近 0，dot 让它留成一个亮点
      pts.forEach(([px, py]) => {
        this.parts.push({ x, y, px: x, py: y, vx: px * scale * 3.6, vy: py * scale * 3.6, life: 1, decay: 1 / rnd(hold, hold + 0.4), c: Math.random() < 0.8 ? pal[0] : pal[1], drag: 0.94, g: 6, trail: 0.3, width: 2.2 / this.Z, twinkle: type === 'text' && Math.random() < 0.12, dot: true });
      });
    }
    if (big) {
      // 她自己放的：彩虹大牡丹 + 金色光环 + 闪烁的碎金 + 二次开花
      this._burst(x, y, { n: 170, speed: 260, life: 2.3, colors: pal, trail: 0.9, width: 2.2 });
      this._burst(x, y, { n: 80, speed: 200, life: 2.0, colors: ['#FFB92E', '#F7DFA8'], width: 1.8 });
      this._burst(x, y, { n: 60, speed: 90, life: 2.6, colors: ['#F7DFA8', '#FFB92E'], twinkle: true, crackle: true, width: 1.2, g: 14 });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + rnd(0, 0.4);
        const d = 120 * this.S * rnd(0.85, 1.1);
        this.timers.push(setTimeout(() => {
          const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
          this._burst(cx, cy, { n: 22, speed: 90, life: 1.1, colors: twoColors(), width: 1.4 });
          this.flashes.push({ x: cx, y: cy, life: 1, rad: 30 * this.S, c: pick(pal) });
        }, 650 + k * 40));
      }
      this.onCrackle && this.timers.push(setTimeout(() => this.onCrackle(r, true), 700));
    }
  }

  step(dt) {
    const { ctx, w, h } = this;
    const k = dt * 60;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.5, 0.2 * k)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    // 火箭
    this.rockets = this.rockets.filter((r) => {
      r.t += dt;
      const u = Math.min(1, r.t / r.T);
      const e = 1 - Math.pow(1 - u, 2.2);
      const nx = r.x0 + (r.x1 - r.x0) * e + Math.sin(r.t * 18) * 0.6;
      const ny = r.y0 + (r.y1 - r.y0) * e;
      ctx.strokeStyle = r.pal[1];
      ctx.lineWidth = (r.special ? 2.4 : 1.6) / this.Z;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      r.x = nx;
      r.y = ny;
      if (Math.random() < 0.45) this._add({ x: nx, y: ny + 2, px: nx, py: ny + 2, vx: rnd(-12, 12), vy: rnd(10, 40), life: 0.7, decay: 2.2, c: r.special ? pick(RAINBOW) : '#FFE7B0', drag: 0.95, g: 20, trail: 0, width: 1.2 });
      if (u >= 1) {
        this._explode(r);
        this.onBurst && this.onBurst(r);
        return false;
      }
      return true;
    });
    // 闪光
    this.flashes = this.flashes.filter((f) => {
      f.life -= dt * 6;
      if (f.life <= 0) return false;
      if (f.rad < 10) {
        ctx.globalAlpha = f.life;
        ctx.fillStyle = '#F7DFA8';
        ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
        return true;
      }
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rad);
      g.addColorStop(0, f.c);
      g.addColorStop(1, f.c + '00');
      ctx.globalAlpha = 0.4 * f.life;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.rad, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    // 粒子：颜色、粗细、亮度相近的归成一批，一次画完，不用每个粒子单独描一笔
    const groups = new Map();
    this.parts = this.parts.filter((p) => {
      if (p.q) {
        // 速度平方阻力：这一小段时间里速度按 1 / (1 + k·v·dt) 衰减
        const f = 1 / (1 + p.q * (Math.hypot(p.vx, p.vy) / p.pf) * dt);
        p.vx *= f;
        p.vy = p.vy * f + p.g * dt;
      } else {
        const dr = Math.pow(p.drag, k);
        p.vx *= dr;
        p.vy = p.vy * dr + p.g * dt;
      }
      p.px = p.x - p.vx * dt * p.trail * 4;
      p.py = p.y - p.vy * dt * p.trail * 4;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.pop && p.life < p.pop) {
        p.pop = 0;
        p.twinkle = true;
        p.width = 1.3 * this.L;
        p.c = pick(GLITTER);
        this.flashes.push({ x: p.x, y: p.y, life: 0.7, rad: 6, c: '#fff' });
      }
      if (p.life <= 0) {
        if (p.crackle && Math.random() < 0.5) this.flashes.push({ x: p.x, y: p.y, life: 0.6, rad: 6, c: '#fff' });
        return false;
      }
      let a = Math.min(1, p.life * 1.6);
      if (p.twinkle) a *= Math.random() < 0.5 ? 1 : 0.2;
      const al = Math.ceil(a * 5);
      const wd = Math.ceil(p.width * (0.5 + p.life * 0.7) * 2);
      const key = p.c + al + '|' + wd;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { c: p.c, a: al / 5, w: wd / 2, pts: [] }));
      g.pts.push(p.px, p.py, p.x + 0.01, p.dot ? p.y + 2 : p.y);
      return true;
    });
    ctx.lineCap = 'butt'; // 圆头最费性能，细线上也看不出差别
    // 粒子不用叠加发光：同一处画几次就会加成白色，烟花的颜色全被冲掉
    ctx.globalCompositeOperation = 'source-over';
    // 线身是颜色，头部更亮，才不像塑料。再加一层宽柔光手机上就超过 16ms 了
    for (const g of groups.values()) {
      const pts = g.pts;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 4) {
        ctx.moveTo(pts[i], pts[i + 1]);
        ctx.lineTo(pts[i + 2], pts[i + 3]);
      }
      ctx.strokeStyle = g.c;
      ctx.globalAlpha = g.a * 0.8;
      ctx.lineWidth = g.w;
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 4) {
        ctx.moveTo(pts[i] + (pts[i + 2] - pts[i]) * 0.7, pts[i + 1] + (pts[i + 3] - pts[i + 1]) * 0.7);
        ctx.lineTo(pts[i + 2], pts[i + 3]);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = g.a * 0.6;
      ctx.lineWidth = g.w;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// 水面的波光：月亮正下方一道光带，远处窄、近处宽。每个光点是一小横道，各闪各的
export class Glints {
  constructor(canvas) {
    this.canvas = canvas;
    this.on = false;
    this.running = false;
    this.ps = [];
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const f = fitCanvas(this.canvas);
    Object.assign(this, { ctx: f.ctx, w: f.w, h: f.h });
    this.build();
    if (reduceMotion && this.on) this.draw(1200);
  }
  build() {
    const { w, h } = this;
    const gauss = () => (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
    const band = ['#FFF6DA', '#FFE8B8', '#E9DFFF'];
    const n = Math.min(1500, Math.round((w * h) / 150));
    this.ps = Array.from({ length: n }, (_, i) => {
      const inBand = i % 10 < 7;
      const d = Math.pow(Math.random(), 1.5); // 0 = 远，1 = 近
      return {
        x: inBand ? w / 2 + gauss() * (0.08 + 0.36 * d) * w : Math.random() * w,
        y: d * h,
        len: (2 + d * 13) * (0.5 + Math.random() * 0.8),
        th: 0.6 + d * 0.8,
        max: inBand ? 1 : 0.5,
        c: inBand ? band[(Math.random() * 3) | 0] : '#A998EC',
        s: 0.0016 + Math.random() * 0.0034,
        o: Math.random() * 6.28,
        o2: Math.random() * 6.28,
      };
    });
  }
  set(on) {
    this.on = on;
    if (!on) return;
    if (!this.w) this.resize();
    if (reduceMotion) return this.draw(1200);
    if (this.running) return;
    this.running = true;
    const loop = (t) => {
      if (!this.on) { this.running = false; return; }
      this.draw(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  draw(t) {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ps) {
      // 两个不同频率的正弦相乘：大多数时候是暗的，偶尔才闪一下，整片水面就不会一起呼吸
      const v = Math.sin(t * p.s + p.o - p.y * 0.035) * Math.sin(t * p.s * 0.37 + p.o2);
      if (v <= 0.05) continue;
      ctx.globalAlpha = Math.sqrt(v) * v * p.max;
      ctx.fillStyle = p.c;
      const dx = Math.sin(t * 0.0005 + p.y * 0.05) * (2 + p.y / h * 6);
      ctx.fillRect(p.x + dx - p.len / 2, p.y, p.len, p.th);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// 上升的火星和花瓣（黑红段、加载页）
export class Embers {
  constructor(canvas, { colors = ['#FF4D5E', '#FFD58A', '#FF8A5C', '#E3243B'] } = {}) {
    this.canvas = canvas;
    this.colors = colors;
    this.ps = [];
    this.k = 0;
    this.running = false;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    const f = fitCanvas(this.canvas);
    Object.assign(this, { ctx: f.ctx, w: f.w, h: f.h });
  }
  set(k) {
    this.k = k;
    if (k > 0 && !this.running) this.start();
  }
  stopNow() {
    this.k = 0;
    this.ps = [];
  }
  start() {
    if (!this.w) this.resize();
    this.running = true;
    const loop = () => {
      this.step();
      if (this.k > 0 || this.ps.length) requestAnimationFrame(loop);
      else { this.running = false; this.ctx.clearRect(0, 0, this.w, this.h); }
    };
    requestAnimationFrame(loop);
  }
  step() {
    const { ctx, w, h } = this;
    const want = this.k * (w * h) / 9000;
    if (this.ps.length < want && Math.random() < 0.6) {
      const petal = Math.random() < 0.18;
      this.ps.push({
        x: Math.random() * w, y: h + 10, vx: (Math.random() - 0.5) * 0.4, vy: -(0.4 + Math.random() * 1.1) * (petal ? 0.6 : 1),
        r: petal ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.8, life: 1, decay: 0.002 + Math.random() * 0.004,
        c: this.colors[(Math.random() * this.colors.length) | 0], ph: Math.random() * 6.28, petal, rot: Math.random() * 6.28,
      });
    }
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    this.ps = this.ps.filter((p) => {
      p.ph += 0.03;
      p.x += p.vx + Math.sin(p.ph) * 0.35;
      p.y += p.vy;
      p.rot += 0.02;
      p.life -= p.decay;
      if (p.life <= 0 || p.y < -20) return false;
      const a = Math.min(1, p.life * 1.5) * (0.6 + 0.4 * Math.sin(p.ph * 3));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      if (p.petal) {
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.45, p.rot, 0, Math.PI * 2);
      } else {
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      return true;
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
