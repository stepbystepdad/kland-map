"""Install the wardrobe and approved landmark artwork using the native map data."""
import json
from pathlib import Path
import re
import shutil

HERE = Path(__file__).resolve().parent

def add_location(script, placement):
    key = 'const DATA='
    assert script.count(key) == 1
    start = script.index(key)+len(key)
    data, length = json.JSONDecoder().raw_decode(script[start:])
    x, y, right, bottom = placement['bbox']
    data['locations'].append(dict(
        id='the-kloset', name='The Kloset', x=(x+right)/2, y=(y+bottom)/2,
        w=placement['width'], h=placement['height'], phase=0, song='',
        kind='FASHION ARCHIVE', lore="Step inside K’s wardrobe."))
    definitions = json.loads((HERE/'landmarks.json').read_text())
    for location in data['locations']:
        if location['id'] in definitions:
            p = definitions[location['id']]['placement']
            x0, y0, x1, y1 = p['bbox']
            location.update(x=(x0+x1)/2, y=(y0+y1)/2, w=p['width'], h=p['height'])
    return script[:start]+json.dumps(data,ensure_ascii=False,separators=(',',':'))+script[start+length:]

def add_placement(script, placement):
    key = 'const PSD_PLACEMENTS='
    assert script.count(key) == 1
    start = script.index(key)+len(key)
    data, length = json.JSONDecoder().raw_decode(script[start:])
    data['the-kloset'] = placement
    for id, definition in json.loads((HERE/'landmarks.json').read_text()).items():
        data[id].update(definition['placement'])
    return script[:start]+json.dumps(data,ensure_ascii=False,separators=(',',':'))+script[start+length:]

def add_scene(html, p):
    anchor = '<div class="scene-sprite landmark-art" data-scenery="landmark" data-landmark="community-clubhouse"'
    assert html.count(anchor) == 1
    x, y = p['bbox'][:2]
    sprite = (f'<div class="scene-sprite landmark-art" data-scenery="landmark" data-landmark="the-kloset" '
              f'data-source-name="" data-layer="the-kloset" style="left:{x}px;top:{y}px;width:{p["width"]}px;'
              f'height:{p["height"]}px;z-index:{p["z"]};overflow:hidden"><img src="{p["asset"]}" '
              'alt="" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;max-width:none"></div>')
    html = html.replace(anchor, sprite+anchor, 1)
    for id, definition in json.loads((HERE/'landmarks.json').read_text()).items():
        pattern = r'(<div[^>]*data-landmark="'+re.escape(id)+r'"[^>]*>)<img[^>]*></div>'
        roots = list(re.finditer(pattern,html))
        assert len(roots) == 1
        match = roots[0]
        box = definition['scene']
        geometry = f'left:{box["x"]}px;top:{box["y"]}px;width:{box["w"]}px;height:{box["h"]}px;'
        root, count = re.subn(r'left:[^;]+;top:[^;]+;width:[^;]+;height:[^;]+;',geometry,match.group(1),count=1)
        assert count == 1
        image = (f'<img src="{definition["placement"]["asset"]}" alt="" draggable="false" '
                 'style="position:absolute;inset:0;width:100%;height:100%;max-width:none"></div>')
        html = html[:match.start()]+root+image+html[match.end():]
    return html

def install(html, output):
    placement = json.loads((HERE/'placement.json').read_text())
    html = add_scene(add_placement(add_location(html, placement), placement), placement)
    target = output/'kloset'
    target.mkdir(exist_ok=True)
    for file in HERE.iterdir():
        if file.suffix in {'.webp', '.jpg', '.json', '.css', '.js'} and file.name not in {'placement.json','landmarks.json'}:
            shutil.copyfile(file, target/file.name)
    return html.replace('</head>', '<script defer src="/kloset/archive.js"></script></head>', 1)
