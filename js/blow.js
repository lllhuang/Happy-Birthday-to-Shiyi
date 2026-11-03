// 用麦克风判断“吹气”：吹气是一段持续的、低频很重的噪声。
// onLevel(0..1) 每帧回调，onBlow() 在吹够了时回调一次。

export async function listenForBlow({ onLevel, onBlow }) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  if (ctx.state === 'suspended') await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  an.smoothingTimeConstant = 0.2;
  src.connect(an);
  const freq = new Uint8Array(an.frequencyBinCount);
  const time = new Float32Array(an.fftSize);
  const binHz = ctx.sampleRate / an.fftSize;
  const lowEnd = Math.max(2, Math.round(600 / binHz));

  let baseline = null;
  const calib = [];
  let above = 0;
  let total = 0;
  let stopped = false;
  let last = performance.now();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };

  const frame = () => {
    if (stopped) return;
    const now = performance.now();
    const dt = Math.min(100, now - last);
    last = now;
    an.getFloatTimeDomainData(time);
    an.getByteFrequencyData(freq);
    let sum = 0;
    for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
    const rms = Math.sqrt(sum / time.length);
    let low = 0;
    for (let i = 1; i < lowEnd; i++) low += freq[i];
    low /= (lowEnd - 1) * 255;

    if (baseline === null) {
      calib.push(rms);
      if (calib.length > 20) baseline = calib.reduce((a, b) => a + b, 0) / calib.length;
      requestAnimationFrame(frame);
      return;
    }
    const thresh = Math.max(baseline * 3.2, 0.045);
    const level = Math.min(1, Math.max(0, (rms - baseline) / (thresh * 2.2)));
    onLevel && onLevel(level);
    if (rms > thresh && low > 0.38) {
      above += dt;
      total += dt;
    } else {
      above = Math.max(0, above - dt * 0.5);
    }
    if (above > 260 || total > 700) {
      onLevel && onLevel(0);
      stop();
      onBlow && onBlow();
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return stop;
}
