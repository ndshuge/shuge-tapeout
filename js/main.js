// 总调度：滚动驱动镜头，模块面板钉在硅片上跟着镜头飞。
import { generateDie, stampCache, BLOCKS, MOUSE_AT } from './die-gen.js';
import { Renderer, WAFER } from './gl.js';
import { Camera, pickBlock, blockCenter, blockSize } from './camera.js';
import { initWafer, initWorkList } from './wafer.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const canvas = document.getElementById('gl');
const sections = [...document.querySelectorAll('[data-shot]')];
const camera = new Camera(sections.map((s) => s.dataset.shot));

const state = {
  t: 0, power: reduce ? 1 : 0, boost: 0, gain: 1, mapMix: 0, hover: -1, focusCell: 0, titleA: 1, titleOff: [0, 0],
  cam: null, ptr: [0, 0, 0], lensPx: [-999, -999], lensR: 150, lens: 0,
};
const pointer = { x: innerWidth * .6, y: innerHeight * .45, on: false, lastMove: -9 };
const smoothP = { x: pointer.x, y: pointer.y };

let renderer = null, die = null, dpr = 1, quality = 1, docked = false, wafer = null, gainWant = 1, visitorStamped = false;

// 给各个小玩具用的接口
export const app = {
  state, camera, reduce, coarse,
  get renderer() { return renderer; },
  get docked() { return docked; },
  pulse(a = 1) { state.boost = Math.min(1.6, state.boost + a); },
  setGain(v) { gainWant = v; },
  ripple(x = 0, y = 0, amp = 1) { renderer?.ripple(x, y, state.t, amp); },
  toast,
  stamp(text, family) {
    if (!die) return;
    visitorStamped = family !== 'TapeoutDisplay';
    const r = stampCache(die, text, family);
    renderer.updateDie(die, r.x, r.y, r.w, r.h);
  },
  snapshot(name) {
    if (!renderer) return;
    renderer.render(state);
    canvas.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  },
};

/* ---------- 飞行导航 ---------- */
function go(id) {
  const i = sections.findIndex((s) => s.dataset.shot === id);
  if (i < 0) return;
  const top = docked ? camera.stops[i] : sections[i].offsetTop;
  scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('[data-go]');
  if (!a) return;
  e.preventDefault();
  go(a.dataset.go);
});

const NAV = BLOCKS.map((b) => ({ id: b.id, cn: b.cn, name: b.name, rect: b.rect }));
const floor = document.getElementById('map-fp');
const mapBox = document.getElementById('map');
const mapNow = document.getElementById('map-now');
NAV.forEach((b) => {
  const [x0, y0, x1, y1] = b.rect;
  const el = document.createElement('button');
  el.type = 'button'; el.dataset.go = b.id; el.title = b.cn;
  el.setAttribute('aria-label', `去看：${b.cn}`);
  el.style.cssText = `left:${x0}%;top:${y0}%;width:${x1 - x0}%;height:${y1 - y0}%`;
  el.innerHTML = `<span>${b.cn}</span>`;
  floor.append(el);
});
document.getElementById('map-toggle').addEventListener('click', () => mapBox.classList.toggle('open'));
floor.addEventListener('click', () => mapBox.classList.remove('open'));

const list = document.getElementById('block-list');
NAV.forEach((b) => {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'blk'; el.dataset.go = b.id;
  el.innerHTML = `<b>${b.cn}</b><span>${b.name}</span>`;
  el.addEventListener('pointerenter', () => { listHover = BLOCKS.indexOf(BLOCKS.find((x) => x.id === b.id)); });
  el.addEventListener('pointerleave', () => { listHover = -1; });
  el.addEventListener('focus', () => { listHover = BLOCKS.findIndex((x) => x.id === b.id); });
  el.addEventListener('blur', () => { listHover = -1; });
  list.append(el);
});
let listHover = -1;

const tip = document.getElementById('blk-tip');
const toastEl = document.getElementById('toast');
let toastT = 0;
function toast(msg, ms = 3200) {
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), ms);
}

/* ---------- 钉在硅片上的面板 ---------- */
const toys = [...document.querySelectorAll('.toy[data-toy]')].map((el) => {
  const sec = el.closest('[data-shot]');
  return { el, sec, name: el.dataset.toy, id: sec.dataset.shot, idx: sections.indexOf(sec), inst: null, loading: false, active: false, a: -1, w: 0, h: 0 };
});

function loadToy(T) {
  T.loading = true;
  import(`./toys/${T.name}.js`).then((m) => {
    T.inst = m.mount(T.el, app) || {};
    if (T.active) T.inst.wake?.();
    T.inst.resize?.();
  }).catch((err) => {
    console.error(T.name, err);
    T.el.innerHTML = '<p class="toy-err">这块模块没能加载。刷新一下试试。</p>';
  });
}

function updateToys(dt, t) {
  const vh = camera.vh;
  let strongest = 0;
  for (const T of toys) {
    const nearV = Math.abs(scrollY - camera.stops[T.idx]) / vh;
    if (!T.inst && !T.loading && nearV < 2.6) loadToy(T);
    let a = 0;
    if (docked) {
      const scale = camera.shots[T.idx].h / state.cam.h;
      a = Math.min(clamp((.46 - Math.abs(Math.log2(scale))) / .3), clamp((.92 - nearV) / .28));
      if (a > .003) {
        const [bx, by] = blockCenter(T.id), [, bh] = blockSize(T.id);
        const [sx, sy] = camera.toScreen(bx, by);
        let top = sy - T.h / 2;
        if (T.el.dataset.anchor === 'below') top = camera.toScreen(bx, by - bh / 2)[1] + 22 * scale - T.h * (1 - scale) / 2;
        T.el.style.transform = `translate3d(${(sx - T.w / 2).toFixed(1)}px,${top.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;
      }
      strongest = Math.max(strongest, a);
      if (Math.abs(a - T.a) > .004) {
        T.el.style.opacity = a.toFixed(3);
        T.el.style.visibility = a > .003 ? 'visible' : 'hidden';
        T.el.style.pointerEvents = a > .7 ? 'auto' : 'none';
        T.a = a;
      }
    } else {
      const r = T.el.getBoundingClientRect();
      a = r.bottom > -120 && r.top < innerHeight + 120 ? 1 : 0;
    }
    const on = a > .05;
    if (on !== T.active) {
      T.active = on;
      T.el.toggleAttribute('inert', !on);
      if (on) T.inst?.wake?.(); else T.inst?.sleep?.();
    }
    if (on) T.inst?.frame?.(dt, t);
  }
  return strongest;
}

/* ---------- 尺寸 ---------- */
let lastW = 0, lastH = 0;
function drawTitle() {
  const vw = canvas.clientWidth, vh = canvas.clientHeight, k = Math.min(devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = Math.round(vw * k); c.height = Math.round(vh * k);
  const x = c.getContext('2d');
  const land = vw / vh > 1.05;
  // 矮窗口里文案会顶上来，名字要给它让位
  const copyTop = document.querySelector('.hero-copy').offsetTop;
  const size = land ? Math.min(vw * .33, vh * .66, copyTop - vh * .1 - 12) : Math.min(vw * .46, vh * .3);
  x.fillStyle = '#fff'; x.textBaseline = 'top'; x.textAlign = 'left';
  x.font = `${size * k}px TapeoutDisplay`;
  x.fillText('鼠哥', (land ? vw * .035 : vw * .03) * k, (land ? vh * .1 : vh * .075) * k);
  renderer.setTitle(c);
}

function measure() {
  const vw = innerWidth, vh = canvas.clientHeight || innerHeight;
  docked = vw >= 900 && vw / vh > 1.05;
  root.classList.toggle('docked', docked);
  const tw = Math.min(vw * .55, 880), th = Math.min(vh * .76, 700);
  const panelTop = (vh - th) / 2;
  const stops = sections.map((s) => {
    const top = s.offsetTop, h = s.offsetHeight, col = s.querySelector('.col');
    if (!docked) {
      if (col) col.style.top = '';
      return Math.max(0, top + Math.min(h * .18, vh * .3));
    }
    if (!col) return top;
    // 文字栏粘住的这段滚动，正中间就是镜头到位的地方：标题和面板一起出现
    const cH = col.offsetHeight, cs = getComputedStyle(s);
    const stick = cH + panelTop + 20 <= vh ? panelTop : cH + 40 <= vh ? (vh - cH) / 2 : vh - cH - 20;
    col.style.top = stick + 'px';
    const from = top + parseFloat(cs.paddingTop) - stick, to = top + h - parseFloat(cs.paddingBottom) - cH - stick;
    return Math.max(0, (from + to) / 2);
  });
  stops[0] = 0;
  sections.forEach((s, i) => { s.dataset.stop = Math.round(stops[i]); });
  camera.layout(vw, vh, stops);
  for (const T of toys) {
    if (docked) {
      T.w = Math.min(tw, +T.el.dataset.w || tw); T.h = Math.min(th, +T.el.dataset.h || th);
      T.el.style.width = T.w + 'px'; T.el.style.height = T.h + 'px';
    } else {
      T.el.style.cssText = ''; T.a = -1;
    }
    T.inst?.resize?.();
  }
  dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75);
  renderer.resize(vw, vh, dpr * quality);
  if (vw !== lastW || vh !== lastH) { lastW = vw; lastH = vh; drawTitle(); }
}

let mTimer = 0;
function queueMeasure() { clearTimeout(mTimer); mTimer = setTimeout(measure, 140); }

/* ---------- 指针 ---------- */
function onPointer(e) {
  pointer.x = e.clientX; pointer.y = e.clientY;
  pointer.on = e.target === canvas;
  pointer.lastMove = state.t;
}
function clickCanvas(e) {
  if (e.target !== canvas) return;
  mapBox.classList.remove('open');
  if (wafer?.click(e)) return;
  const [wx, wy] = camera.toWorld(e.clientX, e.clientY);
  renderer.ripple(wx, wy, state.t, 1);
  if (inDie()) {
    const i = pickBlock(wx, wy);
    if (i >= 0) go(BLOCKS[i].id);
  }
}
function inDie() { return Math.abs(scrollY - camera.stops[1]) / camera.vh < .62; }

/* ---------- 每一帧 ---------- */
const MX = (MOUSE_AT.u - .5) * WAFER.D, MY = (.5 - MOUSE_AT.v) * WAFER.D;
let foundMouse = false, last = performance.now(), frames = 0, acc = 0, shownIdx = -1, scrimV = -1, mapOn = null;

function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  state.t += dt;
  state.power = reduce ? 1 : Math.min(1, state.power + dt / 2.4);
  state.boost *= Math.exp(-dt * 5.5);
  state.gain += (gainWant - state.gain) * (1 - Math.exp(-dt * 4));

  smoothP.x += (pointer.x - smoothP.x) * (1 - Math.exp(-dt * 14));
  smoothP.y += (pointer.y - smoothP.y) * (1 - Math.exp(-dt * 14));
  const vw = innerWidth, vh = camera.vh, y = scrollY;

  // 面板可操作的时候，镜头不跟指针晃，免得按钮在手底下移动
  const free = toys.every((T) => T.a < .4);
  const para = reduce || coarse || !free ? null : [(smoothP.x / vw - .5) * 2, -(smoothP.y / vh - .5) * 2];
  state.cam = camera.step(y, dt, state.t, reduce, para);
  const toyA = updateToys(dt, state.t);

  const [wx, wy] = camera.toWorld(smoothP.x, smoothP.y);
  const close = state.cam.h < .24;
  state.ptr = [wx, wy, (pointer.on ? 1.2 : 0) + .15];
  state.lensPx = [smoothP.x * (renderer.W / vw), (vh - smoothP.y) * (renderer.H / vh)];
  state.lensR = (coarse ? 92 : 150) * (renderer.W / vw);
  // 署名那一幕的面板很小，正文又叫人用显微镜找小鼠，所以这里也开着
  const inCache = sections[shownIdx]?.dataset.shot === 'cache';
  const wantLens = close && pointer.on && !coarse && state.cam.h < .2 && (toyA < .9 || inCache) ? 1 : 0;
  state.lens += (wantLens - state.lens) * (1 - Math.exp(-dt * 9));

  const canHover = inDie();
  const pick = canHover && pointer.on ? pickBlock(wx, wy) : -1;
  state.hover = pick >= 0 ? pick : (canHover ? listHover : -1);
  root.classList.toggle('has-hover', pick >= 0);
  if (pick >= 0) {
    tip.innerHTML = `<b>${BLOCKS[pick].cn}</b>${BLOCKS[pick].name}<i>点一下飞进去</i>`;
    tip.style.transform = `translate3d(${Math.min(vw - 220, pointer.x + 18)}px,${pointer.y + 18}px,0)`;
    tip.classList.add('on');
  } else tip.classList.remove('on');

  // 彩蛋：显微镜对准小鼠
  if (!foundMouse && state.lens > .8) {
    // 判定范围跟着镜头走：小鼠得真的落在显微镜的视野里
    const seen = Math.max(state.cam.h / vh * (state.lensR * vw / renderer.W) / 3.2 * .8, WAFER.D * .03);
    if (Math.hypot(wx - MX, wy - MY) < seen) {
      foundMouse = true;
      toast('被你发现了。这只小鼠藏在金属下面，掀开才看得见，就像真芯片上的涂鸦。', 5200);
    }
  }

  state.focusCell = 1 - smooth(.2, .62, state.cam.h);
  state.titleA = 1 - smooth(vh * .03, vh * .62, y);
  if (!reduce && !coarse) state.titleOff = [-(smoothP.x / vw - .5) * .012, (smoothP.y / vh - .5) * .012];

  const sc = Math.round(smooth(vh * .3, vh * .78, y) * 100) / 100;
  if (sc !== scrimV) { scrimV = sc; root.style.setProperty('--scrim', sc); }
  if ((y > vh * .5) !== mapOn) { mapOn = y > vh * .5; mapBox.classList.toggle('show', mapOn); }

  // 导航上标出当前模块
  let idx = 0, best = 1e12;
  camera.stops.forEach((s, i) => { const d = Math.abs(s - y); if (d < best) { best = d; idx = i; } });
  if (idx !== shownIdx) {
    shownIdx = idx;
    const id = sections[idx].dataset.shot;
    floor.querySelectorAll('button').forEach((b) => b.classList.toggle('now', b.dataset.go === id));
    const b = BLOCKS.find((x) => x.id === id);
    mapNow.textContent = b ? b.cn : ({ hero: '封面', die: '芯片', wafer: '晶圆', io: '联系' })[id];
  }

  wafer?.frame(dt, pointer, y);
  renderer.render(state);

  if (!reduce) {
    acc += dt; frames++;
    if (acc > 1.2) {
      const fps = frames / acc; acc = 0; frames = 0;
      const prev = quality;
      if (fps < 42) quality = Math.max(.5, quality - .14);
      else if (fps > 57) quality = Math.min(1, quality + .05);
      if (prev !== quality) renderer.resize(vw, vh, dpr * quality);
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- 没有 WebGL 时：内容照常可读，面板排在正文里 ---------- */
function fallback() {
  root.classList.add('gl-off');
  initWorkList();
  document.querySelectorAll('.toy').forEach((el) => { el.style.cssText = ''; });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const T = toys.find((x) => x.el === e.target);
    if (!T) return;
    T.active = e.isIntersecting;
    if (e.isIntersecting && !T.inst && !T.loading) loadToy(T);
    if (e.isIntersecting) T.inst?.wake?.(); else T.inst?.sleep?.();
  }), { rootMargin: '200px' });
  toys.forEach((T) => io.observe(T.el));
  let p = performance.now(), t = 0;
  const loop = (n) => {
    const dt = Math.min(.05, (n - p) / 1000); p = n; t += dt;
    toys.forEach((T) => { if (T.active) T.inst?.frame?.(dt, t); });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function boot() {
  try {
    const font = document.fonts.load('200px TapeoutDisplay', '鼠哥');
    await Promise.race([font, new Promise((r) => setTimeout(r, 2500))]);
    const fontLate = !document.fonts.check('200px TapeoutDisplay', '鼠哥');
    renderer = new Renderer(canvas, { tier: coarse ? 1 : 2 });
    const size = coarse ? 2048 : 4096;
    die = generateDie(size, { glyphs: { family: 'TapeoutDisplay', text: '鼠哥' } });
    renderer.setDie(die);
    measure();
    state.cam = camera.step(0, .016, 0, true, null);
    wafer = initWafer(app, go);
    // 网慢时先用系统字开场，字体到了再补刻一遍，但不盖掉访客已经刻上去的名字
    if (fontLate) font.then(() => { drawTitle(); if (!visitorStamped) app.stamp('鼠哥', 'TapeoutDisplay'); }).catch(() => {});
    addEventListener('resize', () => {
      // 手机地址栏伸缩只改高度，不值得重排
      if (coarse && innerWidth === lastW) return;
      queueMeasure();
    });
    addEventListener('pointermove', onPointer, { passive: true });
    addEventListener('pointerdown', (e) => { onPointer(e); clickCanvas(e); }, { passive: true });
    new ResizeObserver(queueMeasure).observe(document.querySelector('main'));
    root.classList.add('gl-on');
    requestAnimationFrame((n) => { last = n; tick(n); });
  } catch (err) {
    console.warn('降级显示：', err.message || err);
    fallback();
  }
}
boot();
