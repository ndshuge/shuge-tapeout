export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// clientWidth 不受面板 scale 影响，所以画布尺寸不会跟着镜头抖
export function fit(c, max = 1.75) {
  const d = Math.min(devicePixelRatio || 1, max), w = Math.max(2, c.clientWidth), h = Math.max(2, c.clientHeight);
  const W = Math.round(w * d), H = Math.round(h * d);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  return { w, h, d };
}

export function localXY(e, el) {
  const r = el.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * el.clientWidth, (e.clientY - r.top) / r.height * el.clientHeight];
}

// 一大片格子只占一个 Tab 位，方向键在里面走
export function roving(box, selector, cols) {
  const items = [...box.querySelectorAll(selector)];
  items.forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
  box.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    const c = typeof cols === 'function' ? cols() : cols;
    const m = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: c, ArrowUp: -c }[e.key];
    if (!m) return;
    e.preventDefault();
    const n = items[i + m];
    if (n) { items[i].tabIndex = -1; n.tabIndex = 0; n.focus(); }
  });
}

export function drawMouse(x, px, py, ang, t, s = 1, body = '#ece5d6') {
  x.save();
  x.translate(px, py); x.rotate(ang); x.scale(s, s);
  x.strokeStyle = '#dca88d'; x.lineWidth = 1.7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-10, 0);
  for (let i = 1; i <= 7; i++) x.lineTo(-10 - i * 3, Math.sin(t * 13 + i * .9) * i * .55);
  x.stroke();
  x.fillStyle = body;
  x.beginPath(); x.ellipse(-2, 0, 10, 6, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(8, 0, 5.5, 4, 0, 0, 7); x.fill();
  x.fillStyle = '#efb8a4';
  x.beginPath(); x.arc(5, -4.6, 2.8, 0, 7); x.arc(5, 4.6, 2.8, 0, 7); x.fill();
  x.fillStyle = '#16100c';
  x.beginPath(); x.arc(9.5, -1.8, .8, 0, 7); x.arc(9.5, 1.8, .8, 0, 7); x.fill();
  x.fillStyle = '#e8728a';
  x.beginPath(); x.arc(13.4, 0, 1.1, 0, 7); x.fill();
  x.restore();
}
