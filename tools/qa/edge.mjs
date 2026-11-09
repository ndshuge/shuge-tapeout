// 边界：多视口、减弱动态、无 WebGL、键盘、触控尺寸。
import { mkdirSync } from 'node:fs';
mkdirSync('tools/qa/shots', { recursive: true });
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const URL = 'http://127.0.0.1:18973/';
const ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl'];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ARGS });
const res = [];
const ok = (name, pass, detail = '') => res.push([pass ? 'PASS' : 'FAIL', name, detail]);
const OUT = 'tools/qa/shots/';
const guard = async (name, fn) => { try { await fn(); } catch (e) { ok(name + ' 脚本异常', false, e.message.slice(0, 200)); } };

async function open(opts = {}, init) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  page.errs = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errs.push(m.text()); });
  page.on('pageerror', (e) => page.errs.push('PAGEERROR ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) page.errs.push(r.status() + ' ' + r.url()); });
  if (init) await page.addInitScript(init);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(4200);
  return { ctx, page };
}

// 1. 多视口
const VIEWS = [[320, 568, 1], [768, 1024, 1], [1024, 768, 0], [1280, 720, 0], [1920, 1080, 0]];
for (const [w, h, m] of VIEWS) await guard(`${w}x${h}`, async () => {
  const { ctx, page } = await open({ viewport: { width: w, height: h }, hasTouch: !!m, isMobile: !!m });
  const docked = await page.evaluate(() => document.documentElement.classList.contains('docked'));
  const n = await page.evaluate(() => document.querySelectorAll('main > section').length);
  const issues = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => { const s = document.querySelectorAll('main > section')[i]; window.scrollTo(0, +s.dataset.stop || 0); }, i);
    await page.waitForTimeout(docked ? 2300 : 900);
    const r = await page.evaluate((docked) => {
      const vw = innerWidth, vh = innerHeight, out = [];
      if (document.documentElement.scrollWidth > vw) out.push('横向溢出 ' + document.documentElement.scrollWidth);
      const sec = [...document.querySelectorAll('main > section')].find((s) => { const b = s.getBoundingClientRect(); return b.top <= vh * .4 && b.bottom > vh * .4; });
      if (!sec) return { id: '?', out };
      if (docked) {
        const col = sec.querySelector('.col'), toy = sec.querySelector('.toy');
        if (col) {
          const c = col.getBoundingClientRect();
          if (c.bottom > vh + 2 && sec.dataset.shot !== 'wafer') out.push('文字栏超出屏幕底 ' + Math.round(c.bottom));
          if (c.top < -2) out.push('文字栏超出屏幕顶 ' + Math.round(c.top));
          const h2 = col.querySelector('h1,h2')?.getBoundingClientRect();
          if (h2 && (h2.top < 0 || h2.bottom > vh)) out.push('标题不在屏幕内');
          if (toy && sec.dataset.shot !== 'cache') {
            const t = toy.getBoundingClientRect();
            if (t.width > 10 && t.left < c.right - 4) out.push(`面板压文字 col.right=${Math.round(c.right)} toy.left=${Math.round(t.left)}`);
            if (t.width > 10 && (t.right > vw + 2 || t.top < -2 || t.bottom > vh + 2)) out.push(`面板出屏 ${[t.left, t.top, t.right, t.bottom].map(Math.round)}`);
          }
        }
      }
      // 任何文字元素超出视口右边
      for (const e of sec.querySelectorAll('h1,h2,h3,p,.btn,.chip')) {
        const b = e.getBoundingClientRect();
        if (b.width && b.right > vw + 1 && !e.closest('.toy')) { out.push('文字出右边 ' + (e.textContent || '').slice(0, 10)); break; }
      }
      return { id: sec.dataset.shot, out };
    }, docked);
    if (r.out.length) issues.push(r.id + ': ' + r.out.join('；'));
    if ([0, 2, 6, 12, 13].includes(i)) await page.screenshot({ path: `${OUT}v-${w}-${i}.png` });
  }
  ok(`${w}x${h} docked=${docked} 全节布局`, issues.length === 0, issues.join(' | '));
  ok(`${w}x${h} 控制台无报错`, page.errs.length === 0, page.errs.slice(0, 3).join(' | '));
  await ctx.close();
});

// 2. 减弱动态
await guard('reduce', async () => {
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const a = await page.evaluate(async () => {
    const { app } = await import('/js/main.js');
    return { reduce: app.reduce };
  });
  ok('减弱动态 被识别', a.reduce === true);
  await page.evaluate(() => window.scrollTo(0, +document.getElementById('pmu').dataset.stop));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + 'rm-pmu.png' });
  const near = await page.evaluate(async () => {
    const { app } = await import('/js/main.js');
    return [app.state.cam.h];
  });
  await page.waitForTimeout(800);
  const later = await page.evaluate(async () => {
    const { app } = await import('/js/main.js');
    return [app.state.cam.h];
  });
  ok('减弱动态 镜头直接到位', near.every((v, i) => Math.abs(v - later[i]) < 1e-3), near.join(',') + ' vs ' + later.join(','));
  const btn = page.locator('#pmu [data-pull]');
  await btn.dispatchEvent('pointerdown');
  await page.waitForTimeout(80);
  ok('减弱动态 拉桨任何时候都算准', (await page.locator('#pmu output').innerHTML()).includes('就这个节奏'), await page.locator('#pmu output').innerHTML());
  await page.evaluate(() => { document.querySelector('[data-shot="die"]'); });
  await page.locator('#map-toggle').click();
  await page.waitForTimeout(150);
  await page.locator('#map-fp button').nth(0).click();
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => Math.abs(scrollY - +document.getElementById('boot').dataset.stop));
  ok('减弱动态 导航瞬移', d < 3, 'd=' + d);
  ok('减弱动态 控制台无报错', page.errs.length === 0, page.errs.slice(0, 3).join(' | '));
  await ctx.close();
});

// 3. 无 WebGL
await guard('nogl', async () => {
  const init = () => {
    const g = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); };
  };
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } }, init);
  const s = await page.evaluate(() => ({ on: document.documentElement.classList.contains('gl-on'), docked: document.documentElement.classList.contains('docked'), sw: document.documentElement.scrollWidth, n: document.querySelectorAll('#work-list li').length, cls: document.documentElement.className, loader: !!document.querySelector('#boot-screen:not([hidden]),#loader:not([hidden])') }));
  ok('无 WebGL 不进入 3D 模式', s.on === false, s.cls);
  ok('无 WebGL 作品列表还在', s.n === 53, String(s.n));
  ok('无 WebGL 没有横向溢出', s.sw <= 1440, String(s.sw));
  await page.screenshot({ path: OUT + 'nogl-0.png' });
  await page.evaluate(() => { const t = document.querySelector('#boot .toy'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 70); });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: OUT + 'nogl-boot.png' });
  ok('无 WebGL 面板内联加载', await page.locator('#boot .bit').count() === 128, String(await page.locator('#boot .bit').count()));
  if (await page.locator('#boot .bit').count()) {
    const b = await page.locator('.rom-text').innerText();
    await page.locator('.bit').nth(40).click();
    await page.waitForTimeout(100);
    ok('无 WebGL 面板可操作', (await page.locator('.rom-text').innerText()) !== b);
  }
  await page.evaluate(() => { const s = document.getElementById('wafer'); window.scrollTo(0, s.offsetTop); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + 'nogl-wafer.png' });
  await page.locator('#work-filter [data-f="agent"]').click();
  await page.waitForTimeout(150);
  const vis = await page.locator('#work-list li:visible').count();
  ok('无 WebGL 筛选可用', vis > 0 && vis < 53, String(vis));
  await page.evaluate(() => { const t = document.querySelector('#npu .toy'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 70); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + 'nogl-npu.png' });
  await page.evaluate(() => { const t = document.querySelector('#life .toy'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 70); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + 'nogl-life.png' });
  await page.evaluate(() => { const s = document.getElementById('cache'); window.scrollTo(0, s.offsetTop); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + 'nogl-cache.png' });
  ok('无 WebGL 控制台无报错', page.errs.length === 0, page.errs.slice(0, 3).join(' | '));
  await ctx.close();
});

// 4. 键盘
await guard('kbd', async () => {
  const { ctx, page } = await open({ viewport: { width: 1440, height: 900 } });
  await page.evaluate(() => window.scrollTo(0, +document.getElementById('boot').dataset.stop));
  await page.waitForTimeout(2600);
  await page.locator('.bit').first().focus();
  const first = await page.evaluate(() => document.activeElement.className);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const pos = await page.evaluate(() => [document.activeElement.dataset.b, document.activeElement.dataset.i]);
  ok('键盘 比特格方向键移动', pos[0] === '1' && pos[1] === '1', pos.join(','));
  const b = await page.locator('.rom-text').innerText();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  ok('键盘 空格翻位', (await page.locator('.rom-text').innerText()) !== b);
  const ring = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return c.outlineStyle + ' ' + c.outlineWidth; });
  ok('键盘 焦点可见', !/none|^\S+ 0px/.test(ring), ring);
  // 导航：键盘进入时平面图要打开，并且用回车能飞过去
  await page.locator('#map-toggle').focus();
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250);
  ok('键盘 Tab 进平面图时展开', await page.locator('#map-fp').isVisible());
  const tag = await page.evaluate(() => document.activeElement.closest('#map-fp') ? document.activeElement.textContent : '');
  ok('键盘 焦点落在模块按钮上', !!tag, tag);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3200);
  const id = await page.evaluate(() => { const vh = innerHeight; const s = [...document.querySelectorAll('main > section')].find((x) => { const b = x.getBoundingClientRect(); return b.top <= vh * .4 && b.bottom > vh * .4; }); return s.dataset.shot; });
  const expect = await page.evaluate((cn) => [...document.querySelectorAll('#map-fp button')].find((b) => b.textContent === cn)?.dataset.go, tag);
  ok('键盘 回车飞到模块', !!tag && id === expect, `${tag} -> ${id} (want ${expect})`);
  // 赛艇用键盘
  await page.evaluate(() => window.scrollTo(0, +document.getElementById('pmu').dataset.stop));
  await page.waitForTimeout(2600);
  await page.locator('#pmu [data-pull]').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  ok('键盘 空格拉桨', /等|就这个|一桨/.test(await page.locator('#pmu output').innerText()), await page.locator('#pmu output').innerText());
  // 舞台：Tab 到角色时灯跟过去，回车选中
  await page.evaluate(() => window.scrollTo(0, +document.getElementById('stage').dataset.stop));
  await page.waitForTimeout(2600);
  await page.locator('.role').nth(4).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  ok('键盘 回车选角', (await page.locator('.spot-now').innerText()).includes('机器人社团'), await page.locator('.spot-now').innerText());
  ok('键盘 控制台无报错', page.errs.length === 0, page.errs.slice(0, 3).join(' | '));
  await ctx.close();
});

// 5. 触控尺寸
await guard('touch', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  for (const id of ['boot', 'agent', 'npu', 'analog', 'gpu', 'cache', 'life', 'robot', 'stage', 'pmu']) {
    await page.evaluate((id) => { const t = document.querySelector('#' + id + ' .toy'); window.scrollTo(0, t.getBoundingClientRect().top + scrollY - 70); }, id);
    await page.waitForTimeout(1300);
  }
  const mounted = await page.evaluate(() => [...document.querySelectorAll('main .toy')].filter((t) => t.children.length).length);
  ok('触控 面板都已挂载', mounted >= 10, String(mounted));
  const r = await page.evaluate(() => {
    const bad = {};
    for (const e of document.querySelectorAll('main button, main a[href], main input, main .role, #map-toggle')) {
      const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if (!b.width || cs.visibility === 'hidden' || e.closest('#map-fp')) continue;
      if (e.tagName === 'A' && cs.display === 'inline') continue;
      // 比特格和鼓机是密集阵列，按 WCAG 2.5.8 的 24px 算；其余都要 44px
      const dense = e.classList.contains('bit') || e.classList.contains('pad');
      if (dense ? (b.height < 24 || b.width < 24) : (b.height < 44 || b.width < 44)) {
        const k = e.className || e.tagName;
        bad[k] = bad[k] || [Math.round(b.width), Math.round(b.height), 0];
        bad[k][2]++;
      }
    }
    return bad;
  });
  ok('触控 小于 44px 的控件', Object.keys(r).length === 0, JSON.stringify(r));
  await ctx.close();
});

for (const r of res) console.log(r.join('  '));
console.log(res.filter((r) => r[0] === 'FAIL').length + ' 项失败，共 ' + res.length + ' 项');
await browser.close();
