# QueueZeroTwo release 2b: named sessions + past-session history. Run from repo root: python3 release2b_sessions.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
# backup restore keeps history, sanitized
h = rep(h, "R.rid='';delete R.sid;delete R.sh;",
 "R.rid='';delete R.sid;delete R.sh;\n  R.hist=Array.isArray(s.hist)?s.hist.slice(0,30).filter(x=>x&&Array.isArray(x.top)).map(x=>({id:String(x.id||'').slice(0,12),name:String(x.name||'Session').slice(0,40),t:Number(x.t)||0,g:Math.max(0,Number(x.g)||0),top:x.top.slice(0,10).map(p=>({n:String(p&&p.n||'').slice(0,40),w:Math.max(0,+(p&&p.w)||0),l:Math.max(0,+(p&&p.l)||0)}))})):[];")
# name field in results modal, name on share image
h = rep(h, '<h3 class="text-2xl text-white">Session Results</h3>',
 '<h3 class="text-2xl text-white">Session Results</h3><input id="sn" maxlength="40" value="\'+esc(S.name||\'\')+\'" placeholder="Name this session (e.g. Sat 6pm)" aria-label="Session name" class="mt-2 w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white">')
h = rep(h, "d.querySelector('.sh').onclick=shareImg;", "d.querySelector('.sh').onclick=shareImg;d.querySelector('#sn').oninput=e=>{S.name=e.target.value.trim().slice(0,40);save();RF=null;prepImg()};")
h = rep(h, "T('Session Results',W/2,170,34,'#94a3b8','center');", "T(S.name||'Session Results',W/2,170,34,'#94a3b8','center');")
# archive when starting a new session
h = rep(h, "target:S.target,wb:S.wb};S=Object.assign(mk(),k);setCourts(nc);", "target:S.target,wb:S.wb,hist:archive()};S=Object.assign(mk(),k);setCourts(nc);")
# header button
h = rep(h, '<button onclick="stand()" title="Standings"', '<button onclick="hist()" title="Past sessions" class="bg-dark-700 hover:bg-pickle-500 hover:text-dark-900 rounded-lg w-10 h-10"><i class="fa-solid fa-clock-rotate-left"></i></button><button onclick="stand()" title="Standings"')
NEW = r"""/* Release 2b: named sessions and history */
function archive(){const h=(S.hist||[]).slice();if(S.log.length)h.unshift({id:Math.random().toString(36).slice(2,8),name:S.name||new Date().toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}),t:Date.now(),g:S.log.length,top:stats().slice(0,10).map(p=>({n:p.n,w:p.w,l:p.l}))});return h.slice(0,30)}
function hist(){const h=S.hist||[];
const rows=h.length?h.map((x,i)=>'<div class="p-4"><div class="flex justify-between gap-3"><div class="min-w-0"><div class="text-white truncate">'+esc(x.name)+'</div><div class="text-xs text-gray-400">'+new Date(x.t).toLocaleDateString()+' · '+x.g+' games</div></div><button data-del="'+i+'" class="text-xs text-gray-400 hover:text-red-400" aria-label="Delete this session">Delete</button></div><ol class="mt-2 text-sm text-gray-300 space-y-0.5">'+x.top.slice(0,3).map((p,j)=>'<li>'+['🥇','🥈','🥉'][j]+' '+esc(p.n)+' <span class="text-gray-400">'+p.w+'W '+p.l+'L</span></li>').join('')+'</ol></div>').join(''):'<p class="p-6 text-sm text-gray-400 text-center">No past sessions yet. End a session, then tap New session, to save one here.</p>';
const d=modal('<div class="p-5 border-b border-dark-700"><h3 class="text-2xl text-white">Past sessions</h3></div><div class="divide-y divide-dark-700 max-h-[60vh] overflow-y-auto">'+rows+'</div><div class="p-4 border-t border-dark-700"><button data-x class="w-full '+bS+'">Close</button></div>');
d.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>ask('Delete this session?','Its saved results will be removed from this device.',()=>{S.hist.splice(+b.dataset.del,1);save();d.__close();hist()}))}

/* Release 2a: host handoff"""
h = rep(h, "/* Release 2a: host handoff", NEW)
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
