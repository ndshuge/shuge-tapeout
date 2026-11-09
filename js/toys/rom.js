// Boot ROM：十六个字节，每一位都能翻。翻一位，字就变了。
import { roving } from './common.js';

const FACTORY = '饮水思源1896', N = 16;
const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
const HUES = ['#ffc46b', '#7fd6ff', '#ff9ec2', '#a5ef9a', '#c9a8ff', '#ffe08a', '#8ff0e0', '#ffb08a'];

function toBytes(txt) {
  const out = new Uint8Array(N);
  let n = 0;
  for (const ch of txt) {
    const b = enc.encode(ch);
    if (n + b.length > N) break;
    out.set(b, n); n += b.length;
  }
  return out;
}
function groups(bytes) {
  const g = new Array(N).fill(0);
  for (let i = 0, k = 0; i < N; k++) {
    const b = bytes[i];
    const len = b < 0x80 ? 1 : b >> 5 === 6 ? 2 : b >> 4 === 14 ? 3 : b >> 3 === 30 ? 4 : 1;
    for (let j = 0; j < len && i < N; j++, i++) g[i] = k;
  }
  return g;
}

export function mount(el, app) {
  el.innerHTML = `
  <div class="rom">
    <div class="rom-read"><span>ROM 现在读出来是</span><output class="rom-text"></output></div>
    <div class="rom-grid" role="group" aria-label="十六个字节的比特，用方向键移动"></div>
    <p class="rom-note">亮点是 1，暗点是 0。按理说 ROM 出厂就不能改，这里破例。</p>
    <form><input class="field" maxlength="16" placeholder="写点别的，最多十六个字节" aria-label="写入自己的文字"><button class="btn alt">写入</button><button class="btn alt" type="button" data-r>恢复出厂</button></form>
  </div>`;
  const grid = el.querySelector('.rom-grid'), out = el.querySelector('.rom-text'), note = el.querySelector('.rom-note');
  const form = el.querySelector('form'), input = el.querySelector('input');
  let bytes = toBytes(FACTORY), touched = false;

  const cells = [];
  for (let b = 0; b < N; b++) for (let i = 0; i < 8; i++) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'bit'; c.dataset.b = b; c.dataset.i = i;
    grid.append(c); cells.push(c);
  }
  roving(grid, '.bit', () => (app.docked ? 8 : 8));

  const bubble = document.createElement('span');
  bubble.className = 'bubble'; bubble.textContent = '点这一格';
  grid.append(bubble);
  const firstOn = () => cells.find((c, k) => k > 16 && c.classList.contains('on'));

  function read() {
    let end = N;
    while (end > 0 && bytes[end - 1] === 0) end--;
    return dec.decode(bytes.subarray(0, end));
  }
  function paint() {
    const g = groups(bytes);
    cells.forEach((c) => {
      const b = +c.dataset.b, i = +c.dataset.i, on = (bytes[b] >> (7 - i)) & 1;
      c.classList.toggle('on', !!on);
      c.style.setProperty('--g', HUES[g[b] % HUES.length]);
      c.setAttribute('aria-label', `第 ${b + 1} 字节第 ${i + 1} 位，${on ? 1 : 0}`);
    });
    out.textContent = read() || '（空）';
  }
  function placeBubble() {
    const t = firstOn();
    if (!t || touched) { bubble.remove(); return; }
    bubble.style.left = (t.offsetLeft + t.offsetWidth / 2) + 'px';
    bubble.style.top = (t.offsetTop - 36) + 'px';
    bubble.style.transform = 'translateX(-50%)';
    t.style.outline = '3px solid #fff';
  }

  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.bit');
    if (!c) return;
    const before = read();
    bytes[+c.dataset.b] ^= 1 << (7 - +c.dataset.i);
    paint();
    if (!touched) { touched = true; cells.forEach((x) => { x.style.outline = ''; }); bubble.remove(); }
    const now = read();
    note.textContent = now === before ? '这一位翻了，字面上还看不出来。' : `只翻了一位：“${before}”变成了“${now}”。`;
    app.pulse(.45);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    bytes = toBytes(v); paint();
    note.textContent = '写进去了。';
    app.pulse(.8);
  });
  el.querySelector('[data-r]').addEventListener('click', () => {
    bytes = toBytes(FACTORY); input.value = ''; paint();
    note.textContent = '已恢复出厂：饮水思源，1896。';
  });

  paint();
  return { resize: placeBubble, wake: placeBubble };
}
