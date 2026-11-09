// 相机：滚动决定镜头停在哪，镜头本身带阻尼追过去。
import { WAFER } from './gl.js';
import { BLOCKS } from './die-gen.js';

const FOV = 26 * Math.PI / 180;
export const F = 1 / Math.tan(FOV / 2);
const { D } = WAFER;

export function blockCenter(id) {
  const [x0, y0, x1, y1] = BLOCKS.find((b) => b.id === id).rect;
  return [((x0 + x1) / 200 - .5) * D, (.5 - (y0 + y1) / 200) * D];
}
export function blockSize(id) {
  const [x0, y0, x1, y1] = BLOCKS.find((b) => b.id === id).rect;
  return [(x1 - x0) / 100 * D, (y1 - y0) / 100 * D];
}

// 每一幕的镜头。portrait 时主体放到屏幕上半部分。
export function shot(name, vw, vh) {
  const land = vw / vh > 1.05, aspect = vw / vh;
  if (name === 'hero') {
    return land
      ? { x: -.98, y: .2, h: 1.6, tilt: .98, yaw: .5, sway: 1, dof: 1 }
      // 竖屏越宽，大字越高，晶圆要让得越多，名字才不被压住
      : { x: 0, y: .02 + Math.min(.42, Math.max(0, (aspect - .47) * 1.5)), h: 2.5, tilt: .78, yaw: .5, sway: 1, dof: 1 };
  }
  if (name === 'die') {
    const h = D * (land ? 1.24 : 1.04 / Math.min(aspect, 1));
    return land ? { x: -D * .46, y: 0, h, tilt: 0, yaw: 0, sway: 0, dof: 0 }
      : { x: 0, y: -D * .34, h: h * 1.1, tilt: 0, yaw: 0, sway: 0, dof: 0 };
  }
  if (name === 'wafer') {
    // 横屏时把整张晶圆推到文字栏右边，不压字
    return land ? { x: Math.min(-.42, aspect * .351 - 1.04), y: 0, h: 2.34, tilt: 0, yaw: 0, sway: 0, dof: 0 }
      : { x: 0, y: -.56, h: 2.1 / Math.min(aspect, 1), tilt: 0, yaw: 0, sway: 0, dof: 0 };
  }
  if (name === 'io') {
    return land ? { x: D * .2, y: -D * .47, h: D * .36, tilt: .55, yaw: -.18, sway: 0, dof: 1 }
      : { x: 0, y: -D * .5, h: D * .5, tilt: .5, yaw: -.1, sway: 0, dof: 1 };
  }
  const [cx, cy] = blockCenter(name);
  const [bw, bh] = blockSize(name);
  // 横屏：模块在屏幕右侧 66% 处，面板钉在它上面，左边留给文字
  if (land) {
    const h = Math.max(bh * 1.3, bw / (aspect * .6) * 1.1);
    return { x: cx - h * aspect * .16, y: cy - (name === 'cache' ? h * .1 : 0), h, tilt: 0, yaw: 0, sway: 0, dof: 0 };
  }
  // 竖屏：模块露在屏幕上半部分，内容从下面滚上来
  const h = Math.max(bh * 1.4, bw * 1.2 / aspect) * 1.5;
  return { x: cx, y: cy - h * .24, h, tilt: 0, yaw: 0, sway: 0, dof: 0 };
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export class Camera {
  constructor(names) {
    this.names = names;
    this.cur = null;
    this.stops = [];
    this.vw = this.vh = 1;
  }

  // stops 是每一幕的「镜头到位」时对应的 scrollY
  layout(vw, vh, stops) {
    this.vw = vw; this.vh = vh; this.stops = stops;
    this.shots = this.names.map((n) => shot(n, vw, vh));
    if (!this.cur) this.cur = { ...this.shots[0], lh: Math.log(this.shots[0].h) };
  }

  targetAt(y) {
    const st = this.stops, n = st.length;
    if (y <= st[0]) return { ...this.shots[0] };
    if (y >= st[n - 1]) return { ...this.shots[n - 1] };
    let i = 0;
    while (i < n - 2 && y > st[i + 1]) i++;
    const raw = (y - st[i]) / Math.max(1, st[i + 1] - st[i]);
    // 读字的时候镜头停住，翻到下一幕才动
    const hold = .28;
    const s = smooth(Math.min(1, Math.max(0, (raw - hold) / (1 - 2 * hold))));
    const a = this.shots[i], b = this.shots[i + 1];
    const out = {};
    for (const k of ['x', 'y', 'tilt', 'yaw', 'sway', 'dof']) out[k] = lerp(a[k], b[k], s);
    // 跨模块时先拉远一点再推近，像地图的飞行动画
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const rise = Math.min(1, dist / Math.max(a.h, b.h)) * .45;
    out.h = Math.exp(lerp(Math.log(a.h), Math.log(b.h), s)) * (1 + Math.sin(Math.PI * s) * rise);
    return out;
  }

  // 用 instant 跳过阻尼：减弱动态时直接到位
  step(y, dt, t, instant, parallax) {
    const g = this.targetAt(y);
    const k = instant ? 1 : 1 - Math.exp(-dt * 5.5);
    const c = this.cur;
    for (const n of ['x', 'y', 'tilt', 'yaw', 'sway', 'dof']) c[n] = lerp(c[n], g[n], k);
    c.lh = lerp(c.lh, Math.log(g.h), k);
    c.h = Math.exp(c.lh);
    const sway = c.sway * (instant ? 0 : Math.sin(t * .05) * .1);
    const yaw = c.yaw + sway;
    const px = parallax ? parallax[0] * c.h * .018 : 0, py = parallax ? parallax[1] * c.h * .018 : 0;

    const ct = Math.cos(c.tilt), st = Math.sin(c.tilt), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const right = [cy, sy, 0];
    const up = [-sy * ct, cy * ct, st];
    const back = [sy * st, -cy * st, ct];
    const d = (c.h / 2) * F;
    const target = [c.x + px, c.y + py, 0];
    const pos = [target[0] + back[0] * d, target[1] + back[1] * d, back[2] * d];
    this.frame = { pos, right, up, back, target, f: F, dof: c.dof, h: c.h };
    return this.frame;
  }

  // 屏幕 CSS 坐标 → 晶圆平面
  toWorld(cssX, cssY) {
    const { pos, right, up, back, f } = this.frame;
    const px = (cssX - this.vw / 2) / (this.vh / 2), py = -(cssY - this.vh / 2) / (this.vh / 2);
    const dx = right[0] * px + up[0] * py - back[0] * f;
    const dy = right[1] * px + up[1] * py - back[1] * f;
    const dz = right[2] * px + up[2] * py - back[2] * f;
    const t = -pos[2] / dz;
    return [pos[0] + dx * t, pos[1] + dy * t];
  }

  // 晶圆平面 → 屏幕 CSS 坐标
  toScreen(wx, wy) {
    const { pos, right, up, back, f } = this.frame;
    const vx = wx - pos[0], vy = wy - pos[1], vz = -pos[2];
    const cx = vx * right[0] + vy * right[1] + vz * right[2];
    const cy = vx * up[0] + vy * up[1] + vz * up[2];
    const cz = vx * back[0] + vy * back[1] + vz * back[2];
    const k = f / -cz;
    return [cx * k * (this.vh / 2) + this.vw / 2, -cy * k * (this.vh / 2) + this.vh / 2];
  }
}

export function pickBlock(wx, wy) {
  if (Math.abs(wx) > D / 2 || Math.abs(wy) > D / 2) return -1;
  const u = (wx / D + .5) * 100, v = (.5 - wy / D) * 100;
  return BLOCKS.findIndex((b) => u > b.rect[0] && u < b.rect[2] && v > b.rect[1] && v < b.rect[3]);
}
