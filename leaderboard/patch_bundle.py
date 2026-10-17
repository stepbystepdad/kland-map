"""Splice the Nuttin' Burger leaderboard module into the map bundle.

The bundle is one outer IIFE that builds the map iframe and assigns its srcdoc. The leaderboard
goes in the outer scope, where `frame` is already defined, because it renders in the parent page.
"""
import argparse, json, subprocess, sys, hashlib

ap = argparse.ArgumentParser()
ap.add_argument('--src', default='bundle.js')
ap.add_argument('--module', default='leaderboard/nb-leaderboard-client.js')
ap.add_argument('--config', default='leaderboard/config.json')
ap.add_argument('--out', default='bundle.js')
a = ap.parse_args()

src = open(a.src, encoding='utf-8').read()
mod = open(a.module, encoding='utf-8').read()
cfg = json.load(open(a.config, encoding='utf-8'))

assert 'kland-nuttin-name-v1' not in src, 'leaderboard already spliced in'
assert src.endswith('";})();'), 'unexpected bundle tail: ' + repr(src[-24:])

mod = mod.replace('__NB_API__', cfg['api'])
assert '__NB_API__' not in mod, 'unsubstituted placeholder left in the module'

out = src[:-len('})();')] + '\n' + mod + '})();\n'

open(a.out, 'w', encoding='utf-8').write(out)
open('/tmp/nb_outer_check.js', 'w', encoding='utf-8').write(out)
r = subprocess.run(['node', '--check', '/tmp/nb_outer_check.js'], capture_output=True, text=True)
if r.returncode != 0:
    sys.exit('outer bundle syntax: ' + r.stderr.strip().splitlines()[-1])

open('/tmp/nb_module_check.js', 'w', encoding='utf-8').write(mod)
r = subprocess.run(['node', '--check', '/tmp/nb_module_check.js'], capture_output=True, text=True)
if r.returncode != 0:
    sys.exit('module syntax: ' + r.stderr.strip().splitlines()[-1])

print('bundle  %d -> %d bytes' % (len(src.encode()), len(out.encode())))
print('sha256  %s' % hashlib.sha256(out.encode()).hexdigest())
print('config  api=%s' % cfg['api'])
