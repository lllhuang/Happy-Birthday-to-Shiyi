// 所有声音都在这里现场合成（Web Audio），只有录音（《特别的人》《这条小鱼在乎》）用外部 mp3。

// 录音的音量倍数：拨弦的峰值高、平均音量低，先压峰值再放大，吉他才听得清
const SONG_BOOST = 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class Engine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.songEl = null;
    this.songOk = null; // null = 未检查
  }

  // 必须在用户手势里调用
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.comp = comp;

      this.dry = ctx.createGain();
      this.dry.connect(this.master);
      this.verb = ctx.createConvolver();
      this.verb.buffer = this._impulse(2.6, 2.4);
      this.verbSend = ctx.createGain();
      this.verbSend.gain.value = 0.35;
      this.verbSend.connect(this.verb).connect(this.master);

      // 烟花总线：关窗时闷一些
      this.fwFilter = ctx.createBiquadFilter();
      this.fwFilter.type = 'lowpass';
      this.fwFilter.frequency.value = 500;
      this.fwGain = ctx.createGain();
      this.fwGain.gain.value = 0.35;
      this.fwFilter.connect(this.fwGain).connect(this.dry);
      this.fwGain.connect(this.verbSend);

      // 录音单独走一路，不经过压缩器，否则音量调小了也听不太出来
      this.songBus = ctx.createGain();
      this.songBus.gain.value = this.muted ? 0 : SONG_BOOST;
      // 提高音量后用限幅器兜底，峰值不破音
      this.songLimit = ctx.createDynamicsCompressor();
      this.songLimit.threshold.value = -2;
      this.songLimit.knee.value = 0;
      this.songLimit.ratio.value = 20;
      this.songLimit.attack.value = 0.002;
      this.songLimit.release.value = 0.12;
      this.songBus.connect(this.songLimit).connect(ctx.destination);

      this.noise = this._noiseBuffer(2);
      this._bakeFireworks();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.now, 0.05);
    if (this.songBus) this.songBus.gain.setTargetAtTime(m ? 0 : SONG_BOOST, this.now, 0.05);
    if (this.songEl) this.songEl.muted = m;
    if (this.endingEl) this.endingEl.muted = m;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _out(node, wet = 0.35) {
    node.connect(this.dry);
    if (wet > 0) {
      const s = this.ctx.createGain();
      s.gain.value = wet;
      node.connect(s).connect(this.verbSend);
    }
  }

  // 清亮的小铃铛（云、星星、音乐盒）
  bell(midi, { t = 0, vol = 0.18, dur = 1.6, wet = 0.6 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now + t;
    const f = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    [
      [1, 1],
      [2.76, 0.28],
      [5.4, 0.08],
    ].forEach(([r, a]) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * r;
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    });
    this._out(g, wet);
  }

  sparkle() {
    const scale = [72, 74, 76, 79, 81, 84, 86, 88];
    this.bell(scale[(Math.random() * scale.length) | 0], { vol: 0.12 });
  }

  // 钢琴：带一点非谐波的加法合成
  piano(midi, vel = 0.8) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now;
    const f = mtof(midi);
    const B = 0.00035;
    const lowness = Math.max(0, (72 - midi) / 24);
    const out = ctx.createGain();
    out.gain.value = 0.22 * vel;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200 + vel * 2500, t0);
    lp.frequency.exponentialRampToValueAtTime(1400, t0 + 1.2);
    lp.connect(out);
    for (let n = 1; n <= 8; n++) {
      const fn = f * n * Math.sqrt(1 + B * n * n);
      if (fn > 12000) break;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fn;
      const g = ctx.createGain();
      const amp = (1 / Math.pow(n, 1.25)) * (n === 1 ? 1 : 0.7);
      const decay = (3.2 + lowness * 2) / (1 + 0.5 * (n - 1));
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(amp * 0.35, t0 + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      o.connect(g).connect(lp);
      o.start(t0);
      o.stop(t0 + decay + 0.05);
    }
    // 琴槌
    const nz = ctx.createBufferSource();
    nz.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * vel, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    nz.connect(bp).connect(ng).connect(out);
    nz.start(t0);
    nz.stop(t0 + 0.06);
    this._out(out, 0.3);
    return out;
  }

  // 《特别的人》：依次检查几个文件名，找到第一个存在的
  async findSong(urls) {
    if (this.songUrl !== undefined) return this.songUrl;
    this.songUrl = null;
    for (const u of urls) {
      try {
        const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
        if (r.ok) { this.songUrl = u; break; }
      } catch (e) {}
    }
    return this.songUrl;
  }

  songElement(url) {
    if (!this.songEl) {
      const a = new Audio();
      a.src = url;
      a.loop = true;
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      a.muted = this.muted;
      // 经过 Web Audio 的增益节点调音量（iOS 不允许直接改 audio.volume）
      if (this.ctx) {
        try {
          // 压缩放在音量节点前面，滑走时的渐弱不会被压缩抵消
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.value = -28;
          comp.knee.value = 12;
          comp.ratio.value = 4;
          comp.attack.value = 0.005;
          comp.release.value = 0.2;
          this.songGain = this.ctx.createGain();
          this.ctx.createMediaElementSource(a).connect(comp).connect(this.songGain).connect(this.songBus);
        } catch (e) { this.songGain = null; }
      }
      this.songEl = a;
    }
    return this.songEl;
  }

  setSongLevel(v) {
    if (this.songGain) this.songGain.gain.setTargetAtTime(v, this.now, 0.08);
    else if (this.songEl) try { this.songEl.volume = v; } catch (e) {}
  }

  // 结尾的歌：点横幅时开始放，放完就停
  playEnding(url) {
    if (!this.endingEl) {
      const a = new Audio(url);
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      a.muted = this.muted;
      this.endingEl = a;
    }
    return this.endingEl.play();
  }

  // ---------- 真钢琴采样（Salamander Grand Piano, CC-BY 3.0） ----------
  loadPiano() {
    if (this._pianoLoading) return this._pianoLoading;
    if (!this.ctx) return Promise.resolve(false);
    const names = { C: 0, Ds: 3, Fs: 6, A: 9 };
    const list = [];
    for (let o = 2; o <= 6; o++) for (const n in names) list.push([n + o, (o + 1) * 12 + names[n]]);
    list.push(['C7', 96]);
    this.samples = new Map();
    const decode = (buf) => new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(buf, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    this._pianoLoading = Promise.all(
      list.map(([name, midi]) =>
        fetch(`assets/piano/${name}.mp3`)
          .then((r) => r.arrayBuffer())
          .then(decode)
          .then((b) => this.samples.set(midi, b))
          .catch(() => {})
      )
    ).then(() => (this.pianoReady = this.samples.size > 10));
    return this._pianoLoading;
  }

  // 弹一个音，返回可以松开的句柄
  key(midi, { vel = 0.8, t = 0, dur = 0, wet = 0.22 } = {}) {
    if (!this.ctx) return null;
    if (!this.pianoReady) {
      this.piano(midi, vel);
      return null;
    }
    const ctx = this.ctx;
    const t0 = this.now + Math.max(0, t);
    let best = null, bd = 99;
    for (const m of this.samples.keys()) {
      const d = Math.abs(m - midi);
      if (d < bd || (d === bd && m > best)) { bd = d; best = m; }
    }
    const src = ctx.createBufferSource();
    src.buffer = this.samples.get(best);
    src.playbackRate.value = Math.pow(2, (midi - best) / 12);
    const g = ctx.createGain();
    const v = Math.pow(vel, 1.4) * 0.95;
    g.gain.setValueAtTime(v, t0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200 + vel * 9000;
    src.connect(lp).connect(g);
    this._out(g, wet);
    src.start(t0);
    const h = {
      release: (after = 0, tau = 0.32) => {
        const tr = Math.max(this.now, t0) + after;
        g.gain.cancelScheduledValues(tr);
        g.gain.setValueAtTime(g.gain.value || v, tr);
        g.gain.setTargetAtTime(0, tr, tau);
        try { src.stop(tr + tau * 8); } catch (e) {}
      },
      gain: g,
    };
    if (dur) h.release(dur, 0.5);
    else src.stop(t0 + 12);
    return h;
  }

  // 生日歌（旋律属于公有领域）：干净的钢琴版，右手旋律、左手分解和弦
  happyBirthday({ loop = false, onEnd } = {}) {
    if (!this.ctx) return;
    this.stopHappyBirthday();
    const G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;
    // [音高, 起始拍, 时值]（3/4 拍，第 0 拍是弱起）
    const mel = [
      [G4, 0, 0.75], [G4, 0.75, 0.25], [A4, 1, 1], [G4, 2, 1], [C5, 3, 1], [B4, 4, 2],
      [G4, 6, 0.75], [G4, 6.75, 0.25], [A4, 7, 1], [G4, 8, 1], [D5, 9, 1], [C5, 10, 2],
      [G4, 12, 0.75], [G4, 12.75, 0.25], [G5, 13, 1], [E5, 14, 1], [C5, 15, 1], [B4, 16, 1], [A4, 17, 1],
      [F5, 18, 0.75], [F5, 18.75, 0.25], [E5, 19, 1], [C5, 20, 1], [D5, 21, 1], [C5, 22, 3],
    ];
    const C = [36, 43, 52], G7 = [31, 41, 47], F = [29, 41, 45], C7 = [36, 43, 46];
    const bars = [[1, C], [4, G7], [7, G7], [10, C], [13, C7], [16, F], [19, C], [21, G7], [22, C]];
    const beat = 0.66;
    const T = (b) => 0.15 + b * beat + (b > 19 ? (b - 19) * (b - 19) * 0.03 : 0); // 结尾慢一点
    const hs = (this._hbHandles = []);
    const play = (m, b, d, vel, wet = 0.3) => {
      const h = this.key(m, { vel, t: T(b), dur: Math.max(0.3, T(b + d) - T(b)) + 0.25, wet });
      if (h) hs.push(h);
    };
    mel.forEach(([m, b, d], i) => play(m + 12, b, d, i % 3 === 1 ? 0.5 : 0.58));
    bars.forEach(([b, ch], i) => {
      const len = i === bars.length - 1 ? 3 : bars[i + 1][0] - b;
      play(ch[0] + 12, b, len, 0.4);
      if (len >= 2) play(ch[1] + 12, b + 1, len - 1, 0.28);
      if (len >= 3) play(ch[2] + 12, b + 2, 1.2, 0.26);
    });
    // 结尾和弦 + 高音点缀
    [48, 55, 64, 72].forEach((m, k) => play(m, 22 + k * 0.08, 3, 0.36));
    play(96, 23.2, 2, 0.2, 0.6);
    const total = T(25) + 1.5;
    this._hbTimer = setTimeout(() => {
      if (loop) this._hbTimer = setTimeout(() => this.happyBirthday({ loop, onEnd }), 2500);
      onEnd && onEnd();
    }, total * 1000);
  }

  stopHappyBirthday() {
    clearTimeout(this._hbTimer);
    (this._hbHandles || []).forEach((h) => { try { h.release(0, 0.4); } catch (e) {} });
    this._hbHandles = [];
  }
  // 烟花
  setWindowOpen(open) {
    if (!this.ctx) return;
    this.fwFilter.frequency.setTargetAtTime(open ? 16000 : 500, this.now, 0.08);
    this.fwGain.gain.setTargetAtTime(open ? 0.9 : 0.35, this.now, 0.08);
  }

  _pan(v) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = v || 0;
      p.connect(this.fwFilter);
      return p;
    }
    return this.fwFilter;
  }

  // 烟花的每一部分都是滤波后的噪声，不用振荡器，免得听起来像电子音
  _noiseHit(out, { t, type, freq, to, q = 0.7, peak, attack = 0.002, decay }) {
    const ctx = out.context;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    n.connect(f).connect(g).connect(out);
    n.start(t, Math.random() * 1.9);
    n.stop(t + attack + decay + 0.05);
  }

  // 升空：“biu——”，音量越来越小，长度正好等于火箭飞上去的时间。主体是气流声，哨音只垫在里面
  whistle(T, { pan = 0, special = false } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now;
    const out = this._pan(pan);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = special ? 9 : 6;
    const f0 = (special ? 1500 : 1100) + Math.random() * 300;
    // 升空时音调由高往低（原来是由低往高：f0 → f0 * 2.2，振荡器 f0 * 1.4 → f0 * 2.5，回退就把两组起止对调回去）
    bp.frequency.setValueAtTime(f0 * 2.2, t0);
    bp.frequency.exponentialRampToValueAtTime(f0, t0 + T);
    // 火药喷气不稳定，频率一直在抖
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9 + Math.random() * 8;
    const lg = ctx.createGain();
    lg.gain.value = 90;
    lfo.connect(lg).connect(bp.frequency);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.linearRampToValueAtTime(special ? 0.9 : 0.7, t0 + 0.06);
    ng.gain.exponentialRampToValueAtTime(0.003, t0 + T);
    n.connect(bp).connect(ng).connect(out);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0 * 2.5, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t0 + T);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.linearRampToValueAtTime(special ? 0.04 : 0.024, t0 + 0.08);
    og.gain.exponentialRampToValueAtTime(0.0005, t0 + T);
    o.connect(og).connect(out);
    n.start(t0, Math.random() * 1.9);
    o.start(t0);
    lfo.start(t0);
    [n, o, lfo].forEach((x) => x.stop(t0 + T + 0.05));
  }

  // 每一声爆炸和噼啪要几十个音频节点，现场拼的话，烟花一多手机就卡。
  // 所以进页面时在后台合成好几段，放的时候只是播一段现成的声音
  async _bakeFireworks() {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) return;
    const bake = async (seconds, draw) => {
      const oc = new OC(2, Math.round(seconds * this.ctx.sampleRate), this.ctx.sampleRate);
      draw(oc.destination);
      return oc.startRendering();
    };
    try {
      this.fwBooms = [];
      this.fwBigBooms = [];
      this.fwCrackles = [];
      for (let i = 0; i < 3; i++) this.fwBooms.push(await bake(2.2, (o) => this._drawBoom(o, false)));
      for (let i = 0; i < 2; i++) this.fwBigBooms.push(await bake(3, (o) => this._drawBoom(o, true)));
      for (let i = 0; i < 3; i++) this.fwCrackles.push(await bake(2.4, (o) => this._drawCrackle(o, 30, 1.2)));
    } catch (e) {}
  }

  _playBaked(list, pan, rate = 1) {
    const buf = list && list[(Math.random() * list.length) | 0];
    if (!buf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const out = this._pan(pan);
    s.connect(out);
    s.onended = () => {
      s.disconnect();
      if (out !== this.fwFilter) out.disconnect();
    };
    s.start();
  }

  // 炸开：“嘭”，在炸开那一帧调用
  boom({ pan = 0, big = false } = {}) {
    if (!this.ctx) return;
    this._playBaked(big ? this.fwBigBooms : this.fwBooms, pan, 0.92 + Math.random() * 0.16);
  }

  // 一下很短的闷响，一记脆响，然后是楼群的回声和滚走的余音
  _drawBoom(out, big) {
    const t0 = 0.002;
    const v = big ? 1 : 0.75;
    const hit = (o) => this._noiseHit(out, { t: t0, ...o });
    hit({ type: 'lowpass', freq: 130, q: 1.2, peak: 9 * v, attack: 0.004, decay: big ? 0.34 : 0.24 });
    hit({ type: 'lowpass', freq: 1500, to: 220, peak: 1.5 * v, attack: 0.003, decay: big ? 0.8 : 0.55 });
    hit({ type: 'bandpass', freq: 2400, q: 0.6, peak: 1.6 * v, attack: 0.001, decay: 0.035 });
    const echoes = big ? 4 : 3;
    let d = 0.14 + Math.random() * 0.08;
    for (let i = 1; i <= echoes; i++) {
      this._noiseHit(out, { t: t0 + d, type: 'lowpass', freq: 680 - i * 90, peak: (1.1 * v) / i, attack: 0.012, decay: 0.2 + i * 0.09 });
      d += 0.16 + Math.random() * 0.17;
    }
    this._noiseHit(out, { t: t0 + 0.08, type: 'lowpass', freq: 190, peak: 1.5 * v, attack: 0.1, decay: big ? 2.3 : 1.6 });
  }

  // 碎金的噼里啪啦
  crackle({ pan = 0, spread = 1 } = {}) {
    if (!this.ctx) return;
    this._playBaked(this.fwCrackles, pan, spread > 1 ? 0.9 : 1.1);
  }

  // 一簇一簇地响，底下垫一层沙沙声
  _drawCrackle(out, n, spread) {
    const t0 = 0.002;
    this._noiseHit(out, { t: t0, type: 'highpass', freq: 5200, peak: 0.05, attack: 0.15, decay: spread * 1.3 });
    let ct = t0, left = 0;
    for (let i = 0; i < n; i++) {
      if (left-- <= 0) {
        left = 2 + ((Math.random() * 5) | 0);
        ct = t0 + Math.pow(Math.random(), 1.5) * spread;
      }
      ct += Math.random() * 0.022;
      this._noiseHit(out, {
        t: ct, type: 'bandpass', freq: 2600 + Math.random() * 5400, q: 1.4,
        peak: 0.25 + Math.pow(Math.random(), 2) * 1.1, attack: 0.0008, decay: 0.006 + Math.random() * 0.02,
      });
    }
  }

  // 远处的烟花（蛋糕那一幕，听得到看不到）
  firework() {
    this.boom({ pan: Math.random() - 0.5 });
  }

  tick(high = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = high ? 2400 : 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.04, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    o.connect(hp).connect(g);
    this._out(g, 0.1);
    o.start(t0);
    o.stop(t0 + 0.03);
  }

  chirp(t = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now + t;
    const base = 2600 + Math.random() * 1400;
    for (let k = 0; k < 2 + ((Math.random() * 2) | 0); k++) {
      const s = t0 + k * 0.11;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * 1.45, s + 0.04);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.05, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      o.connect(g);
      this._out(g, 0.4);
      o.start(s);
      o.stop(s + 0.1);
    }
  }

  whoosh(dur = 1.2, up = true) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(up ? 300 : 2500, t0);
    bp.frequency.exponentialRampToValueAtTime(up ? 2500 : 300, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.12, t0 + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(bp).connect(g);
    this._out(g, 0.5);
    n.start(t0, Math.random());
    n.stop(t0 + dur + 0.05);
  }

  // 低沉的鼓/墨点
  thud(vol = 0.4) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = this.now;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(36, t0 + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    o.connect(g);
    this._out(g, 0.5);
    o.start(t0);
    o.stop(t0 + 0.85);
  }
}

export const audio = new Engine();
