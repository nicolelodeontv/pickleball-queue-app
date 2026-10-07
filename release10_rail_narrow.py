# QueueZeroTwo release 10: on screens under 1280px the wide side panel no longer covers the page.
# Run after release 7 (side menu with names): python3 release10_rail_narrow.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
h = rep(h, "wide=wide===null?innerWidth>=1280:wide==='1';", "wide=innerWidth>=1280&&(wide===null||wide==='1');")
h = rep(h, "mb.onclick=()=>{if(mq.matches){wide=!wide;try{localStorage.setItem(K,wide?'1':'0')}catch(e){}paint()}else isOpen()?close():open()};",
 "mb.onclick=()=>{if(mq.matches){wide=!wide;if(innerWidth>=1280){try{localStorage.setItem(K,wide?'1':'0')}catch(e){}}paint()}else isOpen()?close():open()};")
h = rep(h, "sc.onclick=close;", "sc.onclick=close;\ndocument.addEventListener('click',e=>{if(!mq.matches||!wide||innerWidth>=1280)return;const b=e.target.closest('#qmenu button');if(!b||b.id!=='mnb'){wide=false;paint()}});")
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
