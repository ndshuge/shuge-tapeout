// 真的世界：点开就在这块面板里运行，离开就卸载。
const G = 'https://ndshuge.github.io/';
const W = [
  { t: '鼠哥游戏厅', d: '16 款浏览器游戏：像素动作、物理沙盒、生存和节奏。', u: G + 'ndshuge-game/', i: 'img/games.webp' },
  { t: 'LUMEN SIEGE', d: '光核围城。有怪物、升级系统和自动化测试的像素生存游戏。', u: G + 'ndshuge-game/games/lumen-siege/', i: 'img/lumen.jpg' },
  { t: '木木金金棋', d: '筑墙找路的原创策略棋，带地图工坊和自己训练的 AI 对手。', u: G + 'oh-mumujinjin/', i: 'img/mumu.jpg' },
  { t: '3D 校园', d: '用 OpenStreetMap 轮廓搭起来的西交兴庆校区。', u: G + 'ndshuge-galaxy/little-works/xjtu-campus-3d/', i: 'img/campus.jpg' },
  { t: '鼠哥星系', d: '像素星空里的作品总入口，星系跃迁和键盘终端。', u: G + 'ndshuge-galaxy/', i: 'img/galaxy.jpg' },
  { t: '山河为证', d: '把长征路上的不同故事，重新放回地图和时间里。', u: 'https://github.com/ndshuge/shanhe-preview', i: 'img/shanhe.webp', ext: true },
];

export function mount(el) {
  el.innerHTML = `
  <div class="worlds">
    <div class="w-screen">
      <img alt="">
      <div class="w-info"><b></b><p></p><div class="w-act"><button type="button" class="btn lit" data-play>就在这里玩</button><a class="btn alt" target="_blank" rel="noopener">新窗口打开 ↗</a></div></div>
    </div>
    <div class="w-tabs" role="group" aria-label="选择一个世界">${W.map((w, i) => `<button type="button" class="w-tab" data-i="${i}" aria-pressed="${!i}">${w.t}</button>`).join('')}</div>
  </div>`;
  const screen = el.querySelector('.w-screen'), img = el.querySelector('img'), info = el.querySelector('.w-info');
  const title = info.querySelector('b'), desc = info.querySelector('p'), play = el.querySelector('[data-play]'), link = info.querySelector('a');
  const tabs = [...el.querySelectorAll('.w-tab')];
  let cur = 0, frame = null, closeBtn = null;

  function unload() {
    frame?.remove(); closeBtn?.remove(); frame = closeBtn = null;
    info.hidden = false; img.hidden = false;
  }
  function show(i) {
    unload();
    cur = i;
    const w = W[i];
    img.src = w.i; title.textContent = w.t; desc.textContent = w.d; link.href = w.u;
    play.hidden = !!w.ext;
    link.classList.toggle('lit', !!w.ext);
    link.classList.toggle('alt', !w.ext);
    tabs.forEach((t, j) => t.setAttribute('aria-pressed', j === i));
  }
  function load() {
    const w = W[cur];
    frame = document.createElement('iframe');
    frame.src = w.u; frame.title = w.t;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-popups');
    frame.setAttribute('allow', 'autoplay; fullscreen');
    closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.className = 'w-close'; closeBtn.textContent = '×'; closeBtn.setAttribute('aria-label', '关闭这个世界');
    closeBtn.addEventListener('click', unload);
    screen.append(frame, closeBtn);
    info.hidden = true; img.hidden = true;
  }
  play.addEventListener('click', load);
  tabs.forEach((t) => t.addEventListener('click', () => show(+t.dataset.i)));
  show(0);
  return { sleep: unload };
}
