// 加载页的进度条：一笔毛笔字的横。按进度条的实际大小现画，宽屏上也不会被拉变形。
// 墨迹是一根根笔毛叠出来的：起笔斜着落下，一笔里粗、细、粗、细地起伏，上下两条边各自起伏；
// 墨从左往右慢慢变少，笔毛一簇一簇分开、被纸纹截断，越到后面飞白越多。随机数固定，每次画出来都一样。

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

// 二维值噪声：纸面的纹理。横向拉长，像顺着运笔方向被带出来的纸纹
function grain2(rand, cw, ch) {
  const GX = 256, GY = 64;
  const g = Float32Array.from({ length: GX * GY }, () => rand());
  const at = (i, j) => g[(((j % GY) + GY) % GY) * GX + (((i % GX) + GX) % GX)];
  return (x, y) => {
    const fx = x / cw, fy = y / ch;
    const i = Math.floor(fx), j = Math.floor(fy);
    const kx = fx - i, ky = fy - j;
    const sx = kx * kx * (3 - 2 * kx), sy = ky * ky * (3 - 2 * ky);
    const top = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
    const bot = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
    return top * (1 - sy) + bot * sy;
  };
}

// 返回每个像素的墨量（0 到 1），宽 W、高 H 都是设备像素。
// 做法参考毛刷模型（Strassmann 1986 “Hairy Brushes”，Krita 的毛刷笔刷也是这个思路）：
// 笔锋是一排笔毛，每根带着自己的墨，沿着笔画走，压力决定笔画宽窄，墨少的地方被纸纹截断成飞白。
// 是个生成器：每算完一列就停一下，由调用的人决定一帧算多少，免得手机上一下子卡住
function* inkMap(W, H, seed = 27) {
  const rand = rng(seed);
  const T = H * 0.44; // 正常压力下的笔画粗细
  const yc = H * 0.5;
  // 压力：一笔里按下、提起、再按下、再提起，粗细粗细地走；最后提笔出飞白。
  // 几个转折点的位置和轻重各带一点随机，不会像尺子量出来的那么整齐
  const knots = [[0, 1.02], [0.17, 1.3], [0.39, 0.78], [0.61, 1.24], [0.81, 0.8], [0.92, 0.88], [1, 0.64]].map(([k, v], i, all) =>
    [i && i < all.length - 1 ? k + (rand() - 0.5) * 0.04 : k, v + (rand() - 0.5) * 0.06]);
  const wobble2 = noise1(rand, 9);
  const pressure = (x, u) => {
    let i = 1;
    while (i < knots.length - 1 && knots[i][0] < u) i++;
    const [k0, v0] = knots[i - 1], [k1, v1] = knots[i];
    const t = Math.min(1, Math.max(0, (u - k0) / (k1 - k0)));
    return v0 + (v1 - v0) * (1 - Math.cos(t * Math.PI)) / 2 + 0.05 * wobble2(u);
  };
  // 上下两条边各自起伏：低频的轻重加高频的毛糙，毛糙的频率按像素算，宽窄屏一样碎
  const nE = Math.max(30, Math.round(W / (H * 0.18)));
  const eT = [noise1(rand, 4), noise1(rand, nE), noise1(rand, nE * 3)];
  const eB = [noise1(rand, 4), noise1(rand, nE), noise1(rand, nE * 3)];
  const edge = (e, u) => 0.13 * e[0](u) + 0.045 * e[1](u) + 0.025 * e[2](u);
  // 笔毛成簇：几根毛粘在一起走，飞白时是一簇一簇分开的
  const N = 64;
  const hairs = [];
  const nGap = Math.max(16, Math.round(W / (H * 0.7)));
  let clump = null, left = 0;
  for (let i = 0; i < N; i++) {
    if (left-- <= 0) {
      left = 2 + ((rand() * 5) | 0);
      clump = { gap: noise1(rand, nGap + ((rand() * nGap) | 0)), wet: 0.75 + rand() * 0.5 };
    }
    const o = -1 + (2 * (i + 0.5)) / N + (rand() - 0.5) * (1.1 / N);
    hairs.push({
      o,
      clump,
      // 墨能撑到哪里：中间的毛撑到头，越往外越早断
      end: Math.min(1.12, 1.08 - o * o * 0.3 + (rand() - 0.5) * 0.14),
      // 起笔斜着落下：上面的毛先着纸
      start: T * (0.05 + 0.7 * ((o + 1) / 2) ** 1.3) + rand() * T * 0.1,
      load: (0.85 + rand() * 0.3) * clump.wet,
      w: 0.8 + rand() * 0.8,
    });
  }
  const paper = grain2(rand, Math.max(6, H * 0.9), Math.max(1, H * 0.022));
  const paper2 = grain2(rand, Math.max(2, H * 0.16), Math.max(1, H * 0.045));
  const a = new Float32Array(W * H);
  const wet = new Float32Array(N);
  for (let x = 0; x < W; x++) {
    yield;
    const u = x / (W - 1);
    const half = (T / 2) * pressure(x, u);
    const top = yc - half * (1 + edge(eT, u)) - half * 0.1 * (1 - smooth(T * 0.5, T * 3, x));
    const bot = yc + half * (1 + edge(eB, u));
    // 笔上的墨：越写越少；到后段，毛和毛之间开始出现飞白
    const ink = 1 - 0.38 * Math.pow(u, 1.6);
    const dryness = Math.pow(smooth(0.22, 1, u), 1.2);
    for (let i = 0; i < N; i++) {
      const h = hairs[i];
      const on = smooth(h.start - T * 0.15, h.start + T * 0.15, x); // 落笔
      const run = smooth(h.end, h.end - 0.14, u); // 墨用完前先变淡
      // 这一簇此刻有没有离开纸面：越干越容易断，断开的长短随机
      const g = h.clump.gap(u);
      const lift = smooth(0.6 - dryness * 0.75, 0.78 - dryness * 0.75, g) * dryness * 0.85;
      wet[i] = on * run * (1 - lift) * h.load;
    }
    for (let y = Math.max(0, Math.floor(top - 1)); y <= Math.min(H - 1, Math.ceil(bot + 1)); y++) {
      const v = y + 0.5 < yc ? (y + 0.5 - yc) / (yc - top) : (y + 0.5 - yc) / (bot - yc);
      if (Math.abs(v) > 1.1) continue;
      let d = 0;
      for (let i = 0; i < N; i++) {
        const h = hairs[i];
        const dist = (Math.abs(v - h.o) * N * 0.5) / h.w;
        if (dist < 1.8) d += wet[i] * Math.exp(-dist * dist * 1.1);
      }
      // 墨量和纸纹比：墨足的地方整片吃进纸里，墨少的地方只染到纸纹凸起的那些点
      const rim = 1 + 0.25 * smooth(0.6, 0.95, Math.abs(v)); // 墨在边上积得略浓
      const amount = (1 - Math.exp(-1.4 * d * rim)) * ink;
      const tooth = paper(x, y) * 0.7 + paper2(x, y) * 0.3;
      const need = 0.06 + dryness * 0.38 + (1 - ink) * 0.15;
      const take = smooth(need - 0.16, need + 0.06, amount + (tooth - 0.5) * (0.25 + dryness * 0.5));
      const soft = smooth(1.1, 0.9, Math.abs(v));
      a[y * W + x] = Math.min(1, amount * 1.15) * take * soft;
    }
  }
  return a;
}

// 把墨迹画进两张画布：ink 是朱砂红的墨，track 是很淡的底，预先看得出这一笔的位置。
// 分几帧算完（每帧最多 6 毫秒），转场动画不会因此顿一下；再调用一次会作废上一次没画完的
let job = 0;
export async function paintBrush(ink, track) {
  const me = ++job;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = ink.clientWidth, h = ink.clientHeight;
  if (!w || !h) return;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  const it = inkMap(W, H);
  let r;
  for (;;) {
    const t = performance.now();
    while (!(r = it.next()).done && performance.now() - t < 6);
    if (r.done) break;
    await new Promise(requestAnimationFrame);
    if (me !== job) return;
  }
  const a = r.value;
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
