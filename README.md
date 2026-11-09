<div align="center">

<a href="https://ndshuge.github.io/shuge-tapeout/"><img src="docs/media/flight.webp" width="100%" alt="从整张晶圆一路放大到中间那颗芯片，再到刻着“鼠哥”的那块金属"></a>

# 我把自己流片了

**鼠哥的个人主页。一张可以一路放大的硅晶圆，正中间那颗芯片是我。**

<a href="https://ndshuge.github.io/shuge-tapeout/"><img src="https://img.shields.io/badge/%E6%89%93%E5%BC%80%E6%99%B6%E5%9C%86-ndshuge.github.io-ffc46b?style=for-the-badge&labelColor=17130c" alt="打开晶圆"></a>

<img src="https://img.shields.io/badge/WebGL2-%E5%8E%9F%E7%94%9F%E6%89%8B%E5%86%99-7fb6ff?style=flat-square&labelColor=17130c" alt="WebGL2 原生手写">
<img src="https://img.shields.io/badge/%E8%BF%90%E8%A1%8C%E4%BE%9D%E8%B5%96-0-9be58f?style=flat-square&labelColor=17130c" alt="运行依赖 0">
<img src="https://img.shields.io/badge/%E4%BD%9C%E5%93%81-53%20%E9%A2%97%E8%8A%AF%E7%89%87-ff9ecb?style=flat-square&labelColor=17130c" alt="作品 53 颗芯片">
<img src="https://img.shields.io/badge/%E6%A8%A1%E5%9D%97-10%20%E4%B8%AA%E8%83%BD%E7%8E%A9-c9a7ff?style=flat-square&labelColor=17130c" alt="模块 10 个能玩">

</div>

<br>

晶圆上每颗点亮的芯片，都是一件做完的作品。正中间那颗是我：放大进去，学校、Agent、乐队、机器人、话剧、赛艇，都是它上面的功能模块。

滚动就是调焦。鼠标移到芯片上，显微镜会掀开顶层金属，下面是另一层电路。

## 芯片规格书

十个模块，十件我在意的事，每一块都能上手。

| 模块 | 对应的我 | 上手试试 |
| :-- | :-- | :-- |
| **Boot ROM** | 西安交通大学，电子科学与技术 | 点比特改写 ROM，把十六个字节换成你想说的话 |
| **Agent 核心** | [Mice Hole](https://github.com/ndshuge/micehole) 和我做的智能体 | 看一遍 Mice Hole 怎么替 ChatGPT 动手 |
| **协处理器** | 学习工具 | 先预测 MOS 管会怎样，再做实验验证 |
| **模拟电路** | 乐队 | 四轨鼓机，芯片的电流跟着底鼓走 |
| **图形阵列** | 造世界 | 不用跳转，游戏和 3D 校园就在芯片上开 |
| **缓存** | 署名 | 把你的名字刻上金属，存成图片带走 |
| **可编程阵列** | 数字生命 | 改一条粒子规则，看整片世界怎么变 |
| **执行器** | 机器人社团，RoboCup | 同一段代码，切到“真实世界”再跑一次 |
| **时钟环** | 话剧团 | 灯打到哪个身份，今晚就演哪个 |
| **电源管理** | 赛艇 | 芯片快没电了，跟着节奏拉桨把它充满 |

芯片工程师有在顶层金属上偷偷留涂鸦的老传统。这块芯片上也藏了一只小鼠，普通视角看不见。

## 放大看看

<table>
  <tr>
    <td width="50%"><img src="docs/media/rom.jpg" alt="Boot ROM 模块：点亮比特写出“饮水思源1896”"></td>
    <td width="50%"><img src="docs/media/worlds.jpg" alt="图形阵列模块：在面板里直接打开鼠哥游戏厅"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Boot ROM</b>　这十六个字节真的刻在版图上</sub></td>
    <td align="center"><sub><b>图形阵列</b>　右边都是真的，点开就玩</sub></td>
  </tr>
  <tr>
    <td><img src="docs/media/stamp.jpg" alt="缓存模块：巨大的“鼠哥”二字刻在彩虹色金属上"></td>
    <td><img src="docs/media/life.jpg" alt="可编程阵列模块：四种粒子按规则聚散"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>缓存</b>　这块金属可以借你一会儿</sub></td>
    <td align="center"><sub><b>可编程阵列</b>　规则就几行，长出来的没人写过</sub></td>
  </tr>
  <tr>
    <td><img src="docs/media/stage.jpg" alt="时钟环模块：一束聚光灯打在舞台的身份牌上"></td>
    <td><img src="docs/media/wafer.jpg" alt="整张晶圆：53 颗点亮的作品芯片和分类列表"></td>
  </tr>
  <tr>
    <td align="center"><sub><b>时钟环</b>　试着成为另一个人</sub></td>
    <td align="center"><sub><b>整张晶圆</b>　这 53 颗都能点开</sub></td>
  </tr>
</table>

手机上也是完整的，面板会从硅片上落回页面里。

<table>
  <tr>
    <td width="33%"><img src="docs/media/phone-cover.jpg" alt="手机封面"></td>
    <td width="33%"><img src="docs/media/phone-rom.jpg" alt="手机上的 ROM 面板"></td>
    <td width="33%"><img src="docs/media/phone-life.jpg" alt="手机上的粒子实验"></td>
  </tr>
</table>

## 这块芯片是怎么造的

没有框架，没有打包，浏览器直接跑原生 ES modules 和 WebGL2。

- **版图是算出来的。** 贴图由种子程序生成，桌面 4096²，触屏 2048²，一路放大都不用照片。
- **彩虹反光是物理模型。** 晶圆的衍射按 *GPU Gems* 第 8 章的思路做成 LUT，再叠薄膜干涉和 bloom。
- **显微镜是真的多一层。** 掀开顶层金属露出器件层，小鼠只画在下面这一层。
- **镜头听滚动条的。** 用的是浏览器原生滚动，每一节一个 `data-shot` 镜头，键盘和“减弱动态”都能用。
- **玩具懒加载。** 每个模块实现 `mount(el, app)` → `{frame, wake, sleep, resize}`，飞到才启动。
- **低配有退路。** 动态分辨率兜底；没有 WebGL2 时退回普通长页，文字、面板和作品列表都在。

<details>
<summary><b>本地运行和目录</b></summary>

<br>

```bash
node tools/serve.mjs . 18973
```

打开 <http://127.0.0.1:18973/>。

| 路径 | 内容 |
| :-- | :-- |
| `index.html` | 全部正文，14 节 |
| `js/gl.js` | WebGL2 渲染：衍射、薄膜干涉、显微镜、bloom |
| `js/die-gen.js` | 版图贴图生成，署名和小鼠也刻在这里 |
| `js/camera.js` | 每一幕的镜头和滚动跟随 |
| `js/main.js` | 启动、导航、面板钉在硅片上、降级 |
| `js/wafer.js` | 整张晶圆的作品地图和列表 |
| `js/toys/` | 各模块的玩具 |
| `data/works.js` | 作品数据，由 `tools/build-works.py` 生成 |
| `tools/qa/` | Playwright 行为测试 |

标题字体是按站内用字裁出来的子集。改了文案要重跑一次，否则新字会掉回系统字体：

```bash
python tools/subset-font.py
```

</details>

**测试情况**：行为测试只在 Edge（Chromium）上跑过，手机结果来自仿真。Safari、Firefox 和真机还没测，遇到问题欢迎开 Issue。

## 致谢

- 标题字体基于[得意黑 Smiley Sans](https://github.com/atelier-anchor/smiley-sans)（© atelierAnchor，SIL OFL 1.1）。站内使用裁剪后的子集，按 OFL 的保留名称条款改名为 TapeoutDisplay，许可证见 [`fonts/OFL.txt`](fonts/OFL.txt)。
- 晶圆的衍射反光参考了 *GPU Gems* 第 8 章（Simulating Diffraction）。

<div align="center">
<br>
<sub>把想法变成能打开、能操作、能探索的东西。</sub>
</div>
