# QueueZeroTwo release 4: move the FAQ into a "How it works" popup opened from the header. Run from repo root: python3 release4_faq.py [--dry-run]
from pathlib import Path
import re, sys
err = []
def rep(s, o, n):
    c = s.count(o)
    if c != 1: err.append(f'{o[:70]!r}: expected 1, found {c}'); return s
    return s.replace(o, n)
h = Path('index.html').read_text(encoding='utf-8')
h = rep(h, '<section id="faq" aria-labelledby="faq-h" class="container mx-auto px-4 py-10">',
 '<dialog id="faq" aria-labelledby="faq-h" class="m-auto w-[92vw] max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-dark-700 bg-dark-900 p-6 text-gray-300 backdrop:bg-black/70">')
h = rep(h, '</div></section>\n<footer class="bg-dark-900 border-t border-dark-700 py-6 text-center text-sm text-gray-400">',
 '</div><form method="dialog" class="mt-6 text-right"><button class="rounded-lg bg-dark-700 hover:bg-dark-800 border border-dark-700 text-gray-200 px-4 py-2 text-sm">Close</button></form></dialog>\n<footer class="bg-dark-900 border-t border-dark-700 py-6 text-center text-sm text-gray-400">')
h = rep(h, '<button id="exp" type="button"', '<button onclick="openFaq()" title="How it works" class="bg-dark-700 hover:bg-pickle-500 hover:text-dark-900 rounded-lg w-10 h-10"><i class="fa-solid fa-circle-question"></i></button><button id="exp" type="button"')
h = rep(h, 'and expires after 7 days.', 'and expires after 7 days. <button onclick="openFaq()" class="underline hover:text-white">How it works</button>')
h = rep(h, '/* Release 2b: named sessions and history */', "/* Release 4: How it works popup */\nfunction openFaq(){const d=$('faq');if(d&&d.showModal)d.showModal()}\nif($('faq'))$('faq').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});\n\n/* Release 2b: named sessions and history */")
w = Path('sw.js').read_text(encoding='utf-8')
m = re.search(r"const V = 'queuezerotwo-v(\d+)';", w)
if not m: err.append('sw.js: cache name not found')
else: w = w.replace(m.group(0), f"const V = 'queuezerotwo-v{int(m.group(1))+1}';")
if err: sys.exit('NOTHING WRITTEN:\n  - ' + '\n  - '.join(err))
if '--dry-run' in sys.argv: sys.exit('Dry run OK: all anchors matched once.')
Path('index.html').write_text(h, encoding='utf-8'); Path('sw.js').write_text(w, encoding='utf-8'); print('ok')
