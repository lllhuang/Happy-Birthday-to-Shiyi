// 加载页的进度条：一笔毛笔字的横。按进度条的实际大小现画，宽屏上也不会被拉变形。
// 墨迹是一根根笔毛叠出来的：起笔斜着按下去，上面的毛先着纸；笔身平直，带细细的丝纹；
// 墨从左往右慢慢变淡，外侧的笔毛先没墨，越到后面飞白越多。随机数固定，每次画出来都一样。

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 一维平滑噪声：n 个控制点之间余弦插值
function noise1(rand, n) {
  const p = Array.from({ length: n + 1 }, () => rand() * 2 - 1);
  return (u) => {
    const f = Math.min(Math.max(u, 0), 1) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const k = (1 - Math.cos((f - i) * Math.PI)) / 2;
    return p[i] * (1 - k) + p[i + 1] * k;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// 返回每个像素的墨量（0 到 1），宽 W、高 H 都是设备像素
function inkMap(W, H, seed = 27) {
  const rand = rng(seed);
  const T = H * 0.6; // 笔身粗细
  const yc = H / 2;
  const head = T * 1.1; // 起笔那一段的长度
  // 边缘的毛糙按像素算频率，宽屏窄屏看起来一样碎
  const nEdge = Math.max(24, Math.round(W / (H * 0.3)));
  const eT1 = noise1(rand, nEdge), eB1 = noise1(rand, nEdge), eT2 = noise1(rand, nEdge * 3), eB2 = noise1(rand, nEdge * 3);
  const body = noise1(rand, 6);
  // 笔毛：在笔宽里排开。每根毛的墨从起笔开始慢慢用掉，外侧的先用完，到后面就成了飞白
  const N = 52;
  const nStreak = Math.max(18, Math.round(W / (H * 0.9)));
  const hairs = [];
  for (let i = 0; i < N; i++) {
    const o = -1 + (2 * (i + 0.5)) / N + (rand() - 0.5) * (1.2 / N);
    const outer = Math.abs(o);
    hairs.push({
      o,
      // 墨能撑到全长的哪里：中间的毛撑到头，外侧的在 60% 到 90% 之间断掉
      end: Math.min(1.12, 1.06 - outer * outer * 0.42 + (rand() - 0.5) * 0.22),
      // 起笔斜着落下：上面的毛先着纸，下面的晚一点
      start: head * (0.05 + 0.62 * ((o + 1) / 2) ** 1.3) + rand() * head * 0.08,
      load: 0.8 + rand() * 0.45,
      streak: noise1(rand, nStreak + ((rand() * nStreak) | 0)),
      w: 0.8 + rand() * 0.9,
    });
  }
  const a = new Float32Array(W * H);
  const left = new Float32Array(N);
  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);
    // 粗细：起笔按下去略粗，笔身轻微起伏，收笔只略细一点，靠飞白收尾
    const press = 1 - smooth(T * 0.6, T * 3.2, x); // 起笔顿一下，按得重
    const half = (T / 2) * (1 + 0.24 * press + 0.04 * body(u) - 0.12 * smooth(0.75, 1, u));
    const top = yc - half * (1 + 0.06 * eT1(u) + 0.03 * eT2(u)) - half * 0.2 * press;
    const bot = yc + half * (1 + 0.06 * eB1(u) + 0.03 * eB2(u));
    for (let i = 0; i < N; i++) {
      const h = hairs[i];
      const on = smooth(h.start - T * 0.18, h.start + T * 0.12, x); // 落笔
      const run = smooth(h.end, h.end - 0.16, u); // 墨用完前先变淡、断续
      const dry = 1 - smooth(0.25, 0.85, u + 0.25 * h.streak(u) - (1 - run) * 0.6) * 0.75;
      const tex = 0.72 + 0.28 * (0.5 + 0.5 * h.streak(u * 0.97 + 0.013)); // 笔身也有细细的丝纹
      left[i] = on * run * Math.max(0, Math.min(1, dry)) * tex * h.load * (1 - 0.22 * u); // 越往后墨越淡
    }
    for (let y = Math.max(0, Math.floor(top - 1)); y <= Math.min(H - 1, Math.ceil(bot + 1)); y++) {
      const v = y + 0.5 < yc ? (y + 0.5 - yc) / (yc - top) : (y + 0.5 - yc) / (bot - yc);
      if (Math.abs(v) > 1.08) continue;
      let d = 0;
      for (let i = 0; i < N; i++) {
        const h = hairs[i];
        const dist = (Math.abs(v - h.o) * N * 0.5) / h.w;
        if (dist < 1.8) d += left[i] * Math.exp(-dist * dist * 1.1);
      }
      // 墨在边上积得略浓；边缘柔一点；纸面有细颗粒
      const rim = 1 + 0.3 * smooth(0.6, 0.92, Math.abs(v));
      const edge = smooth(1.08, 0.88, Math.abs(v));
      const grain = 0.82 + 0.18 * rand();
      a[y * W + x] = (1 - Math.exp(-1.5 * d * rim)) * edge * grain;
    }
  }
  return a;
}

// 把墨迹画进两张画布：ink 是朱砂红的墨，track 是很淡的底，预先看得出这一笔的位置
export function paintBrush(ink, track) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = ink.clientWidth, h = ink.clientHeight;
  if (!w || !h) return;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  const a = inkMap(W, H);
  for (const [c, paint] of [
    [ink, (d) => [150 + 75 * (1 - d), 14 + 46 * (1 - d), 30 + 30 * (1 - d), 255 * Math.min(1, d * 1.2)]],
    [track, (d) => [245, 239, 230, 255 * d * 0.13]],
  ]) {
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < a.length; i++) {
      if (!a[i]) continue;
      const [r, g, b, al] = paint(a[i]);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = al;
    }
    ctx.putImageData(img, 0, 0);
  }
}
