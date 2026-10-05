# QueueZeroTwo release 1. Run from the repo root: python3 release1.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1:
        err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
SEL = 'class="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white"'
# 1. win-by setting
h = rep(h, "Math.abs(s[0]-s[1])>=2?(s[0]>s[1]?0:1):-1;", "Math.abs(s[0]-s[1])>=(S.wb===1?1:2)?(s[0]>s[1]?0:1):-1;")
h = rep(h, "First to ${S.target}, win by 2</p>", "First to ${S.target}, win by ${S.wb===1?1:2}</p>")
h = rep(h, "R.target=[11,15,21].includes(+s.target)?+s.target:11;", "R.target=[11,15,21].includes(+s.target)?+s.target:11;R.wb=s.wb===1?1:2;R.courts=R.courts.slice(0,Math.max(1,Math.min(8,s.courts.length)));")
# 2. controls for win-by and court count
h = rep(h, '<div class="flex items-center gap-4 text-xs text-gray-400">', '<div class="flex flex-wrap items-center gap-4 text-xs text-gray-400">')
h = rep(h, '<button id="rs" class="bg-red-600', f'<label>Win by <select id="wbs" {SEL}><option>1</option><option>2</option></select></label><label>Courts <select id="ncs" {SEL}>' + ''.join(f'<option>{i}</option>' for i in range(1, 9)) + '</select></label><button id="rs" class="bg-red-600')
h = rep(h, "$('tg').value=S.target;renderWaiting();", "$('tg').value=S.target;$('wbs').value=S.wb===1?1:2;$('ncs').value=S.courts.length;renderWaiting();")
h = rep(h, "$('tg').onchange=e=>{S.target=+e.target.value;save();render()};", "$('tg').onchange=e=>{S.target=+e.target.value;save();render()};\n$('wbs').onchange=e=>{S.wb=+e.target.value;save();render()};$('ncs').onchange=e=>setCourts(+e.target.value);")
h = rep(h, "const k={snd:S.snd,hap:S.hap,tts:S.tts,md:S.md,ws:S.ws,wl:S.wl,eq:S.eq,target:S.target};S=Object.assign(mk(),k);", "const nc=S.courts.length,k={snd:S.snd,hap:S.hap,tts:S.tts,md:S.md,ws:S.ws,wl:S.wl,eq:S.eq,target:S.target,wb:S.wb};S=Object.assign(mk(),k);setCourts(nc);")
# 3. new functions: courts, undo, wake lock
NEW = r"""/* Release 1: court count, undo, wake lock, demo */
function setCourts(n){n=Math.max(1,Math.min(8,n|0));const cs=S.courts;
if(n<cs.length){const busy=cs.slice(n).find(c=>c.isActive);if(busy){$('ncs').value=cs.length;return toast('Finish or cancel the match on '+busy.name+' first.','error')}cs.length=n}
else while(cs.length<n){const id=cs.length+1;cs.push({id,name:'Court '+id,isActive:false,players:[],score:[0,0],mid:'',t:0})}
save();render()}
function undoOffer(snap){const after=JSON.stringify(S);if(snap===after)return;const t=document.createElement('div');
t.className='mb border px-4 py-3 rounded-lg shadow-xl pointer-events-auto text-sm font-medium bg-dark-700 border-dark-700 flex items-center justify-between gap-3';
t.innerHTML='<span>Match logged.</span><button class="rounded-lg bg-pickle-500 text-dark-900 font-bold px-3 py-1.5">Undo</button>';
t.querySelector('button').onclick=()=>{t.remove();if(JSON.stringify(S)!==after)return toast('Too late to undo: things have changed.','error');S=JSON.parse(snap);save();render();toast('Finish undone','success')};
$('msg').append(t);setTimeout(()=>t.remove(),8000)}
let WL=null;
async function wake(){try{if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return;const on=S.courts.some(c=>c.isActive);
if(on&&!WL){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}else if(!on&&WL){await WL.release();WL=null}}catch(e){WL=null}}
document.addEventListener('visibilitychange',wake);
function demo(){S.waiting=[];S.queue=['Ana','Ben','Cara','Dan','Eli','Fay','Gus','Hana'];S.lv={ana:3,ben:3,cara:4,dan:2,eli:3,fay:4,gus:2,hana:3};save();render();toast('Demo players added. Tap Send next 4 to court.','success')}

/* Controls */"""
h = rep(h, "/* Controls */", NEW)
h = rep(h, "function fin(id){buzz([40,60,40]);", "function fin(id){const snap=JSON.stringify(S);fin0(id);undoOffer(snap)}\nfunction fin0(id){buzz([40,60,40]);")
h = rep(h, "renderLog();nav(NV);a11y()}", "renderLog();nav(NV);a11y();wake()}")
# 4. demo button on the empty state
h = rep(h, '<p class="text-sm">Stack is empty. Add players above.</p></div>', '<p class="text-sm">Stack is empty. Add players above.</p></div>\n<div id="dm" class="text-center pb-4"><button onclick="demo()" class="bg-pickle-500 hover:bg-pickle-400 text-dark-900 font-bold rounded-lg px-4 py-2 text-sm">Try a demo</button><p class="text-xs text-gray-400 mt-3">1. Add players &nbsp; 2. Send 4 to court &nbsp; 3. Tap +1 to score</p></div>')
h = rep(h, "$('qe').style.display=S.queue.length?'none':'flex';", "$('qe').style.display=S.queue.length?'none':'flex';$('dm').style.display=S.queue.length||S.waiting.length||S.log.length?'none':'block';")
# 5. copy, FAQ, privacy, analytics
h = rep(h, '<meta name="keywords" content="pickleball, paddle stacking, queue management, court rotation, open play, pickleball scoring, match log">\n', '')
h = rep(h, 'QUEUE, SCORES & LOG</p>', 'PICKLEBALL QUEUE & COURT ROTATION</p>')
h = rep(h, 'Players can scan the QR code or open the link to watch courts, Up Next, the stack and leaderboard in real time.', 'Players can scan the QR code or open the link to watch courts, Up Next, the stack and leaderboard in real time. Player names and scores are visible to anyone with the link, and the session expires after 7 days.')
h = rep(h, '&copy; 2026 QueueZeroTwo App. <i class="fa-solid fa-bolt text-pickle-500"></i> Your session stays on this device. Share a Live View for players, or End session for a results link.', '&copy; 2026 QueueZeroTwo. <i class="fa-solid fa-bolt text-pickle-500"></i> Pickleball queue &amp; court rotation. Your session stays on this device. Live View shares player names and scores with anyone who has the link, and expires after 7 days.')
def qa(q, a): return f'<details class="bg-dark-800 border border-dark-700 rounded-lg p-4"><summary class="cursor-pointer font-medium text-white">{q}</summary><p class="mt-2 text-gray-400">{a}</p></details>'
FAQ = ('<section id="faq" aria-labelledby="faq-h" class="max-w-3xl mx-auto px-4 py-10"><h2 id="faq-h" class="text-xl font-bold text-white mb-2">How pickleball paddle stacking works</h2>'
 '<p class="text-sm text-gray-400 mb-6">Paddle stacking keeps open play fair: players line up, and the next four take the next free court.</p><div class="space-y-3 text-sm">'
 + qa('What is paddle stacking?', 'Players leave their paddles in a line at the court. When a game ends, the next four paddles in line go on, and the finished players return to the back.')
 + qa('How does QueueZeroTwo run the rotation?', 'Add players to the stack, send the next four to a free court, and score the match. You can balance teams by skill or mix partners socially, and cap winning streaks so everyone gets court time.')
 + qa('Do players need an account?', 'No. Your session is saved on your device. Live View is optional and gives players a link to follow the queue and scores.')
 + qa('Is it free?', 'Yes. Use Export to back up a session and Import to restore it on another device.')
 + '</div></section>\n')
h = rep(h, '<footer class="bg-dark-900 border-t border-dark-700 py-6 text-center text-sm text-gray-400">', FAQ + '<footer class="bg-dark-900 border-t border-dark-700 py-6 text-center text-sm text-gray-400">')
h = rep(h, "if(S.ended&&!V&&!SV)showRes();", "if(V||SV)$('faq').remove();\nif(S.ended&&!V&&!SV)showRes();")
h = rep(h, '<script src="/profiles.js"></script><!-- profiles -->', '<script src="/profiles.js"></script><!-- profiles -->\n<script defer src="/_vercel/insights/script.js"></script>')
# 6. service worker cache bump
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
