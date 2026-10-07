# QueueZeroTwo release 8: put Sound, Vibration, theme, Voice and How it works back in the header; side menu keeps the rest.
# Run from repo root after the side-menu release: python3 release8_header_icons.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
h = rep(h, """['button[title="Players"]','button[onclick="stand()"]','button[onclick="hist()"]','#snb','#hpb','#thb','#tsb','button[onclick="openFaq()"][title]','#exp','#impbtn']""",
           """['button[title="Players"]','button[onclick="stand()"]','button[onclick="hist()"]','#exp','#impbtn']""")
h = rep(h, "#qscrim[hidden]{display:none}", "#qscrim[hidden]{display:none}@media(max-width:767px){header>.container{flex-wrap:wrap;row-gap:.5rem}}")
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
