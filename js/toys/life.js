// Particle Life。四种粒子，每一格是“谁被谁吸引”。改一格，整个世界重排。
import { fit, localXY } from './common.js';

const T = 4, COL = ['#ffc46b', '#7fd6ff', '#ff8fb5', '#a5ef9a'];
const STEPS = [-1, -.5, 0, .5, 1];
const START = [[.5, 1, -.5, 0], [-1, .5, 1, -.5], [.5, -1, .5, 1], [1, 0, -1, .5]];

function sprite(c) {
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const x = s.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(.16, c); g.addColorStop(.46, c + '38'); g.addColorStop(1, c + '00');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return s;
}

export function mount(el, app) {
  el.innerHTML = `
  <div class="life">
    <canvas role="img" aria-label="四种粒子按规则聚散"></canvas>
    <div class="life-ui">
      <div class="life-grid" role="group" aria-label="规则表，行被列吸引"></div>
      <button type="button" class="btn lit" data-one>随机改一条</button>
      <p class="life-legend">金色吸引，蓝色排斥</p>
    </div>
  </div>`;
  const cv = el.querySelector('canvas'), x = cv.getContext('2d'), gridEl = el.querySelector('.life-grid');
  const one = el.querySelector('[data-one]');
  const sprites = COL.map(sprite);
  const M = START.map((r) => r.slice());
  const N = app.coarse ? 420 : 820;
  const px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), ty = new Uint8Array(N);
  for (let i = 0; i < N; i++) { px[i] = Math.random() * 1.5; py[i] = Math.random(); ty[i] = i % T; }
  const head = new Int32Array(4096), next = new Int32Array(N);
  let asp = 1.5, ptr = null, down = false, acc = 0, clock = 0, runUntil = 3;

  const shade = (v) => (v > 0 ? `rgb(${120 + 135 * v},${100 + 96 * v},${60 + 47 * v})` : v < 0 ? `rgb(${90 + 37 * (1 + v)},${130 + 40 * (1 + v)},${200 + 55 * -v})` : '#3a3a45');
  gridEl.innerHTML = '<span></span>' + COL.map((c) => `<i style="--c:${c}"></i>`).join('')
    + M.map((r, a) => `<i style="--c:${COL[a]}"></i>` + r.map((_, b) => `<button type="button" class="life-cell" data-a="${a}" data-b="${b}"></button>`).join('')).join('');
  const cells = [...gridEl.querySelectorAll('.life-cell')];
  const cellOf = (a, b) => cells[a * T + b];
  function paint(c) {
    const v = M[+c.dataset.a][+c.dataset.b];
    c.style.background = shade(v);
    c.textContent = v > 0 ? '+' : v < 0 ? '−' : '0';
    c.setAttribute('aria-label', `第 ${+c.dataset.a + 1} 种对第 ${+c.dataset.b + 1} 种：${v}`);
  }
  cells.forEach(paint);
  function setCell(a, b, v) {
    M[a][b] = v;
    runUntil = clock + 5;
    const c = cellOf(a, b);
    paint(c); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
    app.pulse(.6);
  }
  gridEl.addEventListener('click', (e) => {
    const c = e.target.closest('.life-cell');
    if (!c) return;
    const a = +c.dataset.a, b = +c.dataset.b;
    setCell(a, b, STEPS[(STEPS.indexOf(M[a][b]) + 1) % STEPS.length]);
    one.classList.remove('lit');
  });
  one.addEventListener('click', () => {
    const a = Math.random() * T | 0, b = Math.random() * T | 0;
    let v; do { v = STEPS[Math.random() * STEPS.length | 0]; } while (v === M[a][b]);
    setCell(a, b, v);
    one.classList.remove('lit');
  });

  const toP = (e) => { const [cx, cy] = localXY(e, cv); return [cx / cv.clientHeight, cy / cv.clientHeight]; };
  cv.addEventListener('pointermove', (e) => { ptr = toP(e); });
  cv.addEventListener('pointerdown', (e) => { ptr = toP(e); down = true; });
  addEventListener('pointerup', () => { down = false; });
  cv.addEventListener('pointerleave', () => { ptr = null; });

  const Rm = .13, beta = .34, dt = .02, fr = Math.pow(.5, dt / .04), force = 9;
  function step() {
    const gx = Math.max(1, Math.floor(asp / Rm)), gy = Math.max(1, Math.floor(1 / Rm)), cw = asp / gx, ch = 1 / gy;
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      const k = Math.min(gx - 1, px[i] / cw | 0) + Math.min(gy - 1, py[i] / ch | 0) * gx;
      next[i] = head[k]; head[k] = i;
    }
    for (let i = 0; i < N; i++) {
      let fx = 0, fy = 0;
      const ci = Math.min(gx - 1, px[i] / cw | 0), cj = Math.min(gy - 1, py[i] / ch | 0);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        let j = head[((ci + di + gx) % gx) + ((cj + dj + gy) % gy) * gx];
        while (j >= 0) {
          if (j !== i) {
            let dx = px[j] - px[i], dy = py[j] - py[i];
            if (dx > asp / 2) dx -= asp; else if (dx < -asp / 2) dx += asp;
            if (dy > .5) dy -= 1; else if (dy < -.5) dy += 1;
            const r2 = dx * dx + dy * dy;
            if (r2 > 0 && r2 < Rm * Rm) {
              const rr = Math.sqrt(r2), r = rr / Rm;
              // 近距离排斥加强，粒子团才撑得开，不会塌成一个白点
              const f = r < beta ? (r / beta - 1) * 2.4 : M[ty[i]][ty[j]] * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
              fx += dx / rr * f; fy += dy / rr * f;
            }
          }
          j = next[j];
        }
      }
      fx *= Rm * force; fy *= Rm * force;
      if (ptr) {
        const dx = ptr[0] - px[i], dy = ptr[1] - py[i], d2 = dx * dx + dy * dy;
        if (d2 < .06) {
          const k = (down ? 1.2 : -.5) * (1 - d2 / .06) / Math.max(.03, Math.sqrt(d2));
          fx += dx * k; fy += dy * k;
        }
      }
      vx[i] = vx[i] * fr + fx * dt; vy[i] = vy[i] * fr + fy * dt;
    }
    for (let i = 0; i < N; i++) {
      px[i] = (px[i] + vx[i] * dt + asp) % asp;
      py[i] = (py[i] + vy[i] * dt + 1) % 1;
    }
  }

  return {
    frame(fdt) {
      const { w, h, d } = fit(cv, 1.5);
      asp = w / h;
      clock += fdt;
      // 固定步长：高刷屏幕上不会跑得更快。减弱动态时只在刚改完规则后动几秒
      if (!app.reduce || clock < runUntil) {
        acc = Math.min(acc + fdt, .05);
        while (acc >= 1 / 60) { step(); acc -= 1 / 60; }
      }
      x.setTransform(d, 0, 0, d, 0, 0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = 'rgba(0,0,0,.26)'; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = .78;
      const s = app.coarse ? 15 : 17;
      for (let i = 0; i < N; i++) x.drawImage(sprites[ty[i]], px[i] * h - s / 2, py[i] * h - s / 2, s, s);
    },
  };
}
