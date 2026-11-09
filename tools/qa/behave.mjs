// 逐个玩具做行为测试：正反两面都测。node behave.mjs [w h mobile]
import { mkdirSync } from 'node:fs';
mkdirSync('tools/qa/shots', { recursive: true });
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url);
const { chromium } = require('playwright-core');
const [, , W = '1440', H = '900', M = '0'] = process.argv;
const mobile = M === '1';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile, acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultTimeout(7000);
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('127.0.0.1')) errs.push(r.status() + ' ' + r.url()); });
const res = [];
const ok = (name, pass, detail = '') => { res.push([pass ? 'PASS' : 'FAIL', name, detail]); };
await page.goto('http://127.0.0.1:18973/', { waitUntil: 'load' });
await page.waitForTimeout(4500);

const go = async (id) => {
  await page.evaluate((id) => {
    const s = document.getElementById(id) || document.querySelector(`[data-shot="${id}"]`);
    const toy = !document.documentElement.classList.contains('docked') && s.querySelector('.toy');
    if (toy) window.scrollTo(0, toy.getBoundingClientRect().top + scrollY - 70);
    else window.scrollTo(0, +s.dataset.stop || 0);
  }, id);
  await page.waitForTimeout(2600);
};
const tap = async (loc) => { if (mobile) await loc.tap(); else await loc.click(); };
const text = (sel) => page.locator(sel).first().innerText();

const guard = async (fn) => { try { await fn(); } catch (e) { ok('脚本异常', false, e.message.slice(0, 160)); } };

// ROM
await go('boot');
await guard(async () => {
  const before = await text('.rom-text');
  await tap(page.locator('.bit').nth(40));
  await page.waitForTimeout(150);
  const after = await text('.rom-text');
  ok('ROM 翻一位文字变化', before !== after, `${before} -> ${after}`);
  ok('ROM 引导气泡在第一次点击后消失', await page.locator('.rom .bubble').count() === 0);
  await page.locator('.rom input').fill('鼠哥ABC');
  await tap(page.locator('.rom form .btn').first());
  await page.waitForTimeout(150);
  ok('ROM 写入', (await text('.rom-text')) === '鼠哥ABC', await text('.rom-text'));
  await page.locator('.rom input').fill('超过十六个字节的一长串中文文字');
  await tap(page.locator('.rom form .btn').first());
  await page.waitForTimeout(150);
  const long = await text('.rom-text');
  ok('ROM 超长截断在字符边界', new TextEncoder().encode(long).length <= 16 && !long.includes('\ufffd'), long);
  await page.locator('.rom input').fill('   ');
  await tap(page.locator('.rom form .btn').first());
  await page.waitForTimeout(100);
  ok('ROM 空白不写入', (await text('.rom-text')) === long);
  await tap(page.locator('.rom [data-r]'));
  await page.waitForTimeout(150);
  ok('ROM 恢复出厂', (await text('.rom-text')) === '饮水思源1896');
});

// 鼠洞
await go('agent');
await guard(async () => {
  const n = page.locator('.tun .chip');
  await tap(n.nth(2));
  await page.waitForTimeout(200);
  ok('鼠洞 选中任务', (await n.nth(2).getAttribute('aria-pressed')) === 'true' && (await n.nth(0).getAttribute('aria-pressed')) === 'false');
  ok('鼠洞 开始叙述', (await text('.tun output')).includes('提交这次修改'), await text('.tun output'));
  await page.waitForTimeout(7000);
  const t = await text('.tun output');
  ok('鼠洞 跑完回到起点', t.includes('原路带回') || t.includes('Git'), t);
});

// MOS
await go('npu');
await guard(async () => {
  const r = page.locator('#mos-v');
  ok('MOS 猜之前滑块锁定', await r.isDisabled());
  await tap(page.locator('.mos-opt[data-k="lin"]'));
  await page.waitForTimeout(150);
  ok('MOS 猜完解锁', !(await r.isDisabled()));
  const set = (v) => page.evaluate((v) => { const el = document.getElementById('mos-v'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await set(600);
  await page.waitForTimeout(120);
  ok('MOS 中途不给答案', (await text('.mos output')) === '');
  await set(1200);
  await page.waitForTimeout(120);
  ok('MOS 猜错反馈', (await text('.mos output')).includes('和你想的不一样'), await text('.mos output'));
  await tap(page.locator('.mos-opt[data-k="th"]'));
  await page.waitForTimeout(120);
  await set(1200);
  await page.waitForTimeout(120);
  ok('MOS 猜对反馈', (await text('.mos output')).includes('猜对了'), await text('.mos output'));
});

// 鼓机
await go('analog');
await guard(async () => {
  const pad = page.locator('.pad').nth(1);
  const b = await pad.getAttribute('aria-pressed');
  await tap(pad);
  ok('鼓机 点格切换', (await pad.getAttribute('aria-pressed')) !== b);
  await tap(page.locator('[data-play]').first());
  await page.waitForTimeout(1200);
  ok('鼓机 播放中有走格', await page.locator('.pad.now').count() >= 4, String(await page.locator('.pad.now').count()));
  ok('鼓机 按钮变暂停', (await text('.seq [data-play]')) === '暂停');
  await go('gpu');
  await page.waitForTimeout(300);
  ok('鼓机 离开自动停', (await page.evaluate(() => document.querySelector('.seq [data-play]').textContent)) === '播放');
});

// 世界
await guard(async () => {
  const tabs = page.locator('.w-tab');
  await tap(tabs.nth(2));
  await page.waitForTimeout(200);
  ok('世界 切换标题', (await text('.w-info b')) === '木木金金棋');
  await tap(tabs.nth(5));
  await page.waitForTimeout(200);
  ok('世界 外链项隐藏内嵌按钮', await page.locator('.w-info [data-play]').isHidden());
  await tap(tabs.nth(0));
  await page.waitForTimeout(200);
  await tap(page.locator('.w-info [data-play]'));
  await page.waitForTimeout(800);
  ok('世界 内嵌加载 iframe', await page.locator('.w-screen iframe').count() === 1);
  await tap(page.locator('.w-close'));
  await page.waitForTimeout(200);
  ok('世界 关闭后卸载 iframe', await page.locator('.w-screen iframe').count() === 0);
  await tap(page.locator('.w-info [data-play]'));
  await page.waitForTimeout(500);
  await go('cache');
  await page.waitForTimeout(400);
  ok('世界 离开自动卸载', await page.locator('.w-screen iframe').count() === 0);
});

// 署名
await guard(async () => {
  const px = () => page.evaluate(() => document.querySelector('.stamp [data-save]').disabled);
  ok('署名 刻字前存图不可用', await px());
  await tap(page.locator('.stamp .btn.lit'));
  await page.waitForTimeout(200);
  ok('署名 空名字不刻', await px());
  await page.locator('.stamp input').fill('访客小明');
  await tap(page.locator('.stamp button:not([type=button])'));
  await page.waitForTimeout(700);
  ok('署名 刻上后存图可用', !(await px()));
  ok('署名 toast 提示', (await text('#toast')).includes('访客小明'), await text('#toast'));
  await page.screenshot({ path: process.env.OUT ? process.env.OUT + '-stamp.png' : 'tools/qa/shots/stamp.png' });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), tap(page.locator('.stamp [data-save]'))]);
  if (dl) {
    const p = await dl.path();
    const fs = await import('node:fs');
    ok('署名 存图有文件', fs.statSync(p).size > 50000, `${dl.suggestedFilename()} ${fs.statSync(p).size}`);
  } else ok('署名 存图有文件', false, '没有下载事件');
  await tap(page.locator('.stamp [data-back]'));
  await page.waitForTimeout(300);
  ok('署名 还给鼠哥后按钮回到不可用', await px());
});

// 粒子
await go('life');
await guard(async () => {
  const c = page.locator('.life-cell').nth(5);
  const a = await c.getAttribute('aria-label');
  await tap(c);
  await page.waitForTimeout(100);
  ok('粒子 点格改规则', (await c.getAttribute('aria-label')) !== a, `${a} -> ${await c.getAttribute('aria-label')}`);
  const snap = () => page.$$eval('.life-cell', (x) => x.map((e) => e.getAttribute('aria-label')));
  const s0 = await snap();
  await tap(page.locator('.life [data-one]'));
  await page.waitForTimeout(100);
  const s1 = await snap();
  ok('粒子 随机只改一格', s0.filter((v, i) => v !== s1[i]).length === 1);
});

// 机器人
await go('robot');
await guard(async () => {
  const out0 = await text('.robo output');
  const cv = page.locator('.robo canvas');
  const box = await cv.boundingBox();
  if (mobile) await page.touchscreen.tap(box.x + box.width * .8, box.y + box.height * .5);
  else await page.mouse.click(box.x + box.width * .8, box.y + box.height * .5);
  await page.waitForTimeout(150);
  ok('机器人 点场地有反馈', (await text('.robo output')) !== out0, await text('.robo output'));
  await tap(page.locator('.robo [data-real]'));
  await page.waitForTimeout(150);
  ok('机器人 切到真实世界', (await text('.robo [data-real]')) === '切回仿真' && (await text('.robo output')).includes('噪声'));
  await tap(page.locator('.robo [data-real]'));
  await page.waitForTimeout(150);
  ok('机器人 切回仿真', (await text('.robo [data-real]')) === '切到真实世界');
});

// 舞台
await go('stage');
await guard(async () => {
  const role = page.locator('.role').nth(2);
  const b = await role.boundingBox();
  if (mobile) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(900); ok('舞台 灯到了角色变亮', await role.evaluate((e) => e.classList.contains('near'))); ok('舞台 提示可以点', (await text('.spot-now')).includes('点一下')); await page.mouse.down(); await page.mouse.up(); }
  await page.waitForTimeout(250);
  ok('舞台 选角', (await text('.spot-now')).includes('造世界的人'), await text('.spot-now'));
  ok('舞台 选中态', (await role.getAttribute('aria-pressed')) === 'true');
});

// 赛艇：把玩具单独挂起来，手动拨时钟，判定才可重复
await guard(async () => {
  const r = await page.evaluate(async () => {
    const m = await import('/js/toys/row.js');
    const logs = { gain: [], toast: [] };
    const app = { reduce: false, coarse: false, setGain: (v) => logs.gain.push(v), pulse() {}, ripple() {}, toast: (t) => logs.toast.push(t) };
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:400px;visibility:hidden';
    document.body.append(box);
    const t = m.mount(box, app);
    const P = 60 / 26;
    t.wake(); t.frame(.016, 0);
    const out = box.querySelector('output');
    const btn = box.querySelector('[data-pull]');
    const down = () => btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    const R = {};
    // 走到周期 35%：太早
    t.frame(P * .35, 1); down(); R.early = out.innerHTML;
    // 同一桨再按
    down(); R.again = out.innerHTML;
    // 走到下一个判定窗口中心（周期 1.0）
    t.frame(P * .65 - .016, 2); t.frame(.016, 2);
    down(); R.good = out.innerHTML;
    const g1 = logs.gain.at(-1);
    // 连着打准直到满电
    let n = 0;
    while (!R.full && n < 40) { t.frame(P, 3 + n); down(); n++; if (out.innerHTML.includes('满电')) R.full = out.innerHTML; }
    R.n = n; R.g1 = g1; R.gEnd = logs.gain.at(-1); R.toast = logs.toast;
    t.sleep(); R.gSleep = logs.gain.at(-1);
    box.remove();
    return R;
  });
  ok('赛艇 太早按提示', r.early.includes('等圆环'), r.early);
  ok('赛艇 一桨只算一次', r.again.includes('一桨只算一次'), r.again);
  ok('赛艇 按准有效', r.good.includes('就这个节奏'), r.good);
  ok('赛艇 能充满', !!r.full && r.gEnd > r.g1, `${r.n} 桨 ${r.g1} -> ${r.gEnd}`);
  ok('赛艇 满电提示', r.toast.length === 1, r.toast.join('|'));
  ok('赛艇 离开恢复亮度', r.gSleep === 1);
});

// 晶圆
await page.evaluate(() => { const s = document.getElementById('wafer'); window.scrollTo(0, +s.dataset.stop); });
await page.waitForTimeout(2800);
await guard(async () => {
  const all = await page.locator('#work-list li:visible').count();
  ok('晶圆 全部列表', all === 53, String(all));
  await tap(page.locator('#work-filter [data-f="agent"]'));
  await page.waitForTimeout(250);
  const a = await page.locator('#work-list li:visible').count();
  ok('晶圆 筛选列表', a > 0 && a < 53, String(a));
  await tap(page.locator('#work-filter [data-f="all"]'));
  await page.waitForTimeout(250);
  if (!mobile) {
    const pt = await page.evaluate(() => { const r = document.getElementById('gl').getBoundingClientRect(); return null; });
    // 晶圆中心偏一格，肯定是亮着的作品
    const c = await page.evaluate(() => { const w = innerWidth, h = innerHeight; return [w, h]; });
    const stop = await page.evaluate(() => document.querySelector('[data-shot="wafer"]').dataset.stop);
    // 中心在屏幕右侧，用 WebGL 相机算不到，改成扫描
    let tipped = false, at = null;
    for (let x = 700; x < 1200 && !tipped; x += 40) for (let y = 300; y < 620 && !tipped; y += 40) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(90);
      if (await page.locator('#work-tip.on').count()) { tipped = true; at = [x, y]; }
    }
    ok('晶圆 悬停出提示', tipped, String(at));
    if (tipped) {
      const name = await text('#work-tip b');
      const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null), page.mouse.click(at[0], at[1])]);
      ok('晶圆 点击打开作品', !!pop, name + ' -> ' + (pop ? pop.url() : ''));
      if (pop) await pop.close();
    }
  }
});

// 导航
await guard(async () => {
  await page.evaluate(() => window.scrollTo(0, +document.querySelector('[data-shot="die"]').dataset.stop));
  await page.waitForTimeout(2200);
  await tap(page.locator('.blk[data-go="robot"]'));
  await page.waitForTimeout(3600);
  const d = await page.evaluate(() => { const r = document.getElementById('robot'); const want = document.documentElement.classList.contains('docked') ? +r.dataset.stop : r.offsetTop; return Math.abs(scrollY - want); });
  ok('导航 模块卡片飞过去', d < 8, 'd=' + d);
  ok('导航 当前位置标签', (await text('#map-now')) === '机器人', await text('#map-now'));
});

// 导航收起时不能挡面板；展开和收起都要对
if (!mobile) await guard(async () => {
  for (const id of ['boot', 'npu', 'analog', 'life']) {
    await go(id);
    const hit = await page.evaluate((id) => { const r = document.querySelector('#' + id + ' .toy').getBoundingClientRect(); const e = document.elementFromPoint(r.right - 60, r.top + 100); return !!e.closest('.toy'); }, id);
    ok('导航收起时不挡面板右上角 ' + id, hit);
  }
  const b = await page.locator('#map-toggle').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(350);
  ok('悬停导航按钮展开平面图', await page.locator('#map-fp').isVisible());
  const f = await page.locator('#map-fp').boundingBox();
  await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2, { steps: 6 });
  await page.waitForTimeout(300);
  ok('鼠标移进平面图不收起', await page.locator('#map-fp').isVisible());
  await page.mouse.move(300, 600, { steps: 4 });
  await page.waitForTimeout(350);
  ok('鼠标离开后收起', !(await page.locator('#map-fp').isVisible()));
});

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
ok('横向无溢出', overflow <= 0, String(overflow));
ok('控制台无报错', errs.length === 0, errs.slice(0, 5).join(' | '));
for (const r of res) console.log(r.join('  '));
console.log(res.filter((r) => r[0] === 'FAIL').length + ' 项失败，共 ' + res.length + ' 项');
await browser.close();
