// Mice Hole 的工作过程：一只小鼠叼着请求，钻过洞，到你的电脑里办事。
import { fit, drawMouse } from './common.js';

const TASKS = [
  { k: 'file', t: '整理下载文件夹', act: '文件：按类型归档' },
  { k: 'term', t: '跑一遍测试', act: '终端：运行测试命令' },
  { k: 'git', t: '提交这次修改', act: 'Git：写好提交信息' },
  { k: 'web', t: '打开页面看一眼', act: '浏览器：截图回来' },
];
const LABEL = { gpt: 'ChatGPT', mcp: 'MCP', hole: 'Mice Hole', file: '文件', term: '终端', git: 'Git', web: '浏览器' };
const POS = { gpt: [.1, .5], mcp: [.33, .5], hole: [.57, .5], file: [.9, .14], term: [.9, .38], git: [.9, .62], web: [.9, .86] };

export function mount(el, app) {
  el.innerHTML = `
  <div class="tun">
    <div class="tun-tasks" role="group" aria-label="让它去做一件事">${TASKS.map((t, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="false">${t.t}</button>`).join('')}</div>
    <canvas role="img" aria-label="请求从 ChatGPT 经过 MCP 和 Mice Hole 到达电脑上的工具，再原路返回"></canvas>
    <output></output>
    <p class="fine-note">这是一段演示动画，不会碰到任何人的电脑。</p>
  </div>`;
  const cv = el.querySelector('canvas'), x = cv.getContext('2d'), out = el.querySelector('output');
  const btns = [...el.querySelectorAll('.chip')];
  let run = null, idle = 1.2, autoI = 0, touched = false, flash = {};

  function route(k) {
    const leaf = POS[k], jog = POS.hole[0] + .13;
    return [POS.gpt, POS.mcp, POS.hole, [jog, POS.hole[1]], [jog, leaf[1]], leaf];
  }
  function start(i, byUser) {
    const task = TASKS[i];
    run = { task, i, s: 0, dir: 1, pts: route(task.k), wait: 0, stage: 0 };
    btns.forEach((b, j) => b.setAttribute('aria-pressed', j === i));
    out.textContent = `你说：${task.t}`;
    if (byUser) touched = true;
    if (app.reduce) { run = null; out.textContent = `${task.act}，结果原路带回。`; flash[task.k] = 1; }
  }
  btns.forEach((b) => b.addEventListener('click', () => start(+b.dataset.i, true)));

  function polyLen(p, w, h) {
    let L = 0; const seg = [];
    for (let i = 1; i < p.length; i++) {
      const dx = (p[i][0] - p[i - 1][0]) * w, dy = (p[i][1] - p[i - 1][1]) * h, l = Math.hypot(dx, dy);
      seg.push({ l, a: Math.atan2(dy, dx), from: L }); L += l;
    }
    return { L, seg };
  }
  function at(p, g, s, w, h) {
    let i = g.seg.length - 1;
    while (i > 0 && g.seg[i].from > s) i--;
    const t = (s - g.seg[i].from) / Math.max(1, g.seg[i].l);
    return { x: (p[i][0] + (p[i + 1][0] - p[i][0]) * t) * w, y: (p[i][1] + (p[i + 1][1] - p[i][1]) * t) * h, a: g.seg[i].a, seg: i };
  }

  function trace(pts, w, h, width, color) {
    x.lineWidth = width; x.strokeStyle = color; x.lineJoin = 'round'; x.lineCap = 'round';
    x.beginPath(); x.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0] * w, pts[i][1] * h);
    x.stroke();
  }

  return {
    frame(dt, t) {
      const { w, h, d } = fit(cv);
      x.setTransform(d, 0, 0, d, 0, 0);
      x.clearRect(0, 0, w, h);
      const narrow = w < 460, fs = narrow ? 12.5 : 15;

      for (const k of ['file', 'term', 'git', 'web']) trace(route(k), w, h, narrow ? 12 : 18, '#1d1913');
      for (const k of ['file', 'term', 'git', 'web']) trace(route(k), w, h, 1.5, 'rgba(255,196,107,.3)');

      if (run) {
        const g = polyLen(run.pts, w, h);
        trace(run.pts, w, h, 3, 'rgba(255,196,107,.9)');
        if (run.wait > 0) run.wait -= dt;
        else run.s += run.dir * dt * Math.max(260, g.L / 2.3);
        const p = at(run.pts, g, run.s, w, h);
        if (run.dir > 0) {
          if (run.stage < 1 && run.s >= g.seg[1].from) { run.stage = 1; out.textContent = 'ChatGPT 决定动手，MCP 把请求递过来'; }
          if (run.stage < 2 && run.s >= g.seg[2].from) { run.stage = 2; out.textContent = '钻进鼠洞，到你的电脑里'; app.pulse(.5); }
        }
        if (run.s >= g.L && run.dir > 0) {
          run.s = g.L; run.dir = -1; run.wait = .55;
          flash[run.task.k] = 1; out.textContent = run.task.act; app.pulse(1);
        }
        if (run.s <= 0 && run.dir < 0) {
          out.textContent = '结果原路带回，ChatGPT 接着干';
          run = null; idle = touched ? 1e9 : 2.2;
        } else {
          const nearHole = Math.hypot(p.x - POS.hole[0] * w, p.y - POS.hole[1] * h);
          const sc = Math.min(1.25, Math.max(0, (nearHole - 8) / 34)) * (narrow ? .78 : 1.15);
          if (sc > .05) {
            const a = run.dir > 0 ? p.a : p.a + Math.PI;
            x.shadowColor = '#ffc46b'; x.shadowBlur = 14; x.fillStyle = run.dir > 0 ? '#ffc46b' : '#8fe3ff';
            x.beginPath(); x.arc(p.x + Math.cos(a) * 21 * sc, p.y + Math.sin(a) * 21 * sc, 5 * sc, 0, 7); x.fill();
            x.shadowBlur = 0;
            drawMouse(x, p.x, p.y, a, t, sc);
          }
        }
      } else if (!app.reduce) {
        idle -= dt;
        if (idle <= 0) { start(autoI++ % TASKS.length, false); }
      }

      const node = (k, big) => {
        const [u, v] = POS[k], px = u * w, py = v * h;
        flash[k] = Math.max(0, (flash[k] || 0) - dt * 1.4);
        const hot = (run && run.task.k === k ? .5 : 0) + flash[k];
        x.font = `700 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
        x.textAlign = 'center'; x.textBaseline = 'middle';
        if (k === 'hole') {
          const R = narrow ? 26 : 40;
          x.fillStyle = '#000'; x.beginPath(); x.arc(px, py, R, 0, 7); x.fill();
          x.strokeStyle = '#ffc46b'; x.lineWidth = 3; x.stroke();
          x.fillStyle = '#ffc46b';
          x.beginPath(); x.arc(px - R * .72, py - R * .86, R * .36, 0, 7); x.arc(px + R * .72, py - R * .86, R * .36, 0, 7); x.fill();
          x.fillStyle = '#f5f0e7'; x.fillText(LABEL[k], px, py + R + (narrow ? 11 : 15));
          return;
        }
        const tw = x.measureText(LABEL[k]).width + (narrow ? 14 : 26), th = narrow ? 30 : 42;
        x.fillStyle = hot > .02 ? `rgb(${60 + 195 * Math.min(1, hot)},${58 + 138 * Math.min(1, hot)},${66 + 41 * Math.min(1, hot)})` : '#23232b';
        x.beginPath(); x.roundRect(px - tw / 2, py - th / 2, tw, th, 10); x.fill();
        x.fillStyle = hot > .6 ? '#120c02' : '#f5f0e7';
        x.fillText(LABEL[k], px, py + 1);
      };
      Object.keys(POS).forEach(node);
    },
    sleep() { if (run) run = null; idle = 1.2; },
  };
}
