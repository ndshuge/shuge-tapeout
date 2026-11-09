// 晶圆模式：每件作品是一颗点亮的芯片，其余空位留给以后。
import { WORKS } from '../data/works.js';
import { WAFER } from './gl.js';

// 色相对应着色器里的余弦调色板：金、青、绿、粉、紫
const HUE = { game: .92, learn: .5, agent: .67, life: .08, art: .2 };
const NAMES = { all: '全部', game: '游戏与世界', learn: '学习', agent: 'Agent', life: '生活工具', art: '实验与艺术' };
const swatch = (h) => `rgb(${[0, .33, .67].map((d) => Math.round(255 * (.55 + .45 * Math.cos(6.2831 * (h + d))))).join(',')})`;

// 列表不依赖 WebGL：显卡不支持时也要能看到全部作品
function renderList(onFilter) {
  document.getElementById('work-count').textContent = WORKS.length;
  const fBox = document.getElementById('work-filter');
  const listBox = document.getElementById('work-list');
  fBox.innerHTML = Object.entries(NAMES).map(([k, n]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${k === 'all'}">${HUE[k] ? `<i class="dot" style="background:${swatch(HUE[k])}"></i>` : ''}${n}</button>`).join('');
  listBox.innerHTML = WORKS.map((w) => `<li data-c="${w.c}"><a href="${w.u}" target="_blank" rel="noopener" data-wid="${w.id}"><b>${w.t.split(' · ')[0]}</b><i aria-hidden="true">↗</i></a></li>`).join('');
  fBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    fBox.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    listBox.querySelectorAll('li').forEach((li) => { li.hidden = b.dataset.f !== 'all' && li.dataset.c !== b.dataset.f; });
    onFilter(b.dataset.f);
  });
  return listBox;
}
export const initWorkList = () => renderList(() => {});

export function initWafer(app) {
  const { P } = WAFER;
  const r = app.renderer, cam = app.camera;
  const cells = [];
  for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
    if (Math.hypot(Math.abs(x) + .5, Math.abs(y) + .5) * P < .965) cells.push({ x, y, d: Math.hypot(x, y) + Math.atan2(y, x) * .02 });
  }
  cells.sort((a, b) => a.d - b.d);
  cells.shift();

  const items = WORKS.map((w, i) => ({ ...w, cell: cells[i] }));
  const byCell = new Map(items.map((w) => [w.cell.x + ',' + w.cell.y, w]));
  let filter = 'all', hover = null, listHot = null, sheetOpen = false;

  const put = (x, y, lit, hue, hov) => {
    const k = ((y + 16) * 32 + x + 16) * 4;
    r.mapData[k] = lit; r.mapData[k + 1] = hue; r.mapData[k + 2] = hov; r.mapData[k + 3] = 255;
  };
  function paint() {
    r.mapData.fill(0);
    put(0, 0, 255, HUE.game * 255, 0);
    for (const w of items) {
      const on = filter === 'all' || w.c === filter;
      put(w.cell.x, w.cell.y, on ? 255 : 26, HUE[w.c] * 255, w === (listHot || hover) ? 255 : 0);
    }
    r.updateMap();
  }
  paint();

  /* 列表 */
  const listBox = renderList((f) => { filter = f; paint(); });
  const fromA = (a) => items.find((w) => w.id === a.dataset.wid);
  const hot = (e) => {
    const a = e.target.closest?.('a[data-wid]');
    listHot = a ? fromA(a) : null;
    paint();
    showTip(listHot);
  };
  listBox.addEventListener('pointerover', hot);
  listBox.addEventListener('pointerleave', () => { listHot = null; paint(); showTip(null); });
  listBox.addEventListener('focusin', hot);
  listBox.addEventListener('focusout', () => { listHot = null; paint(); showTip(null); });

  /* 提示卡 / 手机底部卡 */
  const tip = document.getElementById('work-tip');
  const sheet = document.getElementById('work-sheet');
  function showTip(w) {
    if (!w || app.state.mapMix < .4) { tip.classList.remove('on'); tip.dataset.id = ''; return; }
    if (tip.dataset.id !== w.id) {
      tip.dataset.id = w.id;
      tip.innerHTML = `<b>${w.t}</b><span>${w.d}</span><i>点击打开 ↗</i>`;
    }
    const [sx, sy] = cam.toScreen(w.cell.x * P, w.cell.y * P);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.transform = `translate3d(${Math.min(innerWidth - tw - 14, Math.max(14, sx - tw / 2))}px,${Math.max(14, sy - th - 34)}px,0)`;
    tip.classList.add('on');
  }
  function openSheet(w) {
    sheet.querySelector('b').textContent = w.t;
    sheet.querySelector('p').textContent = w.d;
    sheet.querySelector('a').href = w.u;
    sheet.classList.add('on');
    sheet.removeAttribute('inert');
    sheetOpen = true;
    hover = w; paint();
  }
  function closeSheet() {
    sheet.classList.remove('on');
    sheet.setAttribute('inert', '');
    sheetOpen = false; hover = null; paint();
  }
  sheet.querySelector('button').addEventListener('click', closeSheet);

  const cellAt = (cx, cy) => {
    const [wx, wy] = cam.toWorld(cx, cy);
    return byCell.get(Math.floor((wx + .5 * P) / P) + ',' + Math.floor((wy + .5 * P) / P)) || null;
  };

  return {
    frame(dt, pointer, y) {
      const i = cam.names.indexOf('wafer');
      const near = Math.abs(y - cam.stops[i]) / cam.vh;
      const want = near < .85 ? 1 : 0;
      const st = app.state;
      st.mapMix += (want - st.mapMix) * (app.reduce ? 1 : 1 - Math.exp(-dt * 5));
      if (st.mapMix < .4) {
        if (hover || tip.classList.contains('on')) { hover = null; paint(); showTip(null); }
        if (sheetOpen) closeSheet();
        return;
      }
      if (app.coarse || listHot) { if (listHot) showTip(listHot); return; }
      const w = pointer.on ? cellAt(pointer.x, pointer.y) : null;
      const ok = w && (filter === 'all' || w.c === filter) ? w : null;
      if (ok !== hover) { hover = ok; paint(); }
      showTip(hover);
      document.documentElement.classList.toggle('has-hover', !!hover || document.documentElement.classList.contains('has-hover'));
    },
    click(e) {
      if (app.state.mapMix < .4) return false;
      const w = cellAt(e.clientX, e.clientY);
      if (!w || !(filter === 'all' || w.c === filter)) { if (sheetOpen) closeSheet(); return false; }
      if (app.coarse) openSheet(w);
      else window.open(w.u, '_blank', 'noopener');
      return true;
    },
  };
}
