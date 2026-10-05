from pathlib import Path
import sys

DRY = '--dry-run' in sys.argv
p = Path('index.html')
h = p.read_text(encoding='utf-8')
if 'qzt_theme' in h or 'class="sbg' in h:
    sys.exit('Already applied. Nothing written.')
err = []

def rep(s, old, new):
    c = s.count(old)
    if c != 1:
        err.append('%r: expected 1, found %d' % (old[:70], c)); return s
    return s.replace(old, new)

# ---- 1. Head: apply saved theme before first paint, plus the standard PWA meta ----
h = rep(h,
 '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n',
 '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
 '<script>try{if(localStorage.getItem("qzt_theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}</script>\n')
h = rep(h,
 '<meta name="apple-mobile-web-app-capable" content="yes">',
 '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">')

# ---- 2. CSS: tabular numbers + big score buttons ----
h = rep(h, 'html{color-scheme:dark}\n', '''html{color-scheme:dark}
body{font-variant-numeric:tabular-nums}
/* Big score buttons for thumbs outdoors */
.sbg{flex:1 1 0;min-height:3.5rem;border-radius:.75rem;background:#1E293B;color:#fff;font-weight:900;font-size:1.5rem;user-select:none;-webkit-user-select:none}
.sbg:active{transform:scale(.97)}
.sbp{flex:1.6 1 0;background:#334155}
.sbn{flex:none;min-width:4rem;display:flex;align-items:center;justify-content:center;font-size:2.75rem;line-height:1}
@media(hover:hover){.sbg:hover{background:#ccff00;color:#0B0F19}}
''')

# ---- 3. CSS: light theme (plain CSS, no Tailwind rebuild) ----
h = rep(h, '@media(hover:none){.sb:hover{background:#1E293B;color:#fff}}\n',
r'''@media(hover:none){.sb:hover{background:#1E293B;color:#fff}}

/* ===== Light theme: html[data-theme=light] ===== */
html[data-theme=light]{color-scheme:light}
[data-theme=light] body{background:#F4F6FA;color:#0f172a}
[data-theme=light] .bg-dark-800{background-color:#fff}
[data-theme=light] .bg-dark-900{background-color:#EEF2F7}
[data-theme=light] .bg-dark-700,[data-theme=light] .bg-dark-700\/90{background-color:#E2E8F0}
[data-theme=light] .hover\:bg-dark-900:hover{background-color:#CBD5E1}
[data-theme=light] .border-dark-700{border-color:#CBD5E1}
[data-theme=light] .divide-dark-700>:not([hidden])~:not([hidden]){border-color:#CBD5E1}
[data-theme=light] .text-white,[data-theme=light] .text-gray-100,[data-theme=light] .hover\:text-white:hover{color:#0f172a}
[data-theme=light] .text-gray-200{color:#1e293b}
[data-theme=light] .text-gray-300{color:#334155}
[data-theme=light] .text-gray-400{color:#475569}
[data-theme=light] .text-pickle-400,[data-theme=light] .text-pickle-500,[data-theme=light] .hover\:text-pickle-500:hover{color:#4d7c0f}
[data-theme=light] .text-green-300,[data-theme=light] .text-green-400{color:#15803d}
[data-theme=light] .text-red-400,[data-theme=light] .hover\:text-red-400:hover{color:#b91c1c}
[data-theme=light] .text-blue-300,[data-theme=light] .text-blue-400{color:#1d4ed8}
[data-theme=light] .text-orange-400{color:#c2410c}
/* Coloured buttons and labels keep white text (must stay after the text-white rule) */
[data-theme=light] .bg-blue-600,[data-theme=light] .bg-red-600,[data-theme=light] .bg-orange-700,[data-theme=light] .bg-red-500\/90{color:#fff}
[data-theme=light] #sgo{background:#fff}
[data-theme=light] #swt{border-top-color:#CBD5E1}
[data-theme=light] .sb,[data-theme=light] .sbg{background:#E2E8F0;color:#0f172a}
[data-theme=light] .sbp{background:#0f172a;color:#fff}
@media(hover:hover){[data-theme=light] .sb:hover,[data-theme=light] .sbg:hover{background:#ccff00;color:#0B0F19}}
[data-theme=light] :focus-visible{outline-color:#1d4ed8}
[data-theme=light] .focus\:border-pickle-500:focus{border-color:#4d7c0f}
[data-theme=light] *{scrollbar-color:#94a3b8 transparent}
[data-theme=light] ::-webkit-scrollbar-thumb{background:#94a3b8}
''')

# ---- 4. Big score buttons: replace team() (everything up to renderCourts) ----
A, B = 'function team(c,i){', 'function renderCourts(){'
if h.count(A) != 1 or h.count(B) != 1:
    err.append('team()/renderCourts() anchors: %d / %d' % (h.count(A), h.count(B)))
NEW_TEAM = r'''function team(c,i){const w=win(c.score,S.target)==i;
return `<div class="p-3 rounded-xl border ${w?'bg-pickle-500/15 border-pickle-500/50':'bg-dark-900 border-dark-700'}">
<div class="flex items-center justify-between gap-2 mb-2"><div class="min-w-0 truncate font-bold text-gray-100">${nm(c.players,i)${</div><div class="text-[11px] text-gray-400 font-semibold flex-none">Team ${i+1${</div></div>
<div class="flex items-stretch gap-2"><button class="sbg" aria-label="Minus point, Team ${i+1${" onclick="sc(${c.id${,${i${,-1)">−1</button><span class="sbn font-sport ${w?'text-pickle-500':''${">${c.score[i]${</span><button class="sbg sbp" aria-label="Plus point, Team ${i+1${" onclick="sc(${c.id${,${i${,1)">+1</button></div></div>`
'''

# ---- 5. Theme toggle button + JS ----
h = rep(h,
 '<button id="hpb" onclick="hapt()" title="Haptics" class="bg-dark-700 rounded-lg w-10 h-10"></button>',
 '<button id="hpb" onclick="hapt()" title="Haptics" class="bg-dark-700 rounded-lg w-10 h-10"></button>'
 '<button id="thb" onclick="theme()" title="Light or dark theme" class="bg-dark-700 rounded-lg w-10 h-10"></button>')
HAPT = "function hapt(){if(!navigator.vibrate)return;S.hap=S.hap===false;save();hapUi();toast('Haptics '+(S.hap?'on':'off'),'info')}"
h = rep(h, HAPT, HAPT + r'''
const isLight=()=>document.documentElement.dataset.theme==='light';
function themeApply(l){document.documentElement.dataset.theme=l?'light':'dark';const m=document.querySelector('meta[name=theme-color]');if(m)m.content=l?'#F4F6FA':'#0B0F19'}
function themeUi(){const b=$('thb');if(b)b.innerHTML='<i class="fa-solid '+(isLight()?'fa-sun':'fa-moon')+'"></i>'}
function theme(){const l=!isLight();try{localStorage.setItem('qzt_theme',l?'light':'dark')}catch(e){}themeApply(l);themeUi();a11y();toast((l?'Light':'Dark')+' theme','info')}''')
h = rep(h, 'function render(){sndUi();hapUi();ttsUi();', 'function render(){sndUi();hapUi();ttsUi();themeUi();')
h = rep(h, '/* Init + live sync (other tabs on this device update instantly) */\nload();\n',
 "/* Init + live sync (other tabs on this device update instantly) */\nload();\nthemeApply(isLight());\n")

if err:
    sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
s, e = h.index(A), h.index(B)
h = h[:s] + NEW_TEAM + h[e:]
if DRY:
    print('Dry run OK. All anchors matched. Nothing written.')
else:
    p.write_text(h, encoding='utf-8'); print('ok')

