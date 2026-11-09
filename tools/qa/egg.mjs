// 小鼠彩蛋：普通视角看不见，显微镜对准才现形。正反两面都拍下来。
import { mkdirSync } from 'node:fs';
mkdirSync('tools/qa/shots', { recursive: true });
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const b = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:18973/', { waitUntil: 'load' });
await page.waitForTimeout(4500);
await page.evaluate(() => window.scrollTo(0, +document.getElementById('cache').dataset.stop));
await page.waitForTimeout(3000);
const at = await page.evaluate(async () => {
  const { app } = await import('/js/main.js');
  const { MOUSE_AT } = await import('/js/die-gen.js');
  const { WAFER } = await import('/js/gl.js');
  const MX = (MOUSE_AT.u - .5) * WAFER.D, MY = (.5 - MOUSE_AT.v) * WAFER.D;
  return app.camera.toScreen(MX, MY);
});
console.log('小鼠屏幕位置', at);
const x = Math.round(at[0] ?? at.x), y = Math.round(at[1] ?? at.y);
const clip = { x: Math.max(0, x - 180), y: Math.max(0, y - 180), width: 360, height: 360 };
await page.screenshot({ path: 'tools/qa/shots/egg-off.png', clip });
// 指针放远处：显微镜开着但没对准，不该触发
await page.mouse.move(Math.max(40, x - 330), Math.max(40, y - 40), { steps: 5 });
await page.waitForTimeout(1500);
console.log('没对准时 toast', JSON.stringify(await page.locator('#toast').innerText()), await page.locator('#toast.on').count());
await page.screenshot({ path: 'tools/qa/shots/egg-miss.png' });
await page.mouse.move(x, y, { steps: 8 });
await page.waitForTimeout(1800);
await page.screenshot({ path: 'tools/qa/shots/egg-on.png', clip });
await page.screenshot({ path: 'tools/qa/shots/egg-full.png' });
console.log('对准后 toast', JSON.stringify(await page.locator('#toast').innerText()), await page.locator('#toast.on').count());
console.log('errs', errs);
await b.close();
