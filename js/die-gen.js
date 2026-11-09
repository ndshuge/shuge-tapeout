// 芯片版图生成器：不下载任何贴图，打开页面时用种子现算一张完整版图。
// 四个通道分别是：R 顶层金属，G 横向走线，B 纵向走线，A 器件层。
// G、B 的取值大于 128 时，低位存的是这根线自己的相位，电流动画靠它错开。

export const BLOCKS = [
  { id: 'boot',   name: 'Boot ROM',  cn: '学校',   rect: [ 7,  7, 21, 31], film: 1.10, pitch: 2.6, ang: 0, kind: 'rom'    },
  { id: 'agent',  name: 'Agent 核心', cn: '智能体', rect: [23,  7, 50, 31], film: 1.72, pitch: 2.1, ang: 1, kind: 'cpu'    },
  { id: 'npu',    name: '协处理器',   cn: '学习',   rect: [52,  7, 75, 31], film: 2.25, pitch: 3.4, ang: 0, kind: 'npu'    },
  { id: 'analog', name: '模拟电路',   cn: '乐队',   rect: [77,  7, 93, 36], film: 0.86, pitch: 1.5, ang: 1, kind: 'analog' },
  { id: 'gpu',    name: '图形阵列',   cn: '造世界', rect: [ 7, 33, 44, 66], film: 2.70, pitch: 2.9, ang: 1, kind: 'gpu'    },
  { id: 'cache',  name: '缓存',       cn: '署名',   rect: [46, 33, 75, 56], film: 1.42, pitch: 4.4, ang: 0, kind: 'sram'   },
  { id: 'life',   name: '可编程阵列', cn: '数字生命', rect: [46, 58, 75, 93], film: 3.15, pitch: 2.4, ang: 1, kind: 'fabric' },
  { id: 'robot',  name: '执行器',     cn: '机器人', rect: [ 7, 68, 25, 93], film: 2.02, pitch: 1.9, ang: 0, kind: 'bridge' },
  { id: 'stage',  name: '时钟环',     cn: '话剧',   rect: [27, 68, 44, 93], film: 0.62, pitch: 1.3, ang: 0, kind: 'rings'  },
  { id: 'pmu',    name: '电源管理',   cn: '赛艇',   rect: [77, 38, 93, 93], film: 2.46, pitch: 3.0, ang: 1, kind: 'power'  },
];

function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 《饮水思源》的 UTF-8 字节，真的被写进 Boot ROM 的接触孔里。
const ROM_BYTES = Array.from(new TextEncoder().encode('饮水思源1896'));

export function generateDie(N, { glyphs } = {}) {
  const d = new Uint8Array(N * N * 4);
  const R = 0, G = 1, B = 2, A = 3;
  const s = Math.max(1, Math.round(N / 2048));
  const rand = rng32(0x1896_2026);
  const pct = (v) => Math.round((v / 100) * N);

  const rect = (ch, x0, y0, x1, y1, v) => {
    x0 = Math.max(0, x0 | 0); y0 = Math.max(0, y0 | 0);
    x1 = Math.min(N, x1 | 0); y1 = Math.min(N, y1 | 0);
    for (let y = y0; y < y1; y++) {
      let i = (y * N + x0) * 4 + ch;
      for (let x = x0; x < x1; x++, i += 4) d[i] = v;
    }
  };
  const wireV = () => 128 + ((rand() * 127) | 0);

  const stamp = (ch, cx, cy, r, v) => rect(ch, cx - r, cy - r, cx + r + 1, cy + r + 1, v);
  const line = (ch, x0, y0, x1, y1, r, v) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    for (let i = 0; i <= n; i += Math.max(1, r >> 1)) {
      const t = n ? i / n : 0;
      stamp(ch, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, v);
    }
  };

  // 空白区域的金属填充，真实版图为了 CMP 平整度都有这层。
  const dummy = (x0, y0, x1, y1, p = 11 * s, v = 44) => {
    for (let y = y0; y < y1; y += p) for (let x = x0 + ((y / p) & 1) * (p >> 1); x < x1; x += p) rect(A, x, y, x + p * .55, y + p * .55, v);
  };

  const hTracks = (x0, y0, x1, y1, pitch, density, minL, maxL) => {
    for (let y = y0; y < y1; y += pitch) {
      let x = x0 + rand() * maxL * .3;
      while (x < x1) {
        const l = minL + rand() * (maxL - minL);
        if (rand() < density) rect(G, x, y, Math.min(x + l, x1), y + Math.max(1, s), wireV());
        x += l + (2 + rand() * 12) * s;
      }
    }
  };
  const vTracks = (x0, y0, x1, y1, pitch, density, minL, maxL) => {
    for (let x = x0; x < x1; x += pitch) {
      let y = y0 + rand() * maxL * .3;
      while (y < y1) {
        const l = minL + rand() * (maxL - minL);
        if (rand() < density) rect(B, x, y, x + Math.max(1, s), Math.min(y + l, y1), wireV());
        y += l + (2 + rand() * 12) * s;
      }
    }
  };

  const logic = (x0, y0, x1, y1, density = .8) => {
    const row = 13 * s;
    for (let y = y0; y + row <= y1; y += row) {
      let x = x0;
      const rv = 70 + rand() * 90;
      while (x < x1) {
        const w = (3 + (rand() ** 1.8) * 22) * s | 0;
        if (rand() < .93) {
          const v = rv + rand() * 60;
          rect(A, x, y + s, Math.min(x + w - s, x1), y + row - s, v);
          for (let k = x + 2 * s; k < x + w - 2 * s && k < x1; k += 3 * s) rect(A, k, y + 2 * s, k + s, y + row - 2 * s, Math.min(255, v + 70));
        }
        x += w;
      }
    }
    hTracks(x0, y0 + 2 * s, x1, y1, 5 * s, density, 14 * s, 240 * s);
    vTracks(x0 + s, y0, x1, y1, 5 * s, density, 14 * s, 200 * s);
  };

  const sram = (x0, y0, x1, y1, nx, ny) => {
    const bw = (x1 - x0) / nx, bh = (y1 - y0) / ny;
    const gut = 9 * s;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const ax = (x0 + i * bw + gut) | 0, ay = (y0 + j * bh + gut) | 0;
      const bx = (x0 + (i + 1) * bw - gut) | 0, by = (y0 + (j + 1) * bh - gut) | 0;
      const px = 3 * s, py = 4 * s;
      for (let y = ay; y < by; y++) {
        let k = (y * N + ax) * 4 + A;
        const yy = (y - ay) % py;
        for (let x = ax; x < bx; x++, k += 4) {
          const xx = (x - ax) % px;
          d[k] = yy < py - s && xx < px - s ? 205 : 60;
        }
      }
      for (let y = ay; y < by; y += 6 * s) rect(G, ax, y, bx, y + s, wireV());
      for (let x = ax; x < bx; x += 4 * s) rect(B, x, ay, x + s, by, wireV());
      rect(A, ax, by, bx, by + gut - 3 * s, 135);
      rect(A, bx, ay, bx + gut - 3 * s, by, 110);
      vTracks(bx, ay, bx + gut - 2 * s, by, 3 * s, .9, 40 * s, 200 * s);
      hTracks(ax, by + s, bx, by + gut - 2 * s, 3 * s, .9, 40 * s, 200 * s);
    }
  };

  // 把一块小区域精确复制成阵列。流片里相同的核就是这样重复摆放的。
  const tile = (x0, y0, x1, y1, nx, ny, draw) => {
    const tw = ((x1 - x0) / nx) | 0, th = ((y1 - y0) / ny) | 0;
    draw(x0, y0, x0 + tw - 6 * s, y0 + th - 6 * s);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (!i && !j) continue;
      for (let y = 0; y < th; y++) {
        const dy = y0 + j * th + y, sy = y0 + y;
        if (dy >= N) continue;
        const dst = (dy * N + x0 + i * tw) * 4, src = (sy * N + x0) * 4;
        d.copyWithin(dst, src, src + tw * 4);
      }
    }
  };

  const kinds = {
    cpu(x0, y0, x1, y1) {
      tile(x0, y0, x1, y1, 2, 1, (a, b, c, e) => {
        const midY = b + (e - b) * .62;
        logic(a, b, c, midY, .88);
        sram(a, midY, a + (c - a) * .55, e, 3, 2);
        logic(a + (c - a) * .55, midY, c, e, .7);
      });
    },
    npu(x0, y0, x1, y1) {
      tile(x0, y0, x1, y1, 10, 8, (a, b, c, e) => {
        const midX = a + (c - a) * .5;
        sram(a, b, midX, e, 1, 1);
        logic(midX + s, b, c, e, .9);
      });
    },
    gpu(x0, y0, x1, y1) {
      tile(x0, y0, x1, y1, 6, 4, (a, b, c, e) => {
        const midY = b + (e - b) * .2;
        sram(a, b, c, midY, 4, 1);
        tile(a, midY, c, e, 3, 2, (p, q, r, t) => logic(p, q, r, t, .86));
      });
    },
    sram(x0, y0, x1, y1) { sram(x0, y0, x1, y1, 7, 4); },
    fabric(x0, y0, x1, y1) {
      tile(x0, y0, x1, y1, 26, 32, (a, b, c, e) => {
        const w = c - a, h = e - b;
        logic(a, b, a + w * .62, b + h * .62, .92);
        for (let y = b + 2 * s; y < e; y += 3 * s) rect(G, a + w * .62, y, c + 5 * s, y + s, wireV());
        for (let x = a + 2 * s; x < c; x += 3 * s) rect(B, x, b + h * .62, x + s, e + 5 * s, wireV());
        rect(A, a + w * .66, b + h * .66, c - 2 * s, e - 2 * s, 220);
      });
    },
    rom(x0, y0, x1, y1) {
      const cx = 5 * s, cy = 6 * s, bits = ROM_BYTES.length * 8;
      let row = 0;
      for (let y = y0 + 6 * s; y < y1 - 6 * s; y += cy, row++) {
        rect(G, x0, y + cy - 2 * s, x1, y + cy - s, wireV());
        for (let x = x0 + 4 * s, c = 0; x < x1 - 4 * s; x += cx, c++) {
          const n = (c + row * 13) % bits;
          const on = (ROM_BYTES[n >> 3] >> (7 - (n & 7))) & 1;
          if (on) rect(A, x, y, x + 3 * s, y + 3 * s, 250); else rect(A, x, y, x + 3 * s, y + 3 * s, 42);
          if (row === 0) rect(B, x + s, y0, x + 2 * s, y1, wireV());
        }
      }
    },
    analog(x0, y0, x1, y1) {
      dummy(x0, y0, x1, y1, 9 * s, 40);
      const w = x1 - x0, h = y1 - y0;
      const spiral = (cx, cy, r0, turns, rw) => {
        let r = r0;
        for (let i = 0; i < turns * 8; i++) {
          const a0 = Math.PI * (i / 4 + 1 / 8), a1 = Math.PI * ((i + 1) / 4 + 1 / 8);
          const r1 = r0 - (i + 1) * rw * 2.9 / 8;
          line(R, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1, rw, 245);
          r = r1;
        }
      };
      const rw = 5 * s;
      [[.3, .17], [.72, .17], [.3, .5], [.72, .5]].forEach(([u, v], i) => {
        const cx = x0 + w * u, cy = y0 + h * v;
        const rr = Math.min(w * .23, h * .16);
        rect(A, cx - rr * 1.2, cy - rr * 1.2, cx + rr * 1.2, cy + rr * 1.2, 16);
        rect(B, cx - rr * 1.2, cy - rr * 1.2, cx + rr * 1.2, cy + rr * 1.2, 0);
        spiral(cx, cy, rr, i % 2 ? 4 : 3, rw);
      });
      const capY = y0 + h * .72;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
        const ax = x0 + w * .06 + i * w * .23, ay = capY + j * h * .085;
        rect(A, ax, ay, ax + w * .19, ay + h * .07, 188);
        for (let k = 6 * s; k < w * .19; k += 7 * s) rect(R, ax + k, ay + 3 * s, ax + k + 3 * s, ay + h * .07 - 3 * s, 170);
      }
    },
    power(x0, y0, x1, y1) {
      const n = 6, h = (y1 - y0) / n;
      for (let j = 0; j < n; j++) {
        const ay = y0 + j * h + 6 * s, by = y0 + (j + 1) * h - 6 * s;
        for (let x = x0, f = 0; x < x1; x += 7 * s, f++) {
          rect(A, x, ay, x + 4 * s, by, f % 2 ? 235 : 150);
          rect(B, x + s, ay, x + 2 * s, by, wireV());
        }
        rect(R, x0, ay, x1, ay + 13 * s, 250);
        rect(R, x0, by - 13 * s, x1, by, 200);
        for (let x = x0 + 10 * s; x < x1; x += 28 * s) rect(R, x, ay, x + 7 * s, by, 140);
      }
    },
    bridge(x0, y0, x1, y1) {
      tile(x0, y0, x1, y1, 2, 3, (a, b, c, e) => {
        const w = c - a, h = e - b;
        logic(a, b, c, b + h * .3, .8);
        for (let q = 0; q < 4; q++) {
          const qx = a + (q % 2) * w * .5 + 3 * s, qy = b + h * .32 + (q >> 1) * h * .34;
          for (let i = 0; i < w * .46; i += 6 * s) {
            rect(A, qx + i, qy, qx + i + 4 * s, qy + h * .3, q % 3 ? 225 : 150);
            rect(G, qx, qy + i % (h * .3), qx + w * .46, qy + i % (h * .3) + s, wireV());
          }
          rect(R, qx, qy + h * .13, qx + w * .46, qy + h * .17, 240);
        }
      });
    },
    rings(x0, y0, x1, y1) {
      dummy(x0, y0, x1, y1, 8 * s, 38);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rmax = Math.min(x1 - x0, y1 - y0) * .47;
      for (let r = rmax, k = 0; r > rmax * .1; r -= 11 * s, k++) {
        const ch = k % 3 === 0 ? R : k % 3 === 1 ? G : B;
        const v = ch === R ? 225 : wireV();
        const steps = (r * 6.3 / Math.max(1, s)) | 0;
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          if (k % 2 && Math.sin(a * 24 + k) > .86) continue;
          stamp(ch, cx + Math.cos(a) * r, cy + Math.sin(a) * r, ch === R ? 3 * s : s, v);
        }
      }
    },
  };

  // 底：整片硅面的填充
  dummy(0, 0, N, N, 10 * s, 26);

  // 模块
  for (const b of BLOCKS) {
    const [px0, py0, px1, py1] = b.rect;
    const x0 = pct(px0), y0 = pct(py0), x1 = pct(px1), y1 = pct(py1);
    rect(A, x0, y0, x1, y1, 22); rect(G, x0, y0, x1, y1, 0); rect(B, x0, y0, x1, y1, 0);
    kinds[b.kind](x0, y0, x1, y1);
  }

  // 模块之间的总线
  const busH = (y, x0, x1, n) => {
    for (let i = 0; i < n; i++) rect(G, pct(x0), pct(y) + i * 4 * s, pct(x1), pct(y) + i * 4 * s + 2 * s, wireV());
  };
  const busV = (x, y0, y1, n) => {
    for (let i = 0; i < n; i++) rect(B, pct(x) + i * 4 * s, pct(y0), pct(x) + i * 4 * s + 2 * s, pct(y1), wireV());
  };
  busH(31.6, 6, 94, 22); busH(66.6, 6, 45, 18); busH(56.8, 46, 76, 18); busH(36.6, 77, 94, 10);
  busV(21.6, 6, 33, 16); busV(44.8, 7, 94, 22); busV(75.8, 7, 94, 22); busV(50.8, 7, 32, 12); busV(25.8, 67, 94, 12);

  // 整片的电源网格
  for (let i = 3; i < 98; i += 3) {
    rect(R, pct(i), pct(6), pct(i) + 2 * s, pct(94), 34);
    rect(R, pct(6), pct(i), pct(94), pct(i) + 2 * s, 34);
  }

  // 划片道、密封环、焊盘
  const seal = pct(1.4), w0 = 7 * s;
  rect(R, seal, seal, N - seal, seal + w0, 255); rect(R, seal, N - seal - w0, N - seal, N - seal, 255);
  rect(R, seal, seal, seal + w0, N - seal, 255); rect(R, N - seal - w0, seal, N - seal, N - seal, 255);
  const pads = 34, pw = pct(1.65), ph = pct(2.5), mg = pct(2.4), span = N - 2 * pct(6.5);
  for (let i = 0; i < pads; i++) {
    const t = pct(6.5) + (i + .5) * (span / pads) - pw / 2;
    for (const [px, py, w, h] of [[t, mg, pw, ph], [t, N - mg - ph, pw, ph], [mg, t, ph, pw], [N - mg - ph, t, ph, pw]]) {
      rect(R, px, py, px + w, py + h, 255);
      rect(A, px - 4 * s, py - 4 * s, px + w + 4 * s, py + h + 4 * s, 200);
      rect(G, px, py, px + w, py + h, 0); rect(B, px, py, px + w, py + h, 0);
    }
  }

  // 顶层金属上的署名
  const [cx0, cy0, cx1, cy1] = BLOCKS.find((b) => b.id === 'cache').rect;
  const cache = { x0: pct(cx0), y0: pct(cy0), x1: pct(cx1), y1: pct(cy1), s };
  const W = cache.x1 - cache.x0, H = cache.y1 - cache.y0;
  cache.backup = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const k = ((y + cache.y0) * N + cache.x0) * 4;
    cache.backup.set(d.subarray(k, k + W * 4), y * W * 4);
  }
  const die = { data: d, size: N, cache };
  if (glyphs) stampCache(die, glyphs.text, glyphs.family);
  return die;
}

// 真实芯片的 die art：一块平平的金属盖板下面藏着一只小鼠，掀开金属才看得见。
const MOUSE = [
  '....##..............',
  '...####......###....',
  '...####.....#####...',
  '....##.##########...',
  '.....#############..',
  '...################.',
  '..#####.##########..',
  '..#################.',
  '...################.',
  '.....###########...#',
  '......##.....##...##',
];
export const MOUSE_AT = { u: .714, v: .538 };

function stampMouse(d, N, cx, cy, p) {
  const w = MOUSE[0].length * p, h = MOUSE.length * p;
  const X = (cx - w / 2) | 0, Y = (cy - h / 2) | 0;
  for (let y = -2 * p; y < h + 2 * p; y++) for (let x = -2 * p; x < w + 2 * p; x++) {
    const k = ((y + Y) * N + x + X) * 4;
    d[k] = 255; d[k + 1] = 0; d[k + 2] = 0; d[k + 3] = 10;
  }
  MOUSE.forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== '#') return;
    for (let y = 0; y < p; y++) for (let x = 0; x < p; x++) {
      d[((Y + j * p + y) * N + X + i * p + x) * 4 + 3] = 255;
    }
  }));
}

// 恢复这一块，再把字刻上去。返回改动范围，渲染器只重传这一块。
export function stampCache(die, text, family) {
  const { x0, y0, x1, y1, s, backup } = die.cache, N = die.size, d = die.data;
  const W = x1 - x0, H = y1 - y0;
  for (let y = 0; y < H; y++) d.set(backup.subarray(y * W * 4, (y + 1) * W * 4), ((y + y0) * N + x0) * 4);
  stampGlyphs(d, N, text, family, x0, y0, W, H, s);
  // 小鼠要整只落进显微镜的视野里，所以做得比盖板印象中小很多
  stampMouse(d, N, Math.round(MOUSE_AT.u * N), Math.round(MOUSE_AT.v * N), Math.max(1, Math.round(3 * s)));
  return { x: x0, y: y0, w: W, h: H };
}

function stampGlyphs(d, N, text, family, x0, y0, W, H, s) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `100px ${family}`;
  const size = Math.min(H * .92, 100 * W * .9 / Math.max(1, ctx.measureText(text).width));
  ctx.font = `${size}px ${family}`;
  ctx.fillText(text, W / 2, H * .5 + size * .03);
  const pix = ctx.getImageData(0, 0, W, H).data;

  // 字形四周挖一圈空地，再把字本身铺成顶层金属。
  const on = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) on[i] = pix[i * 4] > 128 ? 1 : 0;
  const halo = dilate(on, W, H, 10 * s);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, k = ((y + y0) * N + x + x0) * 4;
    if (halo[i]) { d[k] = 0; d[k + 1] = 0; d[k + 2] = 0; d[k + 3] = 18; }
    if (on[i]) { d[k] = 255; d[k + 3] = ((x + y) % (10 * s)) < 7 * s ? 240 : 120; }
  }
}

// 可分离的方形膨胀，字再多也是线性时间。
function dilate(src, W, H, r) {
  const a = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let last = -1e9;
    for (let x = 0; x < W; x++) { if (src[y * W + x]) last = x; if (x - last <= r) a[y * W + x] = 1; }
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) { if (src[y * W + x]) last = x; if (last - x <= r) a[y * W + x] = 1; }
  }
  for (let x = 0; x < W; x++) {
    let last = -1e9;
    for (let y = 0; y < H; y++) { if (a[y * W + x]) last = y; if (y - last <= r) out[y * W + x] = 1; }
    last = 1e9;
    for (let y = H - 1; y >= 0; y--) { if (a[y * W + x]) last = y; if (last - y <= r) out[y * W + x] = 1; }
  }
  return out;
}
