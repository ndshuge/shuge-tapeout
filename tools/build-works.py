# 把鼠哥星系的 catalog 和几个独立项目合成作品表，逐个确认链接真的打得开。
import json, sys, urllib.request, concurrent.futures as cf
from pathlib import Path

root = Path(__file__).resolve().parents[1]
cat = json.loads((root / 'data/catalog.raw.json').read_text('utf8'))
L = 'https://ndshuge.github.io/ndshuge-galaxy/little-works/'
G = 'https://ndshuge.github.io/'
GH = 'https://github.com/ndshuge/'

CATS = {
    'game': {'gameverse-vision', 'gameverse', 'arcade-library', 'xjtu-campus-3d'},
    'learn': {'ai-academy-apple', 'zhixu-ai-academy', 'xjtu-chronicle', 'study-flow'},
    'agent': {'xiaoya-lifelab'},
    'life': {'move-daily', 'focus-aura', 'habit-flow', 'mood-journal', 'idea-cards', 'time-capsule', 'glass-calendar',
             'page-between', 'luma-gallery', 'frequency', 'aurora-player', 'moonlight-player'},
}
def cat_of(i):
    for k, v in CATS.items():
        if i in v:
            return k
    return 'art'

works = []
for x in cat:
    u = x.get('url') or x.get('path') or x.get('href') or ''
    url = u if u.startswith('http') else L + u.lstrip('./')
    t = (x.get('title') or x.get('name')).replace('｜', ' · ')
    works.append({'id': x.get('id') or x.get('slug'), 't': t, 'd': x.get('summary') or x.get('description') or x.get('desc') or '', 'u': url, 'c': cat_of(x.get('id') or x.get('slug'))})

extra = [
    ('micehole', 'Mice Hole', '让 ChatGPT 真正操作电脑的执行桥：文件、终端、Git、浏览器。自托管，不依赖额外模型 API。', GH + 'micehole', 'agent'),
    ('factguard', 'FactGuard', '可追溯的事实核验 Skill，让每个判断都经得起追问。', GH + 'factguard', 'agent'),
    ('rolevault', 'RoleVault', '角色隔离和按需遗忘的 AI 记忆系统：记住重要的，放下不需要的。', GH + 'rolevault', 'agent'),
    ('observatory', 'Engineering Observatory', '每天自动更新的公开工程趋势观测站。', GH + 'engineering-observatory', 'agent'),
    ('galaxy', '鼠哥星系', '像素星空里的作品总入口，星系跃迁和键盘终端。', G + 'ndshuge-galaxy/', 'art'),
    ('game', '鼠哥游戏厅', '16 款浏览器游戏：像素动作、物理沙盒、生存和节奏。', G + 'ndshuge-game/', 'game'),
    ('lumen', 'LUMEN SIEGE 光核围城', '有怪物、升级系统和自动化测试的像素生存游戏。', G + 'ndshuge-game/games/lumen-siege/', 'game'),
    ('mumu', '哦，木木金金棋', '筑墙找路的原创策略棋，带地图工坊和自己训练的 AI 对手。', G + 'oh-mumujinjin/', 'game'),
    ('shanhe', '山河为证', '把长征路上的不同故事，重新放回地图和时间里。', GH + 'shanhe-preview', 'game'),
    ('atlas', '西交兴庆 3D 校园图志', '用真实 OpenStreetMap 轮廓搭起来的校园，可以地面漫游。', GH + 'xjtu-campus-atlas', 'game'),
    ('academy', '鼠哥学院', '微积分、Python、C、芯片、大学物理，五个互动学院。', G + 'ndshuge-academy/', 'learn'),
    ('zhixu', '知序 AI 学院', '先预测，再实验，最后形成自己的判断。', G + 'zhixu-ai-academy/', 'learn'),
    ('classnote', 'Classnote 课堂总结', '把课程记录整理成结构化笔记，支持备份和可选的 AI 总结。', G + 'ndshuge-classnote/', 'learn'),
    ('weather', '晴间 Daylight Weather', '实时天气、24 小时趋势和 7 天预报。', GH + 'qingjian-weather', 'life'),
    ('focus', 'Focus Deck', '安静的专注计时、任务和学习统计。', GH + 'focus-deck', 'life'),
]
# 目录里和独立项目重复的条目，只留能直接打开的那个
DROP = {'zhixu-ai-academy', 'atlas'}
works = [w for w in works if w['id'] not in DROP]
extra = [e for e in extra if e[0] not in DROP]
seen = {w['u'] for w in works}
for i, t, d, u, c in extra:
    if u not in seen:
        works.append({'id': i, 't': t, 'd': d, 'u': u, 'c': c})

def check(w):
    try:
        req = urllib.request.Request(w['u'], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=25) as r:
            return w, r.status
    except Exception as e:
        return w, str(getattr(e, 'code', e))[:40]

ok, bad = [], []
with cf.ThreadPoolExecutor(10) as ex:
    for w, st in ex.map(check, works):
        (ok if st == 200 else bad).append((w, st))
print('ok', len(ok), 'bad', len(bad))
for w, st in bad:
    print('BAD', w['id'], st, w['u'])
final = [w for w, _ in ok]
(root / 'data/works.js').write_text('// 由 tools/build-works.py 生成，链接都在生成时确认过能打开。\nexport const WORKS = ' + json.dumps(final, ensure_ascii=False, indent=0) + ';\n', 'utf8')
from collections import Counter
print(Counter(w['c'] for w in final))
