// 三对三。同一套策略，一边是仿真，一边是有噪声、有延迟、会摔倒的真实世界。
import { fit, localXY, clamp } from './common.js';

const FW = 1, FH = .64, GOAL = .2, R_B = .022, R_R = .026;
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;

export function mount(el, app) {
  el.innerHTML = `
  <div class="robo">
    <canvas role="img" aria-label="机器人足球场，点击场地把球踢向那里"></canvas>
    <div class="robo-bar">
      <button type="button" class="btn lit" data-real>切到真实世界</button>
      <output>仿真里一切完美。点球场，把球踢过去。</output>
    </div>
  </div>`;
  const cv = el.querySelector('canvas'), x = cv.getContext('2d'), out = el.querySelector('output'), real = el.querySelector('[data-real]');
  let noisy = false, score = [0, 0], freeze = 0, kickedOnce = false, clock = 0, runUntil = 0;
  const ball = { x: .5, y: FH / 2, vx: 0, vy: 0 };
  const hist = [];
  const mk = (x0, y0, team, gk) => ({ x: x0, y: y0, hx: x0, hy: y0, vx: 0, vy: 0, team, gk, a: team ? Math.PI : 0, cd: 0, down: 0 });
  const bots = [mk(.28, .2, 0), mk(.28, .44, 0), mk(.05, FH / 2, 0, 1), mk(.72, .2, 1), mk(.72, .44, 1), mk(.95, FH / 2, 1, 1)];

  function reset() {
    ball.x = .5; ball.y = FH / 2; ball.vx = rnd(.05); ball.vy = rnd(.05);
    bots.forEach((b) => { b.x = b.hx; b.y = b.hy; b.vx = b.vy = 0; b.down = 0; });
    hist.length = 0;
  }
  real.addEventListener('click', () => {
    noisy = !noisy;
    real.textContent = noisy ? '切回仿真' : '切到真实世界';
    real.classList.remove('lit');
    out.textContent = noisy ? '传感器有噪声，通信有延迟，轮子会打滑，偶尔还会摔倒。代码一行没改。' : '回到仿真。一切又完美了。';
    app.pulse(.8);
  });
  cv.addEventListener('pointerdown', (e) => {
    const [cx, cy] = localXY(e, cv), s = view();
    const tx = (cx - s.ox) / s.k, ty = (cy - s.oy) / s.k;
    const dx = tx - ball.x, dy = ty - ball.y, l = Math.hypot(dx, dy) || 1;
    ball.vx = dx / l * .95; ball.vy = dy / l * .95;
    app.pulse(.7);
    runUntil = clock + 5;
    if (!kickedOnce) { kickedOnce = true; if (!noisy) out.textContent = '机器人已经转头追球了。'; }
  });
  function view() {
    const w = cv.clientWidth, h = cv.clientHeight, m = 26;
    const k = Math.min((w - 2 * m) / FW, (h - 2 * m) / FH);
    return { k, ox: (w - FW * k) / 2, oy: (h - FH * k) / 2 };
  }

  function sim(dt) {
    hist.push({ x: ball.x, y: ball.y });
    if (hist.length > 40) hist.shift();
    const lag = noisy ? Math.min(hist.length - 1, 13) : 0;
    const seen = hist[hist.length - 1 - lag] || ball;
    const nearest = [0, 1].map((tm) => {
      let best = null, bd = 9;
      for (const b of bots) if (b.team === tm && !b.gk && !b.down) { const d = Math.hypot(b.x - seen.x, b.y - seen.y); if (d < bd) { bd = d; best = b; } }
      return best;
    });
    for (const b of bots) {
      b.cd -= dt;
      if (b.down > 0) { b.down -= dt; b.vx *= .8; b.vy *= .8; b.x += b.vx * dt; b.y += b.vy * dt; continue; }
      if (noisy && Math.random() < dt * .1) { b.down = 1.2 + Math.random(); continue; }
      const sx = seen.x + (noisy ? rnd(.05) : 0), sy = seen.y + (noisy ? rnd(.05) : 0);
      const gx = b.team ? 0 : FW, gy = FH / 2;
      const dg = Math.hypot(gx - sx, gy - sy) || 1;
      let tx, ty;
      if (b.gk) { tx = b.hx; ty = clamp(sy, FH / 2 - GOAL / 2 - .01, FH / 2 + GOAL / 2 + .01); }
      else if (b === nearest[b.team]) { tx = sx - (gx - sx) / dg * .035; ty = sy - (gy - sy) / dg * .035; }
      else { tx = b.team ? clamp(sx + .2, .55, .86) : clamp(sx - .2, .14, .45); ty = b.hy; }
      const dx = tx - b.x, dy = ty - b.y, l = Math.hypot(dx, dy) || 1, sp = b.gk ? .22 : .27;
      const want = Math.min(sp, l * 5);
      const ax = dx / l * want - b.vx, ay = dy / l * want - b.vy, k = 1 - Math.exp(-dt * 9);
      b.vx += ax * k + (noisy ? rnd(.05) : 0); b.vy += ay * k + (noisy ? rnd(.05) : 0);
      b.x = clamp(b.x + b.vx * dt, .01, FW - .01); b.y = clamp(b.y + b.vy * dt, .01, FH - .01);
      if (l > .01) { const ang = Math.atan2(b.vy, b.vx); let da = ang - b.a; da = Math.atan2(Math.sin(da), Math.cos(da)); b.a += da * (1 - Math.exp(-dt * 10)); }
      const d = Math.hypot(ball.x - b.x, ball.y - b.y);
      if (d < R_B + R_R + .01 && b.cd <= 0) {
        const dbg = Math.hypot(gx - ball.x, gy - ball.y) || 1;
        const pow = .7 + Math.random() * .25, err = noisy ? rnd(.38) : rnd(.05);
        const dirx = (gx - ball.x) / dbg, diry = (gy - ball.y) / dbg;
        ball.vx = (dirx * Math.cos(err) - diry * Math.sin(err)) * pow;
        ball.vy = (dirx * Math.sin(err) + diry * Math.cos(err)) * pow;
        b.cd = .4;
      }
    }
    // 机器人之间互相让开
    for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
      const a = bots[i], b = bots[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3, m = 2 * R_R;
      if (d < m) { const p = (m - d) / 2 / d; a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; }
    }
    if (freeze > 0) { freeze -= dt; if (freeze <= 0) reset(); return; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    const f = Math.exp(-dt * .85); ball.vx *= f; ball.vy *= f;
    if (ball.y < R_B) { ball.y = R_B; ball.vy *= -.8; }
    if (ball.y > FH - R_B) { ball.y = FH - R_B; ball.vy *= -.8; }
    const inMouth = Math.abs(ball.y - FH / 2) < GOAL / 2;
    if (ball.x < 0 || ball.x > FW) {
      if (inMouth) {
        score[ball.x < 0 ? 1 : 0]++;
        freeze = 1; ball.vx = ball.vy = 0;
        ball.x = clamp(ball.x, -.02, FW + .02);
        app.pulse(1.4); app.ripple(0, 0, 1.2);
      } else { ball.x = clamp(ball.x, 0, FW); ball.vx *= -.8; }
    }
  }

  return {
    frame(dt, t) {
      clock += dt;
      // 减弱动态时场面静止，只有访客踢了一脚才动几秒
      if (!app.reduce || clock < runUntil) sim(dt);
      const { w, h, d } = fit(cv);
      const { k, ox, oy } = view();
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, w, h);
      const X = (v) => ox + v * k, Y = (v) => oy + v * k;
      x.fillStyle = '#0f3a22'; x.beginPath(); x.roundRect(X(0) - 6, Y(0) - 6, FW * k + 12, FH * k + 12, 8); x.fill();
      x.fillStyle = 'rgba(255,255,255,.035)';
      for (let i = 0; i < 9; i += 2) x.fillRect(X(i / 9), Y(0), k / 9, FH * k);
      x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2;
      x.strokeRect(X(0), Y(0), FW * k, FH * k);
      x.beginPath(); x.moveTo(X(.5), Y(0)); x.lineTo(X(.5), Y(FH)); x.stroke();
      x.beginPath(); x.arc(X(.5), Y(FH / 2), .09 * k, 0, 7); x.stroke();
      x.fillStyle = 'rgba(255,196,107,.9)'; x.fillRect(X(0) - 7, Y(FH / 2 - GOAL / 2), 7, GOAL * k);
      x.fillStyle = 'rgba(127,214,255,.9)'; x.fillRect(X(FW), Y(FH / 2 - GOAL / 2), 7, GOAL * k);

      for (const b of bots) {
        const r = R_R * k;
        x.save(); x.translate(X(b.x), Y(b.y)); x.rotate(b.a);
        if (b.down > 0) x.globalAlpha = .45 + .3 * Math.sin(t * 14);
        x.fillStyle = b.team ? '#7fd6ff' : '#ffc46b';
        x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
        x.fillStyle = '#10100f'; x.beginPath(); x.arc(r * .46, 0, r * .3, 0, 7); x.fill();
        x.restore();
      }
      x.shadowColor = '#ff7a2d'; x.shadowBlur = 14; x.fillStyle = '#ff8c3c';
      x.beginPath(); x.arc(X(ball.x), Y(ball.y), R_B * k, 0, 7); x.fill(); x.shadowBlur = 0;

      x.font = `700 ${Math.max(20, k * .065)}px TapeoutDisplay,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'top';
      x.fillStyle = '#ffc46b'; x.fillText(score[0], X(.42), Y(0) + 10);
      x.fillStyle = '#7fd6ff'; x.fillText(score[1], X(.58), Y(0) + 10);
    },
  };
}
