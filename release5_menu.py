# QueueZeroTwo release 5: collapse the header icons into one Menu button. Run from repo root: python3 release5_menu.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
NEW = r"""/* Release 5: header menu (Live View stays visible, everything else lives in the menu) */
function initMenu(){const live=document.querySelector('button[onclick="live()"]'),bar=live&&live.parentElement;if(!bar||$('mnb'))return;
const st=document.createElement('style');st.textContent='#mnw{position:relative}#qmenu{position:absolute;right:0;top:100%;margin-top:.5rem;width:16rem;max-width:calc(100vw - 1.5rem);max-height:75vh;overflow-y:auto;z-index:50;padding:.5rem}#qmenu[hidden]{display:none}#qmenu button{display:flex;align-items:center;gap:.75rem;width:100%;height:auto;min-height:44px;padding:.5rem .75rem;text-align:left;font-size:.875rem;color:inherit;background:transparent;border:0;border-radius:.5rem}#qmenu button:hover{background:rgba(148,163,184,.18)}#qmenu button[hidden]{display:none}#qmenu button::after{content:attr(title)}#qmenu button span{display:none}#qmenu button i{width:1.25rem;text-align:center}';document.head.append(st);
const w=document.createElement('div');w.id='mnw';
const mb=document.createElement('button');mb.id='mnb';mb.type='button';mb.title='Menu';mb.setAttribute('aria-label','Menu');mb.setAttribute('aria-haspopup','true');mb.setAttribute('aria-expanded','false');
mb.className='bg-dark-700 hover:bg-pickle-500 hover:text-dark-900 rounded-lg w-10 h-10';mb.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';
const m=document.createElement('div');m.id='qmenu';m.hidden=true;m.className='bg-dark-800 border border-dark-700 rounded-xl shadow-2xl';
const short={exp:'Export backup',impbtn:'Import backup'};
['button[title="Players"]','button[onclick="stand()"]','button[onclick="hist()"]','#snb','#hpb','#thb','#tsb','button[onclick="openFaq()"][title]','#exp','#impbtn'].forEach(q=>{const b=bar.querySelector(q);if(b){if(short[b.id])b.title=short[b.id];m.append(b)}});
const close=()=>{m.hidden=true;m.style.transform='';mb.setAttribute('aria-expanded','false')};
mb.onclick=e=>{e.stopPropagation();if(!m.hidden)return close();m.hidden=false;mb.setAttribute('aria-expanded','true');const r=m.getBoundingClientRect();if(r.left<8)m.style.transform='translateX('+(8-r.left)+'px)';else if(r.right>innerWidth-8)m.style.transform='translateX('+(innerWidth-8-r.right)+'px)'};
m.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!['snb','hpb','thb','tsb'].includes(b.id))close()});
document.addEventListener('click',e=>{if(!m.hidden&&!w.contains(e.target))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.hidden){close();mb.focus()}});
w.append(mb,m);bar.append(w)}
setTimeout(initMenu,0);

/* Release 4: How it works popup */"""
h = rep(h, "/* Release 4: How it works popup */", NEW)
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
