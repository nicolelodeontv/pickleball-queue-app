from pathlib import Path
import sys
err=[]
def rep(s,o,n):
    c=s.count(o)
    if c!=1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o,n)
h=Path('index.html').read_text(encoding='utf-8')
# header toggle (hidden unless the device can vibrate)
h=rep(h,'<button id="tsb" onclick="tts()" title="Voice announcements" class="bg-dark-700 rounded-lg w-10 h-10"></button>',
 '<button id="tsb" onclick="tts()" title="Voice announcements" class="bg-dark-700 rounded-lg w-10 h-10"></button><button id="hpb" onclick="hapT()" title="Vibration" hidden class="bg-dark-700 rounded-lg w-10 h-10"></button>')
# helpers
h=rep(h,"function snd(){S.snd=!son();save();sndUi();beep(880,.12)}",
"""function snd(){S.snd=!son();save();sndUi();beep(880,.12)}
/* Haptics: Android/Chromium only (iOS Safari has no Vibration API). Off when the device asks for reduced motion. */
const hapOk=!!navigator.vibrate&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
function hap(p){if(hapOk&&S.hap!==false){try{navigator.vibrate(p)}catch(e){}}}
function hapUi(){const b=$('hpb');if(!b)return;b.hidden=!hapOk;b.setAttribute('aria-pressed',String(S.hap!==false));b.innerHTML='<i class="fa-solid fa-mobile-screen-button '+(S.hap!==false?'text-green-400':'text-gray-400')+'"></i>'}
function hapT(){S.hap=S.hap===false;save();hapUi();hap(20);toast('Vibration '+(S.hap===false?'off':'on'),'info')}""")
h=rep(h,"if(b<0&&win(c.score,S.target)>=0){beep(1000,.35);callWin(c)}","if(b<0&&win(c.score,S.target)>=0){beep(1000,.35);hap([40,60,40]);callWin(c)}else hap(8);")
h=rep(h,"push(c);beep(660,.2);callMatch(c);","push(c);beep(660,.2);hap(25);callMatch(c);")
h=rep(h,"function render(){sndUi();ttsUi();","function render(){sndUi();ttsUi();hapUi();")
h=rep(h,"R.snd=s.snd!==false;","R.snd=s.snd!==false;R.hap=s.hap!==false;")
h=rep(h,"const k={snd:S.snd,tts:S.tts,","const k={snd:S.snd,hap:S.hap,tts:S.tts,")
if err: sys.exit('NOTHING WRITTEN:\n  - '+'\n  - '.join(err))
Path('index.html').write_text(h,encoding='utf-8'); print('ok')
