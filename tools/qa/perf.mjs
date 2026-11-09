// 首屏代价和飞行帧率。手机档用 CDP 把 CPU 降 4 倍。
import { mkdirSync } from 'node:fs';
mkdirSync('tools/qa/shots', { recursive: true });
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const init = () => {
  window.__p = { long: [], raf: [], glOn: 0, firstFrame: 0 };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__p.long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  const iv = setInterval(() => { if (document.documentElement?.classList.contains('gl-on')) { window.__p.glOn = performance.now(); clearInterval(iv); } }, 8);
  let last = 0;
  const loop = (n) => { if (last) window.__p.raf.push(n - last); last = n; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
};
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length * q)] * 10) / 10; };
async function run(label, vw, vh, mobile, throttle) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const p = await ctx.newPage();
  await p.addInitScript(init);
  if (throttle) { const c = await ctx.newCDPSession(p); await c.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await p.goto('http://127.0.0.1:18973/', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__p.glOn > 0, null, { timeout: 40000 });
  await p.waitForTimeout(6000);
  const boot = await p.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    return { glOn: Math.round(window.__p.glOn), long: [...window.__p.long].sort((a, b) => b - a).slice(0, 5), kb: Math.round(res.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024), n: res.length };
  });
  await p.evaluate(() => { window.__p.raf.length = 0; window.__p.long.length = 0; });
  await p.waitForTimeout(3000);
  const idle = await p.evaluate(() => [...window.__p.raf]);
  // 一路滚过全部节，触发镜头飞行、面板懒加载
  await p.evaluate(() => { window.__p.raf.length = 0; window.__p.long.length = 0; });
  const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    await p.evaluate((y) => window.scrollTo(0, y), total * i / steps);
    await p.waitForTimeout(40);
  }
  const fly = await p.evaluate(() => ({ raf: [...window.__p.raf], long: [...window.__p.long].sort((a, b) => b - a).slice(0, 5) }));
  const q = await p.evaluate(async () => { const { app } = await import('/js/main.js'); return { W: app.renderer?.W, H: app.renderer?.H }; });
  console.log(label, JSON.stringify({ ...boot, idleP50: pct(idle, .5), idleP95: pct(idle, .95), flyP50: pct(fly.raf, .5), flyP95: pct(fly.raf, .95), flyMax: Math.round(Math.max(...fly.raf)), flyLong: fly.long, drawBuffer: q }));
  await ctx.close();
}
await run('桌面 1440x900', 1440, 900, false, 0);
await run('桌面 1920x1080', 1920, 1080, false, 0);
await run('手机 390x844 CPU÷4', 390, 844, true, 4);
await b.close();
