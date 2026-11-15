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
    # Recover the original therapy artwork if a captured preview omitted its root.
    if 'data-landmark="therapy-office"' not in html:
        therapy = ('<div class="scene-sprite landmark-art" data-scenery="landmark" '
                   'data-landmark="therapy-office" data-source-name="" data-layer="therapy-office" '
                   'style="left:812.0px;top:450.5px;width:101.0px;height:78.5px;z-index:41;overflow:hidden">'
                   '<img src="/kloset/therapy.webp" alt="" draggable="false" '
                   'style="position:absolute;max-width:none;width:115.67656765676568%;'
                   'height:119.61620469083157%;left:-8.16831683168317%;top:-9.061833688699359%;"></div>')
        html = html.replace(anchor, therapy+anchor, 1)
    definitions = json.loads((HERE/'landmarks.json').read_text())
    for id, definition in definitions.items():
        pattern = r'(<div[^>]*data-landmark="'+re.escape(id)+r'"[^>]*>)<img[^>]*></div>'
        roots = list(re.finditer(pattern,html))
        assert len(roots) == 1
        match = roots[0]
        box = definition['scene']
        geometry = f'left:{box["x"]}px;top:{box["y"]}px;width:{box["w"]}px;height:{box["h"]}px;'
        root, count = re.subn(r'left:[^;]+;top:[^;]+;width:[^;]+;height:[^;]+;',geometry,match.group(1),count=1)
        assert count == 1
        root = re.sub(r'z-index:[^;]+;',f'z-index:{definition["placement"]["z"]};',root,count=1)
        image = (f'<img src="{definition["placement"]["asset"]}" alt="" draggable="false" '
                 'style="position:absolute;inset:0;width:100%;height:100%;max-width:none"></div>')
        html = html[:match.start()]+root+image+html[match.end():]
    ambulance = definitions['hurt-people-hospital'].get('ambulance')
    if ambulance:
        pattern = r'<div[^>]*data-layer="hurt-people-ambulance\.png"[^>]*>'
        roots = re.findall(pattern, html)
        assert len(roots) == 1
        box = ambulance
        geometry = f'left:{box["x"]}px;top:{box["y"]}px;width:{box["w"]}px;height:{box["h"]}px;'
        root, count = re.subn(r'left:[^;]+;top:[^;]+;width:[^;]+;height:[^;]+;',geometry,roots[0],count=1)
        assert count == 1
        html = html.replace(roots[0],root,1)
    # Reuse native scenery art and masks in the reviewed clearing.
    for item in json.loads((HERE/'landscape.json').read_text()):
        pattern = r'<div[^>]*data-layer="'+re.escape(item['source'])+r'"[^>]*><img[^>]*></div>'
        originals = re.findall(pattern, html)
        assert originals, item['source']
        root = originals[0]
        root = root.replace('data-layer="'+item['source']+'"','data-layer="'+item['name']+'"',1)
        geometry = f'left:{item["x"]}px;top:{item["y"]}px;width:{item["w"]}px;height:{item["h"]}px;'
        root, count = re.subn(r'left:[^;]+;top:[^;]+;width:[^;]+;height:[^;]+;',geometry,root,count=1)
        assert count == 1
        root = re.sub(r'z-index:[^;]+;',f'z-index:{item["z"]};',root,count=1)
        html = html.replace(anchor,root+anchor,1)
    return html

def install(html, output):
    placement = json.loads((HERE/'placement.json').read_text())
    html = add_scene(add_placement(add_location(html, placement), placement), placement)
    target = output/'kloset'
    target.mkdir(exist_ok=True)
    for file in HERE.iterdir():
        if file.suffix in {'.webp', '.jpg', '.png', '.gif', '.json', '.css', '.js'} and file.name not in {'placement.json','landmarks.json'}:
            shutil.copyfile(file, target/file.name)
    return html.replace('</head>', '<script defer src="/kloset/archive.js"></script><script defer src="/kloset/burger-memory.js"></script><script defer src="/kloset/merch-stock.js"></script></head>', 1)
