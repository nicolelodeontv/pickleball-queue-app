# QueueZeroTwo release 11: the side menu starts hidden; the hamburger (left of the logo) shows and hides it on every screen size.
# Replaces whatever initMenu() is in index.html (releases 5 to 10), so it can be applied on its own. Run: python3 release11_menu_hidden.py [--dry-run]
from pathlib import Path
import re, sys
err = []
h = Path('index.html').read_text(encoding='utf-8')
CSS = ("#qmenu button{display:flex;align-items:center;gap:.75rem;width:100%;height:auto;min-height:44px;padding:.5rem .75rem;text-align:left;font-size:.875rem;color:inherit;background:transparent;border:0;border-radius:.5rem}"
 "#qmenu button:hover{background:rgba(148,163,184,.18)}#qmenu button[hidden]{display:none}#qmenu button::after{content:attr(title)}#qmenu button span{display:none}#qmenu button i{width:1.25rem;text-align:center;flex:none}"
 "#qmenu{display:none;position:fixed;left:0;top:0;bottom:0;width:16rem;max-width:80vw;overflow-y:auto;z-index:60;padding:1rem .5rem;border-right:1px solid}#qmenu.open{display:block}"
 "#qscrim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:55}#qscrim[hidden]{display:none}"
 "@media(max-width:767px){header>.container{flex-wrap:wrap;row-gap:.5rem}header>.container>:nth-child(2){order:3;width:100%}}"
 "@media(min-width:1024px){#qscrim{display:none!important}#qmenu{top:5rem;width:14rem;max-width:none;padding:.5rem;z-index:20;box-shadow:4px 0 16px rgba(0,0,0,.25)}#qmenu.open{display:flex;flex-direction:column;gap:.25rem}}"
 "@media(min-width:1280px) and (max-width:1999px){body.qw main.container{padding-left:15rem}body.qw footer{padding-left:14rem}}")
FN = r"""function initMenu(){const live=document.querySelector('button[onclick="live()"]'),bar=live&&live.parentElement;if(!bar||$('mnb'))return;
const st=document.createElement('style');st.textContent='__CSS__';document.head.append(st);
const mb=document.createElement('button');mb.id='mnb';mb.type='button';mb.title='Menu';mb.setAttribute('aria-label','Open menu');mb.setAttribute('aria-controls','qmenu');mb.setAttribute('aria-expanded','false');
mb.className='bg-dark-700 hover:bg-pickle-500 hover:text-dark-900 rounded-lg w-10 h-10';mb.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';
const m=document.createElement('nav');m.id='qmenu';m.setAttribute('aria-label','Menu');m.className='bg-dark-800 border-dark-700';
const sc=document.createElement('div');sc.id='qscrim';sc.hidden=true;
const short={exp:'Export backup',impbtn:'Import backup'};
['button[title="Players"]','button[onclick="stand()"]','button[onclick="hist()"]','#exp','#impbtn'].forEach(q=>{const b=bar.querySelector(q);if(b){if(short[b.id])b.title=short[b.id];m.append(b)}});
const mq=matchMedia('(min-width:1024px)'),isOpen=()=>m.classList.contains('open');
const paint=()=>{const o=isOpen();document.body.classList.toggle('qw',o&&mq.matches);mb.setAttribute('aria-expanded',String(o));mb.setAttribute('aria-label',o?'Close menu':'Open menu');sc.hidden=!(o&&!mq.matches)};
const open=()=>{m.classList.add('open');paint()},close=()=>{m.classList.remove('open');paint()};
mb.onclick=()=>isOpen()?close():open();sc.onclick=close;
m.addEventListener('click',e=>{if(e.target.closest('button')&&(!mq.matches||innerWidth<1280))close()});
document.addEventListener('click',e=>{if(mq.matches&&innerWidth<1280&&isOpen()&&!m.contains(e.target)&&!mb.contains(e.target))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){close();mb.focus()}});
mq.addEventListener('change',close);
(bar.previousElementSibling||bar).prepend(mb);document.body.append(sc,m);paint()}
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
