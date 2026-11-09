// 把访客的名字真的刻进版图贴图。文字只留在这个浏览器里。
export function mount(el, app) {
  el.innerHTML = `
  <form class="stamp">
    <div class="row"><input class="field" maxlength="8" autocomplete="off" placeholder="写你的名字" aria-label="你的名字"><button class="btn lit">刻上去</button></div>
    <div class="row"><button type="button" class="btn alt" data-save disabled>存成图片</button><button type="button" class="btn alt" data-back disabled>还给鼠哥</button></div>
  </form>`;
  const form = el.querySelector('form'), input = el.querySelector('input');
  const save = el.querySelector('[data-save]'), back = el.querySelector('[data-back]'), go = el.querySelector('.lit');
  const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif';
  let cur = '';

  function apply(text) {
    cur = text;
    if (!app.renderer) { app.toast('这台设备没有 WebGL，刻不上去。'); return; }
    app.stamp(text || '鼠哥', text ? FONT : 'TapeoutDisplay');
    save.disabled = back.disabled = !text;
    go.classList.toggle('lit', !text);
    app.ripple(.012, -.01, 1.1);
    app.pulse(.9);
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (v) { apply(v); app.toast(`“${v}”已经刻进顶层金属了。`); }
  });
  back.addEventListener('click', () => { input.value = ''; apply(''); });
  save.addEventListener('click', () => app.snapshot(`tapeout-${cur}.png`));
  return { sleep() { if (cur) { input.value = ''; apply(''); } } };
}
