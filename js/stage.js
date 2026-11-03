import { CONTENT } from './content.js?v=202611030439';
import { audio } from './audio.js?v=202611030439';
import { sparkle, confetti, Fireworks } from './fx.js?v=202611030439';
import { listenForBlow } from './blow.js?v=202611030439';

const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const C = CONTENT;
const HEART = ['#F2A7B8', '#FFE3EA'];
// 最后一波里依次拼出的字和颜色，每组之间隔几秒
const WORDS = [['冯诗意', ['#FFD58A', '#FFF4D6']], ['生日快乐！', ['#8FD3FF', '#F2F8FF']]];
const WORD_GAP = 3.4;
const ZOOM_OUT = 4200; // 镜头拉远用多久（毫秒）
const CURTAIN_LEAD = 2200; // 拉远进行到这时开始关窗拉窗帘，两者重叠

export class Stage {
  constructor({ toast, onChapter }) {
    this.toast = toast;
    this.onChapter = onChapter;
    this.el = $('#stage');
    this.room = $('#st-room');
    this.win = $('#window');
    this.wrap = $('.window-wrap');
    addEventListener('resize', () => this._z > 1 && this._zoom(true)); // 转屏后重新推近
    this.hint = $('#room-hint');
    this.top = $('#room-top');
    this.state = '';
    this.fw = new Fireworks($('#fw'), {
      onLaunch: (r) => audio.whistle(r.T, { pan: r.pan, special: r.special }),
      onBurst: (r) => this._burst(r),
      onCrackle: (r, big) => audio.crackle({ pan: r.pan, n: big ? 40 : 22, spread: big ? 1.4 : 0.9 }),
    });
    this._bindCake();
    this._bindRoom();
    this._buildTicks();
    this._buildFlowers();
    this._buildMeadow();
  }

  show(id) {
    this.el.hidden = false;
    ['#st-cake', '#st-room'].forEach((s) => $(s).classList.toggle('on', s === id));
    this._lightButtons(this.room.classList.contains('morning') && id === '#st-room');
  }

  _lightButtons(on) {
    ['#sound', '#chapters-btn'].forEach((s) => $(s).classList.toggle('light', on));
  }

  begin(where) {
    const map = {
      cake: () => this.cake(),
      room: () => this.night(),
      window: () => this.night(),
      clock: () => this.clock(),
      morning: () => this.morning(),
      letter: () => this.morning(true),
    };
    (map[where] || map.cake)();
  }

  // ================= 蛋糕 =================
  _bindCake() {
    const wish = $('#wish-btn');
    let raf, t0;
    const DUR = 2400;
    const tick = (t) => {
      const k = clamp((t - t0) / DUR);
      wish.style.setProperty('--p', k);
      $('#st-cake').style.setProperty('--wp', k.toFixed(3));
      if (k >= 1) return this._wished();
      raf = requestAnimationFrame(tick);
    };
    wish.addEventListener('pointerdown', (e) => {
      if (this.state !== 'wish') return;
      e.preventDefault();
      audio.unlock();
      t0 = performance.now();
      // 暗场和光都以蜡烛为中心
      const a = $('#candle-0 .flame-g').getBoundingClientRect(), b = $('#candle-1 .flame-g').getBoundingClientRect();
      const stage = $('#st-cake');
      stage.style.setProperty('--cx', (a.left + b.right) / 2 + 'px');
      stage.style.setProperty('--cy', (a.top + a.bottom) / 2 + 'px');
      raf = requestAnimationFrame(tick);
    });
    const cancel = () => {
      if (this.state !== 'wish') return;
      cancelAnimationFrame(raf);
      wish.style.setProperty('--p', 0);
      $('#st-cake').style.setProperty('--wp', 0);
    };
    wish.addEventListener('pointerup', cancel);
    wish.addEventListener('pointerleave', cancel);
    wish.addEventListener('pointercancel', cancel);
    wish.addEventListener('contextmenu', (e) => e.preventDefault());

    $('#mic-btn').addEventListener('click', () => this._mic());
    [0, 1].forEach((i) => {
      $('#candle-' + i).addEventListener('click', () => {
        if (this.state !== 'blow' && this.state !== 'wish') return;
        if (this.state === 'wish') return this._msg(C.cake.wish + '，再吹哦');
        this._out(i);
      });
    });
  }

  _msg(t) {
    $('#cake-msg').textContent = t;
  }

  cake() {
    this.onChapter('cake');
    this.state = 'wish';
    this.show('#st-cake');
    this._msg(C.cake.wish);
    audio.loadPiano().then(() => {
      if (this.state === 'wish' || this.state === 'wished' || this.state === 'blow') audio.happyBirthday({ loop: true });
    });
  }

  async _wished() {
    this.state = 'wished';
    $('#wish-btn').hidden = true;
    this._msg('');
    [79, 84, 88, 91].forEach((m, i) => audio.bell(m, { t: i * 0.12, vol: 0.1, dur: 2.4 }));
    // 房间保持暗着，蜡烛亮着，等她吹灭
    await sleep(900);
    this.state = 'blow';
    this._msg(C.cake.blow);
    $('#blow-actions').hidden = false;
  }

  async _mic() {
    if (this.state !== 'blow') return;
    audio.unlock();
    audio.stopHappyBirthday();
    this._msg(C.cake.micListening);
    $('#mic-btn').disabled = true;
    const cake = $('#cake');
    const candles = [0, 1].map((i) => $('#candle-' + i));
    try {
      this._stopMic = await listenForBlow({
        onLevel: (l) => {
          cake.style.setProperty('--wind', l.toFixed(2));
          candles.forEach((c) => {
            c.classList.toggle('lean', l > 0.05);
            c.style.setProperty('--lean', l.toFixed(2));
          });
        },
        onBlow: () => {
          this._out(0);
          setTimeout(() => this._out(1), 180);
        },
      });
    } catch (e) {
      this._msg(C.cake.micDenied);
      $('#mic-btn').hidden = true;
    }
  }

  _out(i) {
    const c = $('#candle-' + i);
    if (c.classList.contains('out')) return;
    c.classList.remove('lean');
    c.classList.add('out');
    audio.whoosh(0.5, false);
    const r = c.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height * 0.15, { color: '#FFD58A', count: 6, spread: 40 });
    if ($('#candle-0').classList.contains('out') && $('#candle-1').classList.contains('out')) this._allOut();
  }

  async _allOut() {
    if (this.state === 'done') return;
    this.state = 'done';
    this._stopMic && this._stopMic();
    audio.stopHappyBirthday();
    $('#cake').style.setProperty('--wind', 0);
    $('#blow-actions').hidden = true;
    $('#st-cake').classList.add('out');
    $('#st-cake').style.setProperty('--wp', 0); // 吹灭了，房间亮回来
    this._msg('');
    await sleep(900);
    confetti($('#confetti'));
    [72, 76, 79, 84, 88, 91].forEach((m, i) => audio.bell(m, { t: i * 0.08, vol: 0.13, dur: 2 }));
    this._msg(C.cake.done);
    $('.cake-top').style.opacity = 0;
    await sleep(2600);
    this._msg(C.cake.outside);
    // 远处的烟花声
    this._distant = setInterval(() => audio.firework(), 1700);
    audio.firework();
    await sleep(2200);
    this._panToWindow();
  }

  // 镜头慢慢往上摇，从蛋糕摇到窗边
  async _panToWindow() {
    const cake = $('#st-cake');
    const room = this.room;
    this._prepNight();
    room.classList.add('panning', 'on');
    cake.classList.add('panning');
    const opts = { duration: 3400, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards' };
    audio.whoosh(3, true);
    cake.animate(
      [
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(30%) scale(1.08)', opacity: 0.85, offset: 0.45 },
        { transform: 'translateY(70%) scale(1.2)', opacity: 0 },
      ],
      opts
    );
    await room.animate(
      [
        { transform: 'translateY(-55%) scale(1.3)', opacity: 0 },
        { transform: 'translateY(-22%) scale(1.12)', opacity: 0.6, offset: 0.55 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      opts
    ).finished;
    cake.classList.remove('on', 'panning');
    room.classList.remove('panning');
    room.getAnimations().forEach((a) => a.cancel());
    this.show('#st-room');
    this._hint(C.night.open);
  }

  // ================= 夜晚的窗 =================
  _bindRoom() {
    this.win.addEventListener('click', (e) => this._windowTap(e));
    this.room.addEventListener('click', (e) => {
      if (e.target.closest('.window')) return;
      if (this.state === 'curtain') this._closeCurtains();
      if (this.state === 'sleep-ask') this._finaleThenSleep();
    });
    $('#dawn-btn').addEventListener('click', () => this.morning());
    $('#banner').addEventListener('click', () => this._letter());
    $('#letter').addEventListener('click', () => this._openEnvelope());
    $('#replay').addEventListener('click', () => {
      const q = new URLSearchParams(location.search);
      q.delete('jump');
      q.delete('from');
      location.href = location.pathname + (q.toString() ? '?' + q : '');
    });
  }

  _hint(t) {
    const h = this.hint;
    h.classList.remove('show');
    clearTimeout(this._hintT);
    if (!t) return;
    this._hintT = setTimeout(() => {
      h.textContent = t;
      h.classList.add('show');
    }, 250);
  }

  // 看烟花时镜头推近：窗户完整露出来、尽可能大。竖屏时窗宽占满屏幕宽，横屏时窗高占满屏幕高。
  // 用排版里的尺寸算，不受当前放大影响，转屏时可以直接重算
  _zoom(on) {
    const wrap = this.wrap, win = this.win;
    if (!on) {
      if (this._z === 1) return;
      // 拉远比推近更慢：烟花放完以后慢慢退回去
      this._z = 1;
      wrap.style.transition = `transform ${ZOOM_OUT}ms cubic-bezier(.37,0,.63,1)`;
      wrap.style.transform = '';
      setTimeout(() => this._z === 1 && this.fw.zoom(1), ZOOM_OUT + 100);
      return;
    }
    wrap.style.transition = '';
    const ox = win.offsetLeft + win.offsetWidth / 2, oy = win.offsetTop + win.offsetHeight / 2;
    const cx = wrap.offsetLeft - wrap.offsetWidth / 2 + ox, cy = wrap.offsetTop + oy;
    const z = Math.min(innerWidth / win.offsetWidth, innerHeight / win.offsetHeight);
    this._z = z;
    wrap.style.transformOrigin = `${ox}px ${oy}px`;
    wrap.style.transform = `translateX(-50%) translate(${innerWidth / 2 - cx}px, ${innerHeight / 2 - cy}px) scale(${z})`;
    this.fw.zoom(z);
  }

  _prepNight() {
    this.onChapter('room');
    this._zoom(false);
    clearInterval(this._distant);
    audio.stopHappyBirthday();
    this.room.classList.remove('morning', 'opened');
    this.win.classList.remove('open');
    this.wrap.classList.remove('curtains-closed');
    this.top.textContent = '';
    this.el.hidden = false;
    audio.setWindowOpen(false);
    this.fw.resize();
    this.fw.start();
    this.state = 'closed';
    clearInterval(this._auto);
    this._auto = setInterval(() => this._autoLaunch(), 1500);
    this._autoLaunch();
  }

  async night() {
    this._prepNight();
    this.show('#st-room');
    this._hint(C.night.open);
  }

  _autoLaunch() {
    const w = this.fw.w || 300;
    // 窗开着时，第 6、第 14 发换成爱心，混在普通烟花里
    if (this._hearts && this._hearts[0] === ++this._autoN) {
      this._hearts.shift();
      return this._heart();
    }
    this.fw.launch(w * (0.15 + Math.random() * 0.7));
  }

  // 随手放的爱心：位置不固定，但离窗边远一点，不被裁掉
  _heart(delay) {
    const w = this.fw.w, h = this.fw.h;
    this.fw.launch(w * (0.3 + Math.random() * 0.4), { type: 'heart', delay, y: h * (0.2 + Math.random() * 0.12), palette: HEART });
  }

  _burst(r) {
    audio.boom({ pan: r.pan, big: r.special });
    if (!this.win.classList.contains('open')) return;
    const f = $('#wall-flash');
    f.style.background = `radial-gradient(60% 50% at 50% 35%, ${r.pal[0]}, transparent)`;
    f.animate([{ opacity: r.special ? 0.45 : 0.28 }, { opacity: 0 }], { duration: r.special ? 1400 : 900, easing: 'ease-out' });
  }

  // 最后那一大波：先拼出她的名字、生日快乐！，每波随手配两到四朵陪衬；再百花齐放谢幕，正中间的爱心最后消散
  _finale() {
    const w = this.fw.w, h = this.fw.h;
    WORDS.forEach(([text, palette], i) => {
      const t0 = i * WORD_GAP;
      this.fw.launch(w * 0.5, { type: 'text', text, palette, delay: t0, y: h * 0.3, hold: 2.8 });
      // 陪衬放在两边，前后错开，不和字一起整齐地炸
      const n = 2 + Math.floor(Math.random() * 3);
      const left = Math.random() < 0.5;
      for (let k = 0; k < n; k++) {
        const x = (k % 2 === 0) === left ? 0.08 + Math.random() * 0.2 : 0.72 + Math.random() * 0.2;
        this.fw.launch(w * x, { delay: Math.max(0, t0 - 0.2 + Math.random() * 1.6), y: h * (0.14 + Math.random() * 0.36) });
      }
    });
    // 谢幕
    const t1 = WORDS.length * WORD_GAP;
    for (let i = 0; i < 12; i++) this.fw.launch(w * (0.1 + Math.random() * 0.8), { delay: t1 + i * 0.16 + Math.random() * 0.1, y: h * (0.14 + Math.random() * 0.3) });
    this.fw.launch(w * 0.3, { type: 'special', delay: t1 + 0.6, y: h * 0.28 });
    this.fw.launch(w * 0.7, { type: 'special', delay: t1 + 1.0, y: h * 0.24 });
    // 她提前放满 5 朵时，前面没轮到的爱心混进谢幕
    (this._hearts || []).forEach((_, i) => this._heart(t1 + 0.5 + i * 0.7));
    this._hearts = [];
    // 正中间这朵和最后几发一起放、一起消散，不单独亮出来，也不最后才散。
    // 爱心的火星停在原地、一直聚在一起，看着比散开的烟花亮得久，所以寿命和别的造型烟花一样短
    this.fw.launch(w * 0.5, { type: 'heart', delay: t1 + 1.6, y: h * 0.32, palette: HEART, hold: 1.8 });
  }

  async _windowTap(e) {
    if (this.state === 'closed') {
      this.state = 'opening';
      this.win.classList.add('open');
      this._zoom(true);
      audio.setWindowOpen(true);
      audio.whoosh(0.9, true);
      this._hint('');
      await sleep(900);
      this.state = 'open';
      this._hint(C.night.tapSky);
      this._mine = 0;
      this._autoN = 0;
      this._hearts = [6, 14];
      this.fw.prepare(WORDS.map(([t]) => t));
      clearInterval(this._auto);
      this._auto = setInterval(() => this._autoLaunch(), 1300);
      setTimeout(() => this.state === 'open' && this.fw.launch(this.fw.w * 0.5, { y: this.fw.h * 0.32, type: '25', palette: ['#FFD58A', '#FFF4D6'] }), 2500);
      // 系统内置 30 秒：时间到就自动放最后一大波
      clearTimeout(this._t30);
      this._t30 = setTimeout(() => this._timeUp(), 30000);
      return;
    }
    if (this.state === 'open') {
      // 她自己放的：飞向点的位置，格外绚烂
      // 镜头推近后窗户放大了，点的位置要换算回窗户里的坐标（10 是窗框）
      const r = this.win.getBoundingClientRect();
      const z = this._z || 1;
      const x = (e.clientX - r.left) / z - 10;
      const y = Math.min((e.clientY - r.top) / z - 10, this.fw.h * 0.62);
      this.fw.launch(x, { y, type: 'special' });
      this._mine++;
      if (this._mine === 1) this._hint('');
      if (this._mine >= 5) {
        clearTimeout(this._t30);
        this.state = 'mine-done';
        await sleep(2600);
        this.state = 'sleep-ask';
        this._hint(C.night.sleep);
      }
      return;
    }
    if (this.state === 'sleep-ask') return this._finaleThenSleep();
    if (this.state === 'curtain') return this._closeCurtains();
    if (this.state === 'm-closed') this._openMorning();
  }

  // 情况一：30 秒到了，她还没放满 5 朵 → 自动放最后一波，然后提示拉窗帘
  async _timeUp() {
    if (this.state !== 'open') return;
    this.state = 'finale';
    this._hint('');
    clearInterval(this._auto);
    this._finale();
    await sleep(5800 + WORDS.length * WORD_GAP * 1000);
    // 烟花放完，镜头慢慢拉远，拉到一半出现拉窗帘的提示
    this._zoom(false);
    await sleep(CURTAIN_LEAD);
    this.state = 'curtain';
    this._hint(C.night.curtain);
  }

  // 情况二：30 秒内放满 5 朵 → 提示“该睡觉了”，她点了以后放最后一波，然后自动拉窗帘
  async _finaleThenSleep() {
    if (this.state !== 'sleep-ask') return;
    this.state = 'finale';
    this._hint('');
    clearInterval(this._auto);
    this._finale();
    await sleep(6200 + WORDS.length * WORD_GAP * 1000);
    // 烟花放完，镜头慢慢拉远，拉到一半开始关窗拉窗帘，两者重叠
    this._zoom(false);
    await sleep(CURTAIN_LEAD);
    this.state = 'curtain';
    this._closeCurtains();
  }

  async _closeCurtains() {
    if (this.state !== 'curtain') return;
    this.state = 'curtaining';
    this._hint('');
    clearInterval(this._auto);
    this._zoom(false); // 一般这时已经拉远了，这里只是兜底
    this.win.classList.remove('open');
    audio.setWindowOpen(false);
    audio.whoosh(0.8, false);
    await sleep(1200);
    this.wrap.classList.add('curtains-closed');
    audio.whoosh(1.3, false);
    await sleep(2600);
    $('#room-dark').classList.add('on');
    await sleep(1600);
    this.fw.stop();
    this.clock();
  }

  // ================= 时钟 =================
  _buildTicks() {
    let s = '';
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      const a = (i / 60) * Math.PI * 2;
      const r1 = big ? 74 : 80, r2 = 86;
      s += `<line class="tick${big ? ' big' : ''}" x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * r2).toFixed(2)}" y2="${(-Math.cos(a) * r2).toFixed(2)}"/>`;
    }
    $('#ticks').innerHTML = s;
  }

  async clock() {
    this.state = 'clock';
    this.show('#st-room');
    this.room.classList.remove('morning', 'opened');
    this.wrap.classList.add('curtains-closed');
    $('#room-dark').classList.add('on');
    this._hint('');
    const ck = $('#clock');
    ck.hidden = false;
    $('#dawn-btn').hidden = true;
    const hH = $('#hand-h'), hM = $('#hand-m'), txt = $('#clock-time');
    const from = 30, to = 7 * 60 + 30;
    const set = (min) => {
      hM.setAttribute('transform', `rotate(${(min % 60) * 6})`);
      hH.setAttribute('transform', `rotate(${(min / 60) * 30})`);
      const h = Math.floor(min / 60), m = Math.floor(min % 60);
      txt.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    set(from);
    await sleep(1100);
    const DUR = 4600;
    const t0 = performance.now();
    let lastQ = -1;
    await new Promise((res) => {
      const step = (t) => {
        const k = clamp((t - t0) / DUR);
        const min = from + (to - from) * easeInOut(k);
        set(min);
        const q = Math.floor(min / 15);
        if (q !== lastQ) {
          lastQ = q;
          audio.tick(q % 4 === 0);
        }
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
    [84, 79, 76, 72].forEach((m, i) => audio.bell(m, { t: i * 0.35, vol: 0.12, dur: 2.2 }));
    await sleep(600);
    $('.clock-date').textContent = C.clock.dawn;
    $('#dawn-btn').hidden = false;
  }

  // ================= 早晨 =================
  // 拉开窗帘：天色先在暗场和窗帘后面换好，然后窗帘慢慢拉开，光从缝里进来，屋里跟着一点点亮
  async morning(toLetter = false) {
    this.onChapter('morning');
    this.fw.stop();
    clearInterval(this._auto);
    const ck = $('#clock');
    if (!ck.hidden) await ck.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).finished;
    ck.hidden = true;
    this.show('#st-room');
    const dark = $('#room-dark');
    dark.classList.add('on', 'deep');
    this.wrap.classList.add('curtains-closed');
    this.win.classList.remove('open');
    await sleep(450);
    this.room.classList.add('morning', 'dawning');
    await sleep(120);
    this.room.classList.remove('dawning');
    this._dawnLight();
    this.wrap.classList.remove('curtains-closed');
    dark.classList.remove('on', 'deep');
    audio.whoosh(3.6, true);
    await sleep(3200);
    this._lightButtons(true);
    audio.chirp();
    this.top.textContent = C.morning.title;
    this.top.style.opacity = 0;
    await sleep(900);
    this.top.style.opacity = 1;
    await sleep(900);
    this.state = 'm-closed';
    this._hint(C.morning.open);
    if (toLetter) {
      await this._openMorning(true);
      this._letter();
    }
  }

  // 窗帘中间那道光：先是一条缝，跟着窗帘一起变宽，再散开
  _dawnLight() {
    const r = this.win.getBoundingClientRect();
    const d = $('#dawn');
    Object.assign(d.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    d.animate(
      [
        { opacity: 0, transform: 'scaleX(.04)' },
        { opacity: 0.85, transform: 'scaleX(.3)', offset: 0.3 },
        { opacity: 0.7, transform: 'scaleX(.95)', offset: 0.68 },
        { opacity: 0, transform: 'scaleX(1.3)' },
      ],
      { duration: 5600, easing: 'ease-in-out', fill: 'forwards' }
    );
  }

  // 窗外的早晨：粉彩色、细细的手绘线、圆滚滚的云和小山。只有风景，不画角色
  _buildMeadow() {
    const puff = (x, y, k) => `<path transform="translate(${x} ${y}) scale(${k})" fill="#FFFFFF" d="M-44 14 C-58 14 -60 -6 -42 -6 C-44 -24 -18 -28 -12 -14 C-6 -34 26 -32 26 -12 C44 -18 54 2 42 14 Z"/>`;
    const daisy = (x, y, k, c = '#FFFFFF') => {
      let d = '';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - 1.57;
        d += `<circle cx="${(x + Math.cos(a) * 3.6 * k).toFixed(1)}" cy="${(y + Math.sin(a) * 3.6 * k).toFixed(1)}" r="${(2.7 * k).toFixed(1)}" fill="${c}"/>`;
      }
      return `<path d="M${x} ${y} q1 ${8 * k} 0 ${15 * k}" fill="none" stroke="#7DB874"/>${d}<circle cx="${x}" cy="${y}" r="${(2 * k).toFixed(1)}" fill="#FFD98A"/>`;
    };
    const tuft = (x, y) => `<path d="M${x - 4} ${y} q2 -6 3 -8 M${x} ${y} q0 -7 0 -10 M${x + 4} ${y} q-2 -6 -3 -8" fill="none" stroke="#86C07C"/>`;
    const flowers = [[26, 352, 1.1], [62, 372, 1.3, '#FFC9D6'], [104, 348, 1], [142, 378, 1.25], [186, 356, 1.1, '#FFC9D6'], [226, 376, 1.3], [270, 350, 1.1, '#CFE0FA'], [288, 384, 1.2]];
    const tufts = [[44, 340], [88, 382], [124, 336], [166, 362], [206, 340], [250, 366], [12, 378]];
    $('#meadow').innerHTML = `<defs><filter id="crayon" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter></defs>
      <g filter="url(#crayon)" stroke="#8A7868" stroke-width="1" stroke-linejoin="round" stroke-linecap="round">
        ${puff(72, 82, 0.9)}${puff(226, 150, 0.62)}${puff(150, 196, 0.42)}
        <path d="M-10 276 C40 232 92 236 142 264 S232 238 320 270 V410 H-10Z" fill="#D5EEC6"/>
        <path d="M222 252 h8 v18 h-8z" fill="#C9A98A"/>
        <circle cx="226" cy="232" r="19" fill="#A9DC9E"/><circle cx="212" cy="244" r="12" fill="#B6E2A8"/><circle cx="241" cy="245" r="12" fill="#B6E2A8"/>
        <path d="M60 248 h34 v26 h-34z" fill="#FFF3DC"/>
        <path d="M54 250 L77 228 L100 250Z" fill="#F7B3AE"/>
        <path d="M72 258 h10 v16 h-10z" fill="#C9A98A"/>
        <path d="M-10 304 C60 268 130 288 182 302 S270 278 320 298 V410 H-10Z" fill="#C3E7AE"/>
        <path d="M-10 338 C70 320 160 344 320 324 V410 H-10Z" fill="#DDF3B8"/>
        ${tufts.map(([x, y]) => tuft(x, y)).join('')}
        ${flowers.map(([x, y, k, c]) => daisy(x, y, k, c)).join('')}
      </g>`;
    this._bakeMeadow();
  }

  // 手绘线条用的扰动滤镜很费性能，这里只算一次，变成一张静态图
  async _bakeMeadow() {
    const svg = $('#meadow');
    const copy = svg.cloneNode(true);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('width', 900);
    copy.setAttribute('height', 1200);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
    try {
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 1200;
      c.getContext('2d').drawImage(img, 0, 0);
      c.id = 'meadow';
      c.className = 'hills';
      c.setAttribute('aria-hidden', 'true');
      svg.replaceWith(c);
    } catch (e) {}
  }

  _buildFlowers() {
    const colors = ['#F2A7B8', '#FFFFFF', '#8FB8E8', '#FFD58A', '#F2A7B8', '#C9B8FF', '#FFFFFF'];
    let s = '<svg viewBox="0 0 300 90" preserveAspectRatio="xMidYMax meet">';
    colors.forEach((c, i) => {
      const x = 22 + i * 42 + (i % 2) * 6;
      const h = [34, 47, 38, 51, 42, 38, 46][i]; // 紫花和蓝花一样高
      let petals = '';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        petals += `<circle cx="${(x + Math.cos(a) * 7).toFixed(1)}" cy="${(70 - h + Math.sin(a) * 7).toFixed(1)}" r="6.5" fill="${c}" stroke="#8A7868" stroke-width=".7"/>`;
      }
      s += `<g class="stem" style="animation-delay:${-i * 0.4}s"><path d="M${x} 80 C${x - 4} ${80 - h / 2} ${x + 4} ${80 - h / 2} ${x} ${70 - h}" stroke="#5FA06E" stroke-width="2.5" fill="none"/><ellipse cx="${x + 6}" cy="${74 - h / 2}" rx="6" ry="3" fill="#76BE86" transform="rotate(-30 ${x + 6} ${74 - h / 2})"/>${petals}<circle cx="${x}" cy="${70 - h}" r="4" fill="#FFD58A"/></g>`;
    });
    s += '<rect x="6" y="76" width="288" height="16" rx="4" fill="#FFFFFF"/><rect x="6" y="76" width="288" height="4" fill="#E4EAF3"/></svg>';
    $('#flowerbox').innerHTML = s;
  }

  _bird() {
    const b = document.createElement('div');
    b.className = 'bird';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = 10 + Math.random() * 40;
    b.style.top = y + '%';
    b.innerHTML = `<svg viewBox="0 0 26 14"><path class="wing" d="M1 8 Q7 0 13 8 Q19 0 25 8" fill="none" stroke="#3C4A6E" stroke-width="2" stroke-linecap="round"/></svg>`;
    $('#birds').appendChild(b);
    const w = this.win.clientWidth + 60;
    const a = b.animate(
      [
        { transform: `translate(${dir > 0 ? -40 : w}px, 0)` },
        { transform: `translate(${w / 2}px, -18px)` },
        { transform: `translate(${dir > 0 ? w : -40}px, 6px)` },
      ],
      { duration: 5200 + Math.random() * 2000, easing: 'linear' }
    );
    a.onfinish = () => b.remove();
    audio.chirp(0.3);
  }

  async _openMorning(fast = false) {
    if (this.state !== 'm-closed') return;
    this.state = 'm-open';
    this._hint('');
    this.win.classList.add('open');
    this.room.classList.add('opened');
    audio.whoosh(0.9, true);
    this._bird();
    setTimeout(() => this._bird(), 900);
    clearInterval(this._birds);
    this._birds = setInterval(() => this._bird(), 3200);
    [72, 76, 79, 83, 86].forEach((m, i) => audio.bell(m, { t: 0.4 + i * 0.14, vol: 0.09, dur: 2.4 }));
    await sleep(fast ? 100 : 1600);
    const bl = $('#balloons');
    bl.hidden = false;
    // 升到横幅中心位于窗户高度的 40%，也就是中间偏上
    const banner = $('#banner');
    bl.style.setProperty('--rise', `${this.win.clientHeight * 0.4 - banner.offsetTop - banner.offsetHeight / 2}px`);
    await sleep(40);
    bl.classList.add('up');
    this.top.style.opacity = 0;
    if (!fast) {
      await sleep(4200);
      this._hint(C.morning.tapBanner);
    }
  }

  async _letter() {
    if (this.state.startsWith('letter')) return;
    this.onChapter('letter');
    this.state = 'letter-closed';
    this._hint('');
    const r = $('#banner').getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2, { color: '#F2A7B8', count: 14, spread: 120 });
    const L = $('#letter');
    const lines = $('#letter-lines');
    lines.innerHTML = '';
    C.letter.lines.forEach((t) => {
      const p = document.createElement('p');
      p.className = 'w';
      p.textContent = t;
      lines.appendChild(p);
    });
    L.hidden = false;
    clearInterval(this._birds); // 歌响起来以后，鸟叫就不抢了
    audio.playEnding(C.ending.file).catch(() => {});
  }

  // 点一下拆信：封印散开、盖子翻开，窄长的信纸慢慢升出信封，完全离开口袋才换到前层，再放大盖住信封
  // 分层顺序参考 buriksin/love-envelope-v2（MIT）
  async _openEnvelope() {
    if (this.state !== 'letter-closed') return;
    this.state = 'letter';
    const L = $('#letter');
    const env = $('#env');
    const paper = $('#letter .paper');
    $('#env-hint').hidden = true;
    const E = env.getBoundingClientRect();
    sparkle(E.left + E.width / 2, E.top + E.height * 0.57, { color: '#A9CBF2', count: 10, spread: 90 });

    // 平板和电脑上信纸放大到接近满屏，底下给按钮留位置
    const p0 = paper.getBoundingClientRect();
    paper.style.setProperty('--z', clamp(Math.min((innerHeight - 110) / p0.height, (innerWidth - 40) / p0.width), 1, 1.6));

    // 信纸等比缩小到比信封窄，一开始就在信封里，下半截裁掉，升多少露多少
    const P = paper.getBoundingClientRect();
    const s = (E.width * 0.72) / P.width;
    const y0 = E.top + E.height * 0.12;
    const up = Math.min(P.height * s + E.height * 0.06, y0 - 12);
    const seen = E.height * 0.85;
    const pose = (u) => ({
      transform: `translate(${E.left + E.width / 2 - P.left - P.width / 2}px, ${y0 - P.top - u}px) scale(${s})`,
      clipPath: `inset(-80px -80px ${Math.max(0, P.height - (seen + u) / s)}px -80px)`,
      boxShadow: '0 3px 8px rgba(46,58,99,.1)', // 影子先收小，换层时才不会突然压到信封上
    });
    paper.animate([
      { ...pose(0), easing: 'cubic-bezier(.3,.1,.25,1)' },
      { ...pose(up), offset: 0.62 },
      { ...pose(up), offset: 0.7, easing: 'cubic-bezier(.4,0,.2,1)' },
      { transform: 'none', clipPath: 'inset(-80px -80px 0px -80px)', boxShadow: '0 30px 60px rgba(46,58,99,.25)' },
    ], { duration: 3800, delay: 950, fill: 'backwards' });
    L.classList.add('opened');
    env.classList.add('opening');
    await sleep(400);
    env.classList.add('flipped'); // 盖子翻过一半，转到信纸后面
    await sleep(550);
    env.classList.add('flat');
    await sleep(2660);
    L.classList.add('front');
    env.classList.add('out');
    await sleep(1140);
    env.hidden = true;
    await sleep(300);
    this._writeLetter();
  }

  // 称呼、正文一行一行写出来，全部写完才落署名和日期
  async _writeLetter() {
    const write = async (el, gap) => {
      const ms = Math.max(600, el.textContent.length * 110);
      el.style.setProperty('--dur', ms + 'ms');
      el.classList.add('in');
      await sleep(ms + gap);
    };
    for (const el of [$('.paper .to'), ...$('#letter-lines').children]) await write(el, 300);
    await sleep(700);
    await write($('.paper .sign'), 200);
    await write($('.paper .ldate'), 500);
    $('#replay').classList.add('in');
  }
}
