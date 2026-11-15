"""Build the current, fully patched K Land as a direct static document.

The captured source is intentional: it includes production fixes newer than the
last GitHub tag. No Squarespace iframe rewriting runs in the standalone build.
"""
from pathlib import Path
import base64, hashlib, json, os, re, shutil
from PIL import Image
from io import BytesIO

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'standalone/source'
OUT = ROOT / 'standalone/dist'
# Rebuild generated output from scratch so removed assets cannot leak into a
# later deployment and local builds match fresh GitHub runners.
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(exist_ok=True)
(OUT / 'assets').mkdir(exist_ok=True)
manifest = {}

def asset(data, suffix):
    name = hashlib.sha256(data).hexdigest()[:16] + '.' + suffix
    (OUT / 'assets' / name).write_bytes(data)
    return '/assets/' + name

def externalize(match):
    mime, encoded = match.groups()
    suffix = {'image/webp':'webp','image/avif':'avif','image/png':'png'}[mime]
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except ValueError:
        return match.group(0)  # Preserve the legacy feature-detection placeholder.
    url = asset(decoded, suffix)
    manifest[url] = {'type': mime, 'bytes': len(decoded)}
    return url

import sys
sys.path.insert(0, str(SOURCE / 'kloset'))
from integrate import install as install_kloset

html = (SOURCE / 'map.html').read_text()
html = install_kloset(html, OUT)
html = html.replace('kland-portrait:steph', asset((SOURCE/'portraits/Steph-Profile.png').read_bytes(),'png'))
html += '<script>'+ (SOURCE/'mobile-controls.js').read_text() + '</script>'
html = re.sub(r'data:(image/(?:webp|avif|png));base64,([A-Za-z0-9+/=]+)', externalize, html)
for name in ['k-land-terrain.svg','k-house.webp','bare-minimum-bungalow.webp','conversations.json']:
    shutil.copy2(ROOT / name, OUT / name)

# Fixed, local delivery for scenery and conversations. Keep user-facing outbound
# links intact; only the known asset endpoints are rewritten.
html = re.sub(r"'https://cdn.jsdelivr.net/gh/stepbystepdad/kland-map@'\+\(\(window.parent&&window.parent.KLAND_MAP_VERSION\)\|\|'v1'\)\+", "''+", html)
html = re.sub(r'"https://cdn.jsdelivr.net/gh/stepbystepdad/kland-map@"\+\(\(window.parent&&window.parent.KLAND_MAP_VERSION\)\|\|"v1"\)\+', '""+', html)
html = html.replace('https://raw.githubusercontent.com/stepbystepdad/kland-map/main/conversations.json','/conversations.json')
html = html.replace('https://cdn.jsdelivr.net/gh/stepbystepdad/kland-map@main/conversations.json','/conversations.json')

# The existing Squarespace forms remain on Squarespace and retain their own
# submission infrastructure. Their embed page styling is installed there.
for path in ['/k-land-arrivals','/silvie-museum-submissions','/k-land-signup','/town-hall/town-hall']:
    for quote in ['"', "'"]:
        html = html.replace(quote+path+quote,quote+'https://www.kevinsilvester.com'+path+'?kland-embed=1'+quote)
html = html.replace("frame.contentDocument?.URL==='about:blank'", "frame.getAttribute('src')==='about:blank'")
# A cross-origin embed reports only its busy state, never field values. Keep
# Town Hall's refresh control working without accessing another origin's DOM.
html = html.replace("function busy(){try{const d=frame.contentDocument;", "let remoteBusy=true;addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.origin==='https://www.kevinsilvester.com'&&e.data?.type==='kland-form-status')remoteBusy=!!e.data.busy;});function busy(){if(new URL(frame.src).origin!==location.origin)return remoteBusy;try{const d=frame.contentDocument;")
html = html.replace("function reload(manual=false){if(busy())", "function reload(manual=false){if(new URL(frame.src).origin!==location.origin){if(busy()){if(manual)status.textContent='Post or clear your draft before refreshing.';}else{status.textContent='Refreshing…';frame.contentWindow.postMessage({type:'kland-form-refresh'},'https://www.kevinsilvester.com');}return;}if(busy())")
html = html.replace("frame.onload=()=>{status.textContent='';try{", "frame.onload=()=>{status.textContent='';frame.contentWindow.postMessage({type:'kland-form-status-request'},'https://www.kevinsilvester.com');try{")

downloads = SOURCE / 'asset-downloads.json'
if downloads.exists():
    for original, info in json.loads(downloads.read_text()).items():
        local = '/assets/' + info['file']
        shutil.copy2(ROOT/'standalone/public/assets'/info['file'], OUT/'assets'/info['file'])
        html = html.replace(original,local)

# Prepare popup thumbnails during the build rather than decoding and encoding
# full product/photo images on every visitor's phone under the loading screen.
def read_json_assignment(prefix):
    start=html.index(prefix)+len(prefix)
    return json.JSONDecoder().raw_decode(html[start:])[0]
photos=read_json_assignment('const KLAND18_ASSETS=')['photos']
merch=read_json_assignment('const merch=')['items']
artworks=read_json_assignment('artworks=')
thumb_sources=[p['src'] for p in photos]+[p['image'] for p in merch]+[p['url'] for p in artworks]
thumbs={}
for src in sorted(set(thumb_sources)):
    if not src.startswith('/assets/'):continue
    with Image.open(OUT/src.lstrip('/')) as image:
        image.thumbnail((360,600),Image.Resampling.LANCZOS)
        buf=BytesIO();image.save(buf,format='WEBP',quality=88,method=6)
        thumbs[src]=asset(buf.getvalue(),'webp')
html = html.replace("img.decoding='async';img.src=src;assets.images.set(src,img);", "img.decoding='async';img.src=window.KLandPrebuiltThumbs?.[src]||src;assets.images.set(src,img);")
thumb_start=html.index('window.KLandPreparePopupThumbs = async sources => {')
thumb_end=html.index('// Give the browser a paint opportunity',thumb_start)
html=html[:thumb_start]+'''window.KLandPreparePopupThumbs = async sources => {
  for (const src of new Set(sources)) {
    const image=window.KLandPopupAssets.images.get(src);
    if(!image)continue;
    try {await image.decode();window.KLandPopupThumbs.set(src,image);}catch{}
  }
  document.documentElement.dataset.popupThumbnails=String(window.KLandPopupThumbs.size);
};
'''+html[thumb_end:]

# Preserve execution order and blocking semantics. Extracted script files can be
# cached independently; the document no longer reparses embedded image payloads.
scripts = []
def script_file(match):
    attrs, code = match.groups()
    if not code.strip(): return match.group(0)
    if 'Town Hall public discussion' in code and "const prior=window.renderStory;" in code:
        code='''(()=>{
 const prior=window.renderStory;
 window.renderStory=p=>{
  prior(p);if(p.id!=='community-clubhouse')return;
  const body=document.querySelector('#story .simple-body');body.replaceChildren();
  const toolbar=document.createElement('div');toolbar.className='forum-toolbar';
  const label=document.createElement('label'),auto=document.createElement('input');auto.type='checkbox';auto.checked=true;auto.setAttribute('aria-label','Automatically refresh Town Hall');label.append(auto,document.createTextNode(' Auto-refresh'));
  const refresh=document.createElement('button');refresh.type='button';refresh.className='forum-refresh';refresh.textContent='Refresh messages ↻';toolbar.append(label,refresh);
  const status=document.createElement('p');status.className='forum-status';status.setAttribute('role','status');
  const frame=document.createElement('iframe');frame.title='Town Hall public discussion';frame.className='town-hall-frame';body.append(toolbar,status,frame);window.KLandSetFormSource(frame,'https://www.kevinsilvester.com/town-hall/town-hall?kland-embed=1');
  function refreshForm(manual=false){if(frame.dataset.formBusy==='true'){if(manual)status.textContent='Post or clear your draft before refreshing.';return;}window.KLandRefreshForm(frame);}
  refresh.onclick=()=>refreshForm(true);
  const timer=setInterval(()=>{if(!frame.isConnected){clearInterval(timer);return;}if(auto.checked&&!document.hidden&&document.getElementById('panel-story').classList.contains('open')&&!frame.closest('.kland-popup-view[hidden]'))refreshForm();},45000);
 };
})();'''
    else:
        code=re.sub(r"frame.src=('https://www.kevinsilvester.com/(?:k-land-signup|town-hall/town-hall)\?kland-embed=1');",r'window.KLandSetFormSource(frame,\1);',code)
    if 'id="kland-persistent-forms-20261027"' in attrs:
        code=code.replace("frame.src=path;","window.KLandSetFormSource(frame,path);")
        code=code.replace("frame.addEventListener('load',()=>{if(!frame.getAttribute('src')||frame.getAttribute('src')==='about:blank')return;", "frame.addEventListener('kland-form-ready',()=>{")
    scripts.append(code)
    url = asset(code.encode(), 'js')
    return '<script'+attrs+' src="'+url+'"></script>'
html = re.sub(r'<script\b([^>]*)>(.*?)</script\s*>', script_file, html, flags=re.S|re.I)

def style_file(match):
    attrs, code = match.groups()
    return '<link rel="stylesheet"'+attrs+' href="'+asset(code.encode(),'css')+'">'
html = re.sub(r'<style\b([^>]*)>(.*?)</style\s*>', style_file, html, flags=re.S|re.I)

burger = (SOURCE / 'burger.js').read_text()
# The game and the score-name dialog now share one document. Only consume game
# shortcuts when the event actually belongs to the game.
burger = burger.replace("function keydown(e){if(!active)return;", "function keydown(e){if(!active||e.target.closest?.('#nb-board-root,input,textarea,select,[contenteditable=true]'))return;")
burger = burger.replace("function keyup(e){if(", "function keyup(e){if(e.target.closest?.('#nb-board-root,input,textarea,select,[contenteditable=true]'))return;if(")
burger = burger.replace("function open(){if(active)return;active=true;", "function open(){if(active)return;try{best=Math.max(best,Number(win.localStorage.getItem('kland-nuttin-best-v1'))||0);}catch{}active=true;")
if downloads.exists():
    for original, info in json.loads(downloads.read_text()).items():
        burger = burger.replace(original, '/assets/'+info['file'])

board = (SOURCE / 'leaderboard.js').read_text()
board = board.replace("var API = 'https://kland-nuttin-leaderboard.kevinsilvestermusic.workers.dev';", "var API = location.origin + '/api';")
board = board.replace("  if (typeof frame === 'undefined' || !frame) return;", "")
start = board.index('  function watch() {')
board = board[:start] + '''  // Watch only game lifecycle and score/overlay updates. Map animation styles
  // must never trigger leaderboard work.
  doc = document;
  let watchedGame = null;
  function watchGame() {
    const game = gameRoot();
    if (game === watchedGame) return;
    observer?.disconnect(); watchedGame = game;
    if (game) {
      observer = new MutationObserver(tick);
      observer.observe(game, {childList:true,subtree:true,characterData:true,
        attributes:true,attributeFilter:['hidden']});
    }
    tick();
  }
  new MutationObserver(watchGame).observe(document.body,{childList:true});
  watchGame();
})();
'''
addons = '\n'.join(x['text'] for x in json.loads((SOURCE/'map-addons.json').read_text()))
end_scripts = ''.join('<script src="'+asset(code.encode(),'js')+'"></script>' for code in [burger, board, addons])
html = html.replace('</body>', end_scripts+'</body>')
preloads = ''.join('<link rel="preload" as="script" href="'+u+'">' for u in re.findall(r'<script[^>]* src="([^"]+)"',html))

bootstrap = "window.KLAND_MAP_VERSION='v1.4.18';document.documentElement.dataset.build='standalone-20261110';"
revision = os.environ.get('KLAND_COMMIT_SHA', 'local')
if revision != 'local' and not re.fullmatch(r'[a-f0-9]{40}', revision):
    raise ValueError('KLAND_COMMIT_SHA must be a full lowercase Git commit SHA')
bootstrap += 'document.documentElement.dataset.revision='+json.dumps(revision)+';'
bootstrap += 'window.KLandPrebuiltThumbs='+json.dumps(thumbs)+';'
bootstrap += (SOURCE/'form-bridge.js').read_text()
bootstrap += (SOURCE/'performance.js').read_text()
html = html.replace('<head>','<head><script>'+bootstrap+'</script>'+preloads,1)
html = html.replace('<title>K Land — Explore the island</title>','<title>K Land — Kevin Silvester</title><meta name="description" content="Explore K Land: Kevin Silvester’s interactive island, music, characters and Nuttin’ Burger game.">')
(OUT/'index.html').write_text(html)
(OUT/'build.json').write_text(json.dumps({'revision':revision,'mobile_controls':'20261110-v1'}))
(OUT/'_headers').write_text('/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n')
(OUT/'_redirects').write_text('/kland / 302\n')
shutil.copy2(SOURCE/'worker.js',OUT/'_worker.js')
(OUT/'_routes.json').write_text(json.dumps({'version':1,'include':['/api/*'],'exclude':[]}))
(OUT/'preview-phone.html').write_text('''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>K Land mobile preview</title><style>html,body{margin:0;height:100%;background:#211720}body{display:grid;place-items:center}iframe{border:0;width:430px;max-width:100vw;height:850px;max-height:100dvh;background:#00cee3}</style><iframe src="/?diagnostics=1" title="K Land mobile preview" allow="autoplay"></iframe>''')
(ROOT/'standalone/squarespace-code-block.html').write_text('''<style>body:not(.sqs-edit-mode-active){margin:0!important;overflow:hidden!important;background:#00cfe5!important}body:not(.sqs-edit-mode-active) #header,body:not(.sqs-edit-mode-active) #footer-sections,body:not(.sqs-edit-mode-active) #block-yui_3_17_2_1_1791214450114_636{display:none!important}#kland-app-frame{position:fixed;inset:0;width:100%;height:100dvh;border:0;z-index:10000;background:#00cfe5}body.sqs-edit-mode-active #kland-app-frame{position:relative;height:240px;z-index:auto}</style><iframe id="kland-app-frame" title="K Land interactive map" allow="autoplay; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe><script>'''+(SOURCE/'squarespace-shell.js').read_text()+'''</script>''')
(ROOT/'standalone/build-report.json').write_text(json.dumps({'source_html_bytes':(SOURCE/'map.html').stat().st_size,'html_bytes':len(html.encode()),'script_count':len(scripts)+3,'embedded_images':manifest,'assets':len(list((OUT/'assets').iterdir()))},indent=2))
print(json.dumps({'html_bytes':len(html.encode()),'assets':len(list((OUT/'assets').iterdir()))}))
