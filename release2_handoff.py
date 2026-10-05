# QueueZeroTwo release 2a: host handoff. Run from repo root: python3 release2_handoff.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
h = rep(h, """<button class="op '+bS+'">Open view</button></div><button data-x class="mt-4 text-sm text-gray-400 hover:text-white">Close</button></div>');""",
 """<button class="op '+bS+'">Open view</button></div><button class="ho mt-3 text-xs text-gray-400 underline">Move host to another device</button><br><button data-x class="mt-3 text-sm text-gray-400 hover:text-white">Close</button></div>');""")
h = rep(h, "d.querySelector('.op').onclick=()=>window.open(url,'_blank','noopener,noreferrer')",
 "d.querySelector('.op').onclick=()=>window.open(url,'_blank','noopener,noreferrer');d.querySelector('.ho').onclick=()=>{d.__close();handoff()}")
h = rep(h, "if(S.ended)return showRes();", "if(S.ended)return showRes();S.ho=false;")
h = rep(h, "if(q.error&&/Invalid host key|expired session/i.test(q.error.message||'')){",
 "if(q.error&&S.hoff&&Date.now()-S.hoff<864e5&&/Invalid host key/i.test(q.error.message||'')){S.hoff=0;S.ho=true;S.sid='';S.sh='';toast('Live View host moved to another device.','info');return {error:new Error('handed off')}}\nif(q.error&&/Invalid host key|expired session/i.test(q.error.message||'')){")
h = rep(h, "function pushS(){if(!sb||S.ended)return;", "function pushS(){if(!sb||S.ended||S.ho)return;")
NEW = r"""/* Release 2a: host handoff (key travels only in the URL fragment) */
function handoff(){ensureLiveIdentity();
const w=modal('<div class="p-6 text-center"><h3 class="text-xl text-white mb-2">Move host to another device</h3><p class="text-sm text-gray-300 mb-2">Anyone who scans the next code can control this session until it expires.</p><p class="text-xs text-gray-400 mb-4">Only show it on your own screen. The other device becomes the host and this one stops publishing. To keep your stack and courts, Import a backup on the other device before scanning.</p><div class="flex gap-3"><button data-x class="flex-1 '+bS+'">Cancel</button><button class="y flex-1 '+bP+'">Show code</button></div></div>');
w.querySelector('.y').onclick=()=>{w.__close();S.hoff=Date.now();save();
const u=location.origin+location.pathname+'#h='+S.sid+'.'+S.sh;
const d=modal('<div class="p-6 text-center"><h3 class="text-xl text-white mb-2">Scan on the new host</h3><div class="qrb bg-white p-3 rounded-xl mx-auto" style="width:220px;max-width:100%">'+qrSvg(u)+'</div><p class="text-xs text-gray-400 mt-3">This closes in 2 minutes.</p><button data-x class="mt-4 w-full '+bS+'">Done</button></div>');
setTimeout(()=>{if(d.isConnected)d.__close()},12e4)}}
function takeover(){const m=/^#h=([A-Za-z0-9]{4,10})\.([0-9a-f]{64})$/.exec(location.hash);if(!m)return;history.replaceState(null,'',location.pathname+location.search);
ask('Take over this Live View?',"This device becomes the host and the other device stops publishing. Viewers will see this device's stack and courts.",async()=>{
if(!sb)return toast('Live View needs Supabase.','error');const nk=randHostKey(),q=await sb.rpc('rotate_pickle_host_key',{p_code:m[1],p_old_key:m[2],p_new_key:nk});
if(q.error)return toast('Handoff failed: '+q.error.message,'error');S.sid=m[1];S.sh=nk;S.ho=false;S.hoff=0;save();render();toast('This device is now the host','success')})}

/* Release 1: court count"""
h = rep(h, "/* Release 1: court count", NEW)
h = rep(h, "if(V||SV)$('faq').remove();", "if(V||SV)$('faq').remove();\ntakeover();")
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
