// 四轨鼓机。声音现场合成，只有按了播放才响。底鼓一响，整张芯片的电流跟着冲一下。
import { fit, roving } from './common.js';

const TRACKS = [
  { n: '底鼓', c: '#ffc46b', p: 'x.....x.x...x...' },
  { n: '军鼓', c: '#ff8fb5', p: '....x.......x..x' },
  { n: '镲', c: '#8fe3ff', p: 'x.x.x.x.x.x.x.xx' },
  { n: '贝斯', c: '#b6f08f', p: 'x..x..x...x..x..' },
];
const NOTES = [55, 55, 55, 65.41, 65.41, 73.42, 73.42, 49, 55, 55, 82.41, 82.41, 73.42, 65.41, 65.41, 49];

export function mount(el, app) {
  el.innerHTML = `
  <div class="seq">
    <div class="seq-top">
      <button type="button" class="btn lit" data-play>播放</button>
      <button type="button" class="btn alt" data-clear>清空</button>
      <label>速度<input class="range" type="range" min="70" max="160" value="104" aria-label="速度"></label>
    </div>
    <div class="seq-grid">${TRACKS.map((t, r) => `<div class="seq-trk"><b>${t.n}</b><div class="seq-steps">${[...t.p].map((c, i) => `<button type="button" class="pad${c === 'x' ? ' on' : ''}" style="--c:${t.c}" data-r="${r}" data-i="${i}" aria-label="${t.n} 第 ${i + 1} 拍" aria-pressed="${c === 'x'}"></button>`).join('')}</div></div>`).join('')}</div>
    <canvas role="img" aria-label="示波器"></canvas>
  </div>`;
  const play = el.querySelector('[data-play]'), speed = el.querySelector('.range'), cv = el.querySelector('canvas'), x = cv.getContext('2d');
  const pads = [...el.querySelectorAll('.pad')];
  const grid = TRACKS.map((_, r) => pads.filter((p) => +p.dataset.r === r));
  const seqGrid = el.querySelector('.seq-grid');
  roving(seqGrid, '.pad', 1);

  let ctx = null, master, an, buf, noise, playing = false, nextT = 0, step = 0, shown = -1, q = [];

  function audio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = .55;
    const comp = ctx.createDynamicsCompressor();
    an = ctx.createAnalyser(); an.fftSize = 2048; buf = new Uint8Array(an.fftSize);
    master.connect(comp).connect(an).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const env = (g, t, a, b, dur) => { g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(b, t + dur); };
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + .13);
    env(g, t, 1, .001, .3);
    o.connect(g).connect(master); o.start(t); o.stop(t + .32);
  }
  function burst(t, type, f, a, dur) {
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f;
    env(g, t, a, .001, dur);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  function snare(t) {
    burst(t, 'bandpass', 1900, .75, .17);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190; env(g, t, .5, .001, .1);
    o.connect(g).connect(master); o.start(t); o.stop(t + .12);
  }
  function bass(t, f) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(800, t); fl.frequency.exponentialRampToValueAtTime(180, t + .2);
    env(g, t, .55, .001, .26);
    o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + .28);
  }
  function fire(s, t) {
    if (grid[0][s].classList.contains('on')) kick(t);
    if (grid[1][s].classList.contains('on')) snare(t);
    if (grid[2][s].classList.contains('on')) burst(t, 'highpass', 7200, .3, .05);
    if (grid[3][s].classList.contains('on')) bass(t, NOTES[s]);
    q.push({ t, s, k: grid[0][s].classList.contains('on'), n: grid[1][s].classList.contains('on') });
  }
  function setPlay(on) {
    playing = on;
    play.textContent = on ? '暂停' : '播放';
    play.classList.toggle('lit', !on && !ctx);
    if (on) { audio(); ctx.resume(); nextT = ctx.currentTime + .06; step = 0; q = []; }
    else { pads.forEach((p) => p.classList.remove('now')); shown = -1; }
  }
  play.addEventListener('click', () => setPlay(!playing));
  el.querySelector('[data-clear]').addEventListener('click', () => pads.forEach((p) => { p.classList.remove('on'); p.setAttribute('aria-pressed', 'false'); }));
  seqGrid.addEventListener('click', (e) => {
    const p = e.target.closest('.pad');
    if (!p) return;
    const on = p.classList.toggle('on');
    p.setAttribute('aria-pressed', on);
  });

  return {
    frame() {
      if (playing) {
        const spb = 60 / +speed.value / 4;
        while (nextT < ctx.currentTime + .14) { fire(step, nextT); nextT += spb; step = (step + 1) % 16; }
        while (q.length && q[0].t <= ctx.currentTime) {
          const e = q.shift();
          if (e.k) { app.pulse(1.1); app.ripple((Math.random() - .5) * .04, (Math.random() - .5) * .04, .5); }
          if (e.n) app.pulse(.5);
          if (e.s !== shown) {
            for (const row of grid) { if (shown >= 0) row[shown].classList.remove('now'); row[e.s].classList.add('now'); }
            shown = e.s;
          }
        }
      }
      const { w, h, d } = fit(cv);
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, w, h);
      // 示波器屏幕：先画刻度网格，再画波形
      x.fillStyle = '#090c0a'; x.beginPath(); x.roundRect(0, 0, w, h, 12); x.fill();
      x.strokeStyle = 'rgba(180,255,210,.09)'; x.lineWidth = 1; x.beginPath();
      for (let i = 1; i < 16; i++) { const X = Math.round(i / 16 * w) + .5; x.moveTo(X, 0); x.lineTo(X, h); }
      for (let j = 1; j < 6; j++) { const Y = Math.round(j / 6 * h) + .5; x.moveTo(0, Y); x.lineTo(w, Y); }
      x.stroke();
      x.strokeStyle = '#ffc46b'; x.lineWidth = 2.2; x.shadowColor = '#ffc46b'; x.shadowBlur = 12;
      x.beginPath();
      if (an && playing) {
        an.getByteTimeDomainData(buf);
        for (let i = 0; i < w; i += 2) {
          const v = buf[(i / w * buf.length) | 0] / 128 - 1, y = h / 2 + v * h * .46;
          i ? x.lineTo(i, y) : x.moveTo(i, y);
        }
      } else { x.moveTo(0, h / 2); x.lineTo(w, h / 2); }
      x.stroke(); x.shadowBlur = 0;
    },
    sleep() { if (playing) setPlay(false); },
  };
}
