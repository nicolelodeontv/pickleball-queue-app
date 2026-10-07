# QueueZeroTwo release 7: side menu with names + hamburger that collapses/expands it. Run from repo root: python3 release7_menu_labels.py [--dry-run]
# Replaces whatever initMenu() is currently in index.html (release 5 or 6).
from pathlib import Path
import re, sys
err = []
h = Path('index.html').read_text(encoding='utf-8')
CSS = ("#qmenu button{display:flex;align-items:center;gap:.75rem;width:100%;height:auto;min-height:44px;padding:.5rem .75rem;text-align:left;font-size:.875rem;color:inherit;background:transparent;border:0;border-radius:.5rem}"
 "#qmenu button:hover{background:rgba(148,163,184,.18)}#qmenu button[hidden]{display:none}#qmenu button::after{content:attr(title)}#qmenu button span{display:none}#qmenu button i{width:1.25rem;text-align:center;flex:none}"
 "#qmenu{display:none;position:fixed;left:0;top:0;bottom:0;width:16rem;max-width:80vw;overflow-y:auto;z-index:60;padding:1rem .5rem;border-right:1px solid}#qmenu.open{display:block}"
 "#qscrim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:55}#qscrim[hidden]{display:none}"
 "@media(min-width:1024px){#qscrim{display:none!important}#qmenu{display:flex!important;flex-direction:column;align-items:stretch;gap:.25rem;top:5rem;width:3.5rem;max-width:none;padding:.5rem;z-index:20;transition:width .15s}"
 "#qmenu button{justify-content:center;padding:0;min-height:2.5rem}#qmenu button::after{display:none}"
 "#qmenu.wide{width:14rem;box-shadow:4px 0 16px rgba(0,0,0,.25)}#qmenu.wide button{justify-content:flex-start;padding:0 .75rem}#qmenu.wide button::after{display:inline}"
 "#qmenu #mnb{margin-bottom:.25rem;border-bottom:1px solid rgba(148,163,184,.25);border-radius:.5rem .5rem 0 0}}"
 "@media(min-width:1024px) and (max-width:1699px){main.container{padding-left:4.5rem}footer{padding-left:3.5rem}}"
 "@media(min-width:1280px) and (max-width:1999px){body.qw main.container{padding-left:15rem}body.qw footer{padding-left:14rem}}")
FN = r"""function initMenu(){const live=document.querySelector('button[onclick="live()"]'),bar=live&&live.parentElement;if(!bar||$('mnb'))return;
const st=document.createElement('style');st.textContent='__CSS__';document.head.append(st);
const mb=document.createElement('button');mb.id='mnb';mb.type='button';mb.title='Menu';mb.setAttribute('aria-label','Menu');mb.setAttribute('aria-controls','qmenu');mb.setAttribute('aria-expanded','false');
mb.className='bg-dark-700 hover:bg-pickle-500 hover:text-dark-900 rounded-lg w-10 h-10';mb.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';
const m=document.createElement('nav');m.id='qmenu';m.setAttribute('aria-label','Menu');m.className='bg-dark-800 border-dark-700';
const sc=document.createElement('div');sc.id='qscrim';sc.hidden=true;
const short={exp:'Export backup',impbtn:'Import backup'};
['button[title="Players"]','button[onclick="stand()"]','button[onclick="hist()"]','#snb','#hpb','#thb','#tsb','button[onclick="openFaq()"][title]','#exp','#impbtn'].forEach(q=>{const b=bar.querySelector(q);if(b){if(short[b.id])b.title=short[b.id];m.append(b)}});
const mq=matchMedia('(min-width:1024px)'),logo=bar.previousElementSibling||bar,K='qz2menu',isOpen=()=>m.classList.contains('open');
let wide=null;try{wide=localStorage.getItem(K)}catch(e){}
wide=wide===null?innerWidth>=1280:wide==='1';
const paint=()=>{m.classList.toggle('wide',wide);document.body.classList.toggle('qw',wide);mb.setAttribute('aria-expanded',String(mq.matches?wide:isOpen()))};
const place=()=>{mq.matches?m.prepend(mb):logo.prepend(mb);paint()};
const open=()=>{m.classList.add('open');sc.hidden=false;paint()};
const close=()=>{m.classList.remove('open');sc.hidden=true;paint()};
mb.onclick=()=>{if(mq.matches){wide=!wide;try{localStorage.setItem(K,wide?'1':'0')}catch(e){}paint()}else isOpen()?close():open()};
sc.onclick=close;
m.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!mq.matches&&!['snb','hpb','thb','tsb'].includes(b.id))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){close();mb.focus()}});
mq.addEventListener('change',()=>{close();place()});
document.body.append(sc,m);place()}
""".replace('__CSS__', CSS)
if h.count('function initMenu(){') != 1: err.append(f"initMenu: expected 1, found {h.count('function initMenu(){')}")
pat = re.compile(r"function initMenu\(\)\{.*?\n(?=setTimeout\(initMenu,0\);)", re.S)
if len(pat.findall(h)) != 1: err.append('initMenu body: pattern did not match exactly once')
else: h = pat.sub(lambda _: FN, h)
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: initMenu found once and replaceable.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
