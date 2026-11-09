// 跟着节奏拉桨，给整张芯片充电。圆环收到中心的那一刻按下去。
import { fit, clamp } from './common.js';

const PERIOD = 60 / 26;   // 每分钟 26 桨
const LOW = .22, HIGH = 1.5;

export function mount(el, app) {
  el.innerHTML = `
  <div class="row-t">
    <canvas role="img" aria-label="一条赛艇在水面上，圆环收缩时按下拉桨"></canvas>
    <div class="row-bar">
      <button type="button" class="btn lit" data-pull>拉桨</button>
      <output aria-live="polite"><b>电量 0%</b>圆环收到中心时按</output>
    </div>
  </div>`;
  const cv = el.querySelector('canvas'), x = cv.getContext('2d'), btn = el.querySelector('[data-pull]'), out = el.querySelector('output');
  let clock = 0, charge = 0, speed = .12, water = 0, stroke = 1, used = false, streak = 0, msg = '', msgA = 0, full = false, fb = 0;

  function say(pct, tail) { out.innerHTML = `<b>${full ? '满电' : '电量 ' + pct + '%'}</b>${tail}`; }
  function apply() { app.setGain(LOW + (HIGH - LOW) * charge); }

  function pull() {
    const ph = (clock % PERIOD) / PERIOD;
    // 减弱动态时圆环不动，每一桨都算准
    const off = app.reduce ? 0 : ph > .5 ? ph - 1 : ph;
    if (app.reduce) used = false;
    stroke = 0;
    let tail;
    if (used) { msg = '等下一桨'; tail = '一桨只算一次'; streak = 0; }
    else if (Math.abs(off) < .1) {
      used = true; streak++;
      charge = clamp(charge + .1 + Math.min(streak, 5) * .012);
      speed = Math.min(1.6, speed + .32);
      msg = '正好'; fb = 1; tail = streak > 2 ? `连续 ${streak} 桨，船跑起来了` : '就这个节奏';
      app.pulse(.9);
      app.ripple((Math.random() - .5) * .08, (Math.random() - .5) * .08, .8);
    } else {
      used = true; streak = 0;
      charge = clamp(charge - .02);
      speed *= .7;
      msg = off < 0 ? '早了一点' : '晚了一点'; fb = -1; tail = '等圆环收到中心';
    }
    msgA = 1;
    btn.classList.remove('lit');
    apply();
    if (charge >= .995 && !full) { full = true; app.pulse(1.6); app.ripple(0, 0, 1.6); app.toast('满电。这张芯片是你划起来的。'); tail = '整张芯片亮了'; }
    say(Math.round(charge * 100), tail);
  }
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); pull(); });
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); pull(); } });

  function rower(cx, cy, s, p) {
    // p：0 抓水 → .35 拉到底 → 1 回桨
    const drive = p < .35 ? p / .35 : 1 - (p - .35) / .65;
    const seat = cx - s * 22 + drive * s * 26;
    const lean = -.42 + drive * .95;
    const hipY = cy - s * 5, shX = seat + Math.sin(lean) * s * 32, shY = hipY - Math.cos(lean) * s * 32;
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = '#ece5d6'; x.lineWidth = s * 5.5;
    x.beginPath(); x.moveTo(seat, hipY); x.lineTo(shX, shY); x.stroke();
    x.lineWidth = s * 4;
    x.beginPath(); x.moveTo(seat, hipY); x.lineTo((seat + cx + s * 36) / 2, hipY - s * (20 - drive * 16)); x.lineTo(cx + s * 36, cy - s * 2); x.stroke();
    const handX = shX + s * (24 - drive * 10), handY = shY + s * 12;
    x.lineWidth = s * 3.4;
    x.beginPath(); x.moveTo(shX, shY); x.lineTo(handX, handY); x.stroke();
    x.fillStyle = '#ece5d6'; x.beginPath(); x.arc(shX + Math.sin(lean) * s * 11, shY - Math.cos(lean) * s * 11, s * 7, 0, 7); x.fill();
    // 桨
    const blade = [handX + s * 74 - drive * s * 148, cy + s * (p < .35 ? 24 : 4)];
    x.strokeStyle = '#d9b676'; x.lineWidth = s * 2.6;
    x.beginPath(); x.moveTo(handX, handY); x.lineTo(blade[0], blade[1]); x.stroke();
    x.fillStyle = '#ffc46b'; x.beginPath(); x.ellipse(blade[0], blade[1], s * 12, s * 4.5, 0, 0, 7); x.fill();
  }

  return {
    wake() { apply(); },
    sleep() { app.setGain(1); },
    frame(dt, t) {
      if (!app.reduce) {
        const prev = clock;
        clock += dt;
        // 越过两个判定窗口的中点时，算进入下一桨
        if (Math.floor(prev / PERIOD + .5) !== Math.floor(clock / PERIOD + .5)) {
          if (!used && charge > 0) streak = 0;
          used = false;
        }
      }
      speed += (.12 - speed) * (1 - Math.exp(-dt * .55));
      water += speed * dt;
      if (stroke < 1) stroke = Math.min(1, stroke + dt / 1.5);
      msgA = Math.max(0, msgA - dt * .9);
      fb *= Math.exp(-dt * 4);

      const { w, h, d } = fit(cv);
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, w, h);
      const hy = h * .42, s = Math.min(w / 640, h / 460) * 1.15;

      // 上半部分不画天：芯片自己就是背景，拉桨时它会亮起来
      const sky = x.createLinearGradient(0, hy * .3, 0, hy);
      sky.addColorStop(0, 'rgba(255,170,90,0)'); sky.addColorStop(1, `rgba(255,${150 + charge * 50},80,${.26 + charge * .42})`);
      x.fillStyle = sky; x.fillRect(0, hy * .3, w, hy * .7);
      const sea = x.createLinearGradient(0, hy, 0, h);
      sea.addColorStop(0, `rgba(120,${90 + charge * 40},60,.8)`); sea.addColorStop(.3, 'rgba(14,26,40,.95)'); sea.addColorStop(1, 'rgba(5,8,14,.98)');
      x.fillStyle = sea; x.fillRect(0, hy, w, h - hy);
      x.strokeStyle = 'rgba(255,220,170,.28)'; x.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const v = (i + 1) / 16, y = hy + v * v * (h - hy) * .92;
        const L = 26 + v * 110, gap = 90 + v * 260;
        const off = -(water * 620 * (.3 + v)) % gap;
        x.beginPath();
        for (let k = -1; k * gap < w + gap; k++) { const px = k * gap + off + (i % 2) * gap * .5; x.moveTo(px, y); x.lineTo(px + L, y); }
        x.stroke();
      }

      const cy = hy + h * .17, cx = w * .5;
      x.fillStyle = '#ece5d6';
      x.beginPath(); x.moveTo(cx - s * 170, cy - s * 3); x.quadraticCurveTo(cx, cy + s * 12, cx + s * 170, cy - s * 3); x.quadraticCurveTo(cx, cy - s * 1, cx - s * 170, cy - s * 3); x.fill();
      rower(cx, cy, s, stroke);

      // 节奏环
      const ph = (clock % PERIOD) / PERIOD, tgt = 30 * s + 12;
      const rx = w * .5, ry = hy * .54;
      // 最外圈不超出面板顶部
      const ring = tgt + (1 - ph) * Math.max(50, Math.min(130 * s, ry - tgt - 6));
      x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 3;
      x.beginPath(); x.arc(rx, ry, tgt, 0, 7); x.stroke();
      const near = ph > .9 || ph < .1;
      x.strokeStyle = near ? '#fff' : '#ffc46b'; x.lineWidth = near ? 7 : 4;
      if (near) { x.shadowColor = '#ffc46b'; x.shadowBlur = 26; }
      x.beginPath(); x.arc(rx, ry, ph < .1 ? tgt : ring, 0, 7); x.stroke();
      x.shadowBlur = 0;
      x.fillStyle = fb > .05 ? `rgba(255,196,107,${fb})` : 'rgba(255,196,107,.16)';
      x.beginPath(); x.arc(rx, ry, tgt - 7, 0, 7); x.fill();
      if (msgA > 0) {
        x.globalAlpha = Math.min(1, msgA * 1.6);
        x.font = `400 ${Math.max(22, 34 * s)}px TapeoutDisplay,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = '#fff'; x.fillText(msg, rx, ry);
        x.globalAlpha = 1;
      }

      // 电量条
      const bw = w - 40, by = h - 8;
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(20, by, bw, 5);
      x.fillStyle = '#ffc46b'; x.fillRect(20, by, bw * charge, 5);
    },
  };
}
