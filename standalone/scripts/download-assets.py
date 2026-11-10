"""Mirror the exact production image/audio URLs, retaining original bytes."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib, json, re, urllib.request, urllib.parse
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'standalone/source'
OUT=ROOT/'standalone/public/assets'
source=(SRC/'map.html').read_text()+(SRC/'burger.js').read_text()
urls=set(re.findall(r'https://(?:images\.squarespace-cdn\.com|audio\.squarespace-cdn\.com|static1\.squarespace\.com|cdn\.jsdelivr\.net/gh/stepbystepdad/kland-nuttin-burger@v7)/[^\s\"\x27<>`]+',source))
urls={u for u in urls if re.search(r'\.(?:webp|png|jpg|jpeg|avif|mp3|gif)(?:\?|$)',u,re.I)}
index=SRC/'asset-downloads.json'
done=json.loads(index.read_text()) if index.exists() else {}
def download(url):
    if url in done and (OUT/done[url]['file']).exists():return url,done[url]
    request=urllib.request.Request(url,headers={'User-Agent':'KLandMigration/1.0'})
    with urllib.request.urlopen(request,timeout=60) as response:
        content=response.read(); mime=response.headers.get_content_type()
    if not mime.startswith(('image/','audio/')):raise ValueError('Unexpected content type '+mime)
    suffix=Path(urllib.parse.urlsplit(url).path).suffix.lower()
    name=hashlib.sha256(content).hexdigest()[:16]+suffix
    if len(content)>25*1024*1024:raise ValueError('Asset exceeds Cloudflare limit')
    (OUT/name).write_bytes(content)
    return url,{'file':name,'bytes':len(content),'type':mime}
fail=[]
with ThreadPoolExecutor(max_workers=6) as pool:
    futures={pool.submit(download,u):u for u in urls}
    for job in as_completed(futures):
        try:u,info=job.result();done[u]=info
        except Exception as e:fail.append({'url':futures[job],'error':str(e)})
index.write_text(json.dumps(done,indent=2))
(SRC/'asset-download-failures.json').write_text(json.dumps(fail,indent=2))
print(json.dumps({'assets':len(done),'bytes':sum(i['bytes'] for i in done.values()),'failures':fail}))
