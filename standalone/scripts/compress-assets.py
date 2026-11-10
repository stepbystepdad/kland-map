"""Losslessly encode PNG artwork as WebP, preserving dimensions and alpha."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from io import BytesIO
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
INDEX=ROOT/'standalone/source/asset-downloads.json'
OUT=ROOT/'standalone/public/assets'
records=json.loads(INDEX.read_text())
def compress(item):
    url,info=item
    if not info['file'].endswith('.png'):return item
    with Image.open(OUT/info['file']) as image:
        if getattr(image,'n_frames',1)>1:return item
        buf=BytesIO();image.save(buf,format='WEBP',lossless=True,exact=True,method=4)
        data=buf.getvalue()
        if len(data)>=info['bytes']*.9:return item
        # A lossless encoding must also retain the actual decoded pixel data.
        check=Image.open(BytesIO(data))
        if image.convert('RGBA').tobytes()!=check.convert('RGBA').tobytes():
            raise ValueError('Pixel comparison failed for '+info['file'])
    name=hashlib.sha256(data).hexdigest()[:16]+'.webp';(OUT/name).write_bytes(data)
    return url,{'file':name,'bytes':len(data),'type':'image/webp','original_file':info['file'],'original_bytes':info['bytes']}
before=sum(i['bytes'] for i in records.values())
with ThreadPoolExecutor(max_workers=4) as pool: records=dict(pool.map(compress,records.items()))
INDEX.write_text(json.dumps(records,indent=2))
after=sum(i['bytes'] for i in records.values())
print(json.dumps({'before':before,'after':after,'saved_bytes':before-after,'optimized_pngs':sum('original_file' in i for i in records.values())}))
