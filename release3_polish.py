# QueueZeroTwo release 3: Undo vs player profiles fix, safer players restore, UI polish. Run from repo root: python3 release3_polish.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
p = Path('profiles.js').read_text(encoding='utf-8')
# 1. Undo must also roll back all-time player stats (they live outside the session)
h = rep(h, "function undoOffer(snap){const after=JSON.stringify(S);", "function undoOffer(snap){const pu=window.__pundo,after=JSON.stringify(S);")
h = rep(h, "S=JSON.parse(snap);save();render();toast('Finish undone','success')", "S=JSON.parse(snap);if(window.pRestore)pRestore(pu);save();render();toast('Finish undone','success')")
p = rep(p, "const sv=()=>{try{localStorage.setItem(PK,JSON.stringify(P))}catch(e){}};", "const sv=()=>{try{localStorage.setItem(PK,JSON.stringify(P))}catch(e){}};\nwindow.pRestore=s=>{if(!s)return;try{const o=JSON.parse(s);P=o.p||{};S.pseen=o.ps||{};sv()}catch(e){}};")
p = rep(p, "fin=function(id){", "fin=function(id){\n  window.__pundo=null;")
p = rep(p, "S.pseen=S.pseen||{};", "window.__pundo=JSON.stringify({p:P,ps:S.pseen||{}});S.pseen=S.pseen||{};")
# 2. Players restore: validate everything instead of trusting the file
CLN = r"""const num=(v,m)=>Math.min(m,Math.max(0,Math.floor(Number(v))||0));
const ptc=o=>{const r={};if(o&&typeof o==='object')Object.keys(o).slice(0,300).forEach(k=>{const x=o[k];if(x&&k!=='__proto__')r[String(k).slice(0,40)]={n:String(x.n||'').slice(0,40),g:num(x.g,1e5),w:num(x.w,1e5)}});return r};
const cln=x=>({n:String(x.n).slice(0,40),w:num(x.w,1e5),l:num(x.l,1e5),pf:num(x.pf,1e7),pa:num(x.pa,1e7),s:num(x.s,1e5),last:num(x.last,9e15),form:(Array.isArray(x.form)?x.form:[]).slice(0,10).map(f=>f=='W'?'W':'L'),pt:ptc(x.pt),lv:num(x.lv,6)});
"""
p = rep(p, "const row=n=>", CLN + "const row=n=>")
p = rep(p, "Object.keys(o).forEach(k=>{const x=o[k];if(!x||!x.n)return;const c=P[k];if(!c||x.w+x.l>c.w+c.l){P[k]=Object.assign({form:[],pt:{},lv:0,s:0,last:0,pf:0,pa:0,w:0,l:0},x);n++}});",
 "Object.keys(o).slice(0,2000).forEach(k=>{const x=o[k];if(!x||!x.n)return;const y=cln(x),kk=ky(y.n),c=P[kk];if(kk!=='__proto__'&&(!c||y.w+y.l>c.w+c.l)){P[kk]=y;n++}});")
p = rep(p, "a.download='picklestack-players.json'", "a.download='queuezerotwo-players.json'")
# 3. UI polish: say why Send is disabled, align the FAQ with the page
h = rep(h, "$('go').disabled=ix.length<4||!S.courts.some(c=>!c.isActive)}",
 "const g=$('go');g.disabled=ix.length<4||!S.courts.some(c=>!c.isActive);let gh=$('gh');if(!gh){gh=document.createElement('p');gh.id='gh';gh.className='text-xs text-gray-400 text-center mt-2';g.after(gh)}gh.textContent=!g.disabled?'':ix.length<4?'Add '+(4-ix.length)+' more player'+(4-ix.length>1?'s':'')+' to start.':'All courts are busy. Finish a match first.'}")
h = rep(h, '<section id="faq" aria-labelledby="faq-h" class="max-w-3xl mx-auto px-4 py-10">', '<section id="faq" aria-labelledby="faq-h" class="container mx-auto px-4 py-10">')
h = rep(h, '<div class="space-y-3 text-sm">', '<div class="space-y-3 text-sm max-w-3xl">')
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('profiles.js').write_text(p, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
