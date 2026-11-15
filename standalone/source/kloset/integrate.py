"""Register the boutique with the same location, sprite and mask data as Town Hall."""
import json
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent

def add_location(script, placement):
    key = 'const DATA={"locations":['
    x, y, right, bottom = placement['bbox']
    location = dict(id='the-kloset', name='The Kloset', x=(x+right)/2, y=(y+bottom)/2,
                    w=placement['width'], h=placement['height'], phase=0, song='',
                    kind='FASHION ARCHIVE', lore="Step inside K’s wardrobe.")
    assert script.count(key) == 1
    start = script.index(key) + len(key) - 1
    _, length = json.JSONDecoder().raw_decode(script[start:])
    end = start + length - 1
    return script[:end] + ',' + json.dumps(location, ensure_ascii=False) + script[end:]

def add_placement(script, placement):
    key = 'const PSD_PLACEMENTS={'
    assert script.count(key) == 1
    return script.replace(key, key + '"the-kloset":' + json.dumps(placement) + ',', 1)

def add_scene(html, p):
    anchor = '<div class="scene-sprite landmark-art" data-scenery="landmark" data-landmark="community-clubhouse"'
    assert html.count(anchor) == 1
    x, y = p['bbox'][:2]
    sprite = (f'<div class="scene-sprite landmark-art" data-scenery="landmark" data-landmark="the-kloset" '
              f'data-source-name="" data-layer="the-kloset" style="left:{x}px;top:{y}px;width:{p["width"]}px;'
              f'height:{p["height"]}px;z-index:{p["z"]};overflow:hidden"><img src="{p["asset"]}" '
              'alt="" draggable="false" style="position:absolute;inset:0;width:100%;height:100%;max-width:none"></div>')
    return html.replace(anchor, sprite + anchor, 1)

def install(html, output):
    placement = json.loads((HERE/'placement.json').read_text())
    html = add_scene(add_placement(add_location(html, placement), placement), placement)
    target = output/'kloset'
    target.mkdir(exist_ok=True)
    for file in HERE.iterdir():
        if file.suffix in {'.webp', '.jpg', '.json', '.css', '.js'} and file.name != 'placement.json':
            shutil.copyfile(file, target/file.name)
    # Deferred execution follows the map's synchronous popup installers.
    return html.replace('</head>', '<script defer src="/kloset/archive.js"></script></head>', 1)
