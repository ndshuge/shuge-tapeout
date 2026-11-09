#!/usr/bin/env python3
"""把得意黑裁成只含本站用字的 woff2，文字改过之后重跑一次。

用法：python tools/subset-font.py（需要 fonttools 和 brotli）
页面里访客自己输入的字走系统字体，不需要进这个子集。
"""
import pathlib
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'fonts' / 'smiley-full.woff2'
OUT = ROOT / 'fonts' / 'tapeout-display.woff2'

# 上游声明了 Reserved Font Name（Smiley、得意黑）。按 OFL 第 3 条，裁剪后的字体是
# 修改版，不能沿用这个名字，所以内部名称要改掉；版权行和许可证保留（见 fonts/OFL.txt）。
FAMILY, PS = 'TapeoutDisplay', 'TapeoutDisplay-Oblique'
RENAME = {1: FAMILY, 16: FAMILY, 3: f'{FAMILY} subset', 4: f'{FAMILY} Oblique', 6: PS}

chars = {chr(c) for c in range(0x20, 0x7f)}
files = [ROOT / 'index.html', *sorted((ROOT / 'js').rglob('*.js')), ROOT / 'data' / 'works.js', ROOT / 'css' / 'site.css']
for f in files:
    chars |= {c for c in f.read_text(encoding='utf8') if ord(c) > 0x7f}
chars -= {c for c in chars if re.match(r'\s', c)}
chars.add(' ')

font = TTFont(SRC)
cmap = font.getBestCmap()
missing = sorted(c for c in chars if ord(c) not in cmap)

opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.notdef_outline = True
sub = subset.Subsetter(opts)
sub.populate(text=''.join(chars))
sub.subset(font)
for rec in font['name'].names:
    if rec.nameID in RENAME:
        rec.string = RENAME[rec.nameID]
# 版权行（0）和许可证（13）可以提到上游；其余记录里不能再出现保留名
left = {r.nameID: str(r) for r in font['name'].names if r.nameID not in (0, 13) and re.search('smiley|得意黑', str(r), re.I)}
if left:
    raise SystemExit(f'还有记录用着保留名：{left}')
font.flavor = 'woff2'
font.save(OUT)

print(f'{len(chars)} 个字符，字体里缺 {len(missing)} 个（走系统字体）')
print(f'{SRC.stat().st_size // 1024} KB -> {OUT.stat().st_size // 1024} KB')
