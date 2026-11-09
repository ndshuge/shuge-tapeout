// 先预测，再实验：MOS 管的转移特性。曲线按真实的平方律算。
import { fit } from './common.js';

const VMAX = 1.2, VTH = .45;
const real = (v) => (v < VTH ? .0004 * Math.exp((v - VTH) * 14) : (v - VTH) ** 2 / (VMAX - VTH) ** 2);
const GUESS = {
  lin: (v) => v / VMAX,
  th: real,
  sat: (v) => 1 - Math.exp(-v * 5.2),
};
const OPTS = [
  { k: 'lin', t: '跟着电压一起涨', d: 'M3 33 L43 4' },
  { k: 'th', t: '过了某点才猛涨', d: 'M3 33 L20 33 Q34 31 43 4' },
  { k: 'sat', t: '涨一点就平了', d: 'M3 33 Q10 8 43 7' },
];

export function mount(el, app) {
  el.innerHTML = `
  <div class="mos pick">
    <p class="mos-q">把栅极电压从 0 慢慢拧高，这只晶体管的电流会怎么变？你先猜。</p>
    <div class="mos-opts" role="group" aria-label="你的预测">${OPTS.map((o) => `<button type="button" class="mos-opt" data-k="${o.k}" aria-pressed="false"><svg viewBox="0 0 46 36" aria-hidden="true"><path d="${o.d}"/></svg>${o.t}</button>`).join('')}</div>
    <canvas role="img" aria-label="MOS 管剖面和电流曲线"></canvas>
    <div class="mos-ctl"><label for="mos-v">栅极电压</label><input id="mos-v" class="range" type="range" min="0" max="1200" value="0" disabled></div>
    <output></output>
  </div>`;
  const box = el.querySelector('.mos'), cv = el.querySelector('canvas'), x = cv.getContext('2d');
  const range = el.querySelector('input'), out = el.querySelector('output'), q = el.querySelector('.mos-q');
  const opts = [...el.querySelectorAll('.mos-opt')];
  let guess = null, V = 0, done = false;
  const eN = 70, es = Array.from({ length: eN }, (_, i) => ({ u: Math.random(), v: Math.random(), on: i / eN }));

  opts.forEach((b) => b.addEventListener('click', () => {
    guess = b.dataset.k; done = false;
    box.classList.remove('pick');
    opts.forEach((o) => o.setAttribute('aria-pressed', o === b));
    range.disabled = false; range.value = 0; V = 0;
    q.textContent = '好，记住你的答案。现在亲手拧一下。';
    out.textContent = '';
    range.focus({ preventScroll: true });
  }));
  range.addEventListener('input', () => {
    V = +range.value / 1000;
    if (guess && V > 1.14 && !done) {
      done = true;
      const ok = guess === 'th';
      out.innerHTML = `<b>${ok ? '猜对了。' : '和你想的不一样。'}</b>栅压过了阈值，沟道才形成，电流按平方增长。这就是开关，也是一颗芯片里几十亿次重复的那件事。`;
      q.textContent = ok ? '预测和实验对上了。' : '实验说了算。虚线是你猜的，实线是真的。';
      app.pulse(1.2);
    }
  });

  return {
    frame(dt, t) {
      const { w, h, d } = fit(cv);
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, w, h);
      const wide = w > 520;
      const R = wide ? { x: 0, y: 0, w: w * .5 - 10, h } : { x: 0, y: 0, w, h: h * .5 - 6 };
      const P = wide ? { x: w * .5 + 10, y: 0, w: w * .5 - 10, h } : { x: 0, y: h * .5 + 6, w, h: h * .5 - 6 };
      const I = real(V);
      const over = Math.max(0, (V - VTH) / (VMAX - VTH));

      // 剖面
      const sy = R.y + R.h * .36, by = R.y + R.h;
      x.fillStyle = '#1c1421'; x.beginPath(); x.roundRect(R.x, sy, R.w, by - sy, [0, 0, 12, 12]); x.fill();
      const wW = R.w * .26, wH = (by - sy) * .42;
      x.fillStyle = '#21476e';
      x.beginPath(); x.roundRect(R.x, sy, wW, wH, [0, 0, 16, 0]); x.fill();
      x.beginPath(); x.roundRect(R.x + R.w - wW, sy, wW, wH, [0, 0, 0, 16]); x.fill();
      x.fillStyle = '#d7d2c8'; x.fillRect(R.x + wW - 4, sy - 7, R.w - 2 * wW + 8, 7);
      const g = 90 + V / VMAX * 165;
      x.fillStyle = `rgb(${g},${g * .77},${g * .42})`;
      x.beginPath(); x.roundRect(R.x + wW, sy - 7 - R.h * .17, R.w - 2 * wW, R.h * .17, 6); x.fill();
      if (V > .02) {
        x.shadowColor = '#ffc46b'; x.shadowBlur = 26 * V;
        x.fillRect(R.x + wW, sy - 7 - R.h * .17, R.w - 2 * wW, 3);
        x.shadowBlur = 0;
      }
      x.font = '700 15px "PingFang SC","Microsoft YaHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = g > 170 ? '#120c02' : '#fff3df'; x.fillText('栅极', R.x + R.w / 2, sy - 7 - R.h * .085);
      // 源、漏的字放在阱的下方，不让电子盖住
      x.fillStyle = '#cfe6ff'; x.fillText('源', R.x + wW / 2, sy + wH + 15); x.fillText('漏', R.x + R.w - wW / 2, sy + wH + 15);
      x.fillStyle = '#a79f91'; x.fillText('硅', R.x + R.w / 2, by - 18);

      // 沟道和电子
      const chH = 2 + over * 13;
      if (over > 0) {
        x.fillStyle = `rgba(120,200,255,${.2 + over * .5})`;
        x.fillRect(R.x + wW, sy, R.w - 2 * wW, chH);
      }
      x.fillStyle = '#9fe2ff';
      const speed = .1 + I * 1.1;
      for (const e of es) {
        e.u += dt * speed * (.7 + e.v * .6);
        if (e.u > 1) e.u -= 1;
        const inCh = e.u > .26 && e.u < .74;
        if (inCh && (over <= 0 || e.on > over * 1.05 + .08)) continue;
        const px = R.x + e.u * R.w;
        const py = inCh ? sy + e.v * chH : sy + (.12 + e.v * .7) * wH * Math.min(1, Math.min(e.u, 1 - e.u) * 3.2 + .2);
        x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill();
      }

      // 曲线
      const px = (v) => P.x + 34 + v / VMAX * (P.w - 46), py = (i) => P.y + P.h - 26 - i * (P.h - 46);
      x.strokeStyle = '#3a3a45'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(px(0), P.y + 12); x.lineTo(px(0), py(0)); x.lineTo(P.x + P.w - 6, py(0)); x.stroke();
      x.fillStyle = '#a79f91'; x.textAlign = 'center';
      x.fillText('栅压', P.x + P.w / 2 + 14, P.y + P.h - 10);
      x.textAlign = 'left'; x.fillText('电流', px(0) + 8, P.y + 14); x.textAlign = 'center';
      if (guess && guess !== 'th') {
        x.setLineDash([6, 7]); x.strokeStyle = '#8f897d'; x.lineWidth = 2.4; x.beginPath();
        for (let v = 0; v <= VMAX; v += .02) { const f = GUESS[guess](v); v ? x.lineTo(px(v), py(f)) : x.moveTo(px(v), py(f)); }
        x.stroke(); x.setLineDash([]);
      }
      x.strokeStyle = '#ffc46b'; x.lineWidth = 3.4; x.beginPath();
      for (let v = 0; v <= V + .001; v += .012) { const f = real(v); v ? x.lineTo(px(v), py(f)) : x.moveTo(px(v), py(f)); }
      x.stroke();
      x.shadowColor = '#ffc46b'; x.shadowBlur = 20; x.fillStyle = '#fff';
      x.beginPath(); x.arc(px(V), py(I), 6, 0, 7); x.fill(); x.shadowBlur = 0;
      if (!guess) {
        x.fillStyle = '#8f897d'; x.textAlign = 'center'; x.fillText('曲线要你猜完才画', P.x + P.w / 2 + 14, P.y + P.h / 2);
      }
      if (I > .02) app.state.boost = Math.max(app.state.boost, I * .5);
    },
  };
}
