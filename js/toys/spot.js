// 黑暗的舞台，灯打到哪个身份，今晚就演哪个。
import { fit, localXY } from './common.js';

const ROLES = [
  ['南洋书院的学生', 24, 16], ['写 Agent 的人', 72, 13], ['造世界的人', 42, 33], ['乐队里听节奏的人', 74, 37],
  ['机器人社团的队员', 26, 52], ['话剧团的演员', 62, 56], ['水面上的桨手', 34, 73], ['还没想好的人', 73, 76],
];

export function mount(el, app) {
  const IDLE = app.coarse ? '点舞台，灯就打过去' : '移动灯光，找找藏在黑暗里的人';
  el.innerHTML = `
  <div class="spot">
    ${ROLES.map(([t, x, y], i) => `<button type="button" class="role" data-i="${i}" aria-pressed="false" style="left:${x}%;top:${y}%">${t}</button>`).join('')}
    <canvas aria-hidden="true"></canvas>
    <p class="spot-now">${IDLE}</p>
  </div>`;
  const box = el.querySelector('.spot'), cv = el.querySelector('canvas'), x = cv.getContext('2d'), now = el.querySelector('.spot-now');
  const roles = [...el.querySelectorAll('.role')];
  let tx = -1, ty = -1, sx = 0, sy = 0, user = false, init = false, picked = -1, near = -1;

  box.addEventListener('pointermove', (e) => { [tx, ty] = localXY(e, box); user = true; });
  box.addEventListener('pointerdown', (e) => { [tx, ty] = localXY(e, box); user = true; });
  roles.forEach((b, i) => {
    b.addEventListener('focus', () => { tx = b.offsetLeft; ty = b.offsetTop; user = true; });
    b.addEventListener('click', () => {
      picked = i;
      roles.forEach((r) => r.setAttribute('aria-pressed', r === b));
      now.innerHTML = `今晚演：<b>${ROLES[i][0]}</b>`;
      app.pulse(1);
    });
  });

  function setNear(i) {
    if (i === near) return;
    roles[near]?.classList.remove('near');
    near = i;
    roles[near]?.classList.add('near');
    if (picked < 0) now.textContent = near >= 0 ? '点一下，今晚就演这个' : IDLE;
  }

  return {
    frame(dt, t) {
      const { w, h, d } = fit(cv);
      if (!init) { sx = w * .5; sy = h * .4; init = true; }
      const R = Math.min(w, h) * .3;
      const tt = app.reduce ? 1.4 : t;
      const gx = user ? tx : w * (.5 + .34 * Math.sin(tt * .55)), gy = user ? ty : h * (.42 + .28 * Math.sin(tt * .37 + 1));
      const k = app.reduce ? 1 : 1 - Math.exp(-dt * 9);
      sx += (gx - sx) * k; sy += (gy - sy) * k;

      let best = R * .62, hit = -1;
      ROLES.forEach(([, px, py], i) => {
        const dd = Math.hypot(px / 100 * w - sx, py / 100 * h - sy);
        if (dd < best) { best = dd; hit = i; }
      });
      setNear(hit);

      x.setTransform(d, 0, 0, d, 0, 0);
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, w, h);
      x.fillStyle = '#040304'; x.fillRect(0, 0, w, h);

      x.globalCompositeOperation = 'destination-out';
      const g = x.createRadialGradient(sx, sy, R * .42, sx, sy, R);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);

      // 光柱：几层叠起来让边缘变软，往下一直淡到没有，不留底边
      x.globalCompositeOperation = 'lighter';
      const lamp = w * .5 + (sx - w * .5) * .25, end = sy + R * .55;
      for (let i = 0; i < 14; i++) {
        const s = 1 - i * .05;
        const c = x.createLinearGradient(0, 0, 0, end);
        c.addColorStop(0, 'rgba(255,214,150,.032)'); c.addColorStop(.7, 'rgba(255,214,150,.009)'); c.addColorStop(1, 'rgba(255,214,150,0)');
        x.fillStyle = c;
        x.beginPath(); x.moveTo(lamp - 14 * s, 0); x.lineTo(lamp + 14 * s, 0); x.lineTo(sx + R * .95 * s, end); x.lineTo(sx - R * .95 * s, end); x.fill();
      }
      const f = x.createRadialGradient(sx, sy, 0, sx, sy, R);
      f.addColorStop(0, 'rgba(255,214,150,.2)'); f.addColorStop(1, 'rgba(255,214,150,0)');
      x.fillStyle = f; x.fillRect(0, 0, w, h);
    },
  };
}
