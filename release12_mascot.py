#!/usr/bin/env python3
"""Release 12: add the penguin mascot to QueueZeroTwo.

Run from the repo root, on a clean tree, with mascot.js and the mascots/ folder
sitting next to this script:   python3 release12_mascot.py [--dry-run]

Edits (all or nothing, nothing is written unless every check passes):
  index.html   adds <script src="/mascot.js" defer></script> before </body>
  sw.js        bumps the cache version and adds the 3 new files to the precache list
  mascot.js    copied to the repo root
  mascots/     the two trimmed penguin sheets copied in
No Tailwind rebuild needed: the mascot styles itself through the DOM.
"""
import re, shutil, sys
from pathlib import Path

DRY = '--dry-run' in sys.argv
HERE = Path(__file__).resolve().parent
ROOT = Path.cwd()
TAG = '<script src="/mascot.js" defer></script>'
FILES = ['/mascot.js', '/mascots/penguin-directions.webp', '/mascots/penguin-reactions.webp']

def die(msg):
    print('ABORT:', msg); sys.exit(1)

idx, sw = ROOT / 'index.html', ROOT / 'sw.js'
for f in (idx, sw):
    if not f.exists(): die(f'{f.name} not found. Run from the repo root.')
for src in [HERE / 'mascot.js', HERE / 'mascots' / 'penguin-directions.webp', HERE / 'mascots' / 'penguin-reactions.webp']:
    if not src.exists(): die(f'missing {src}')

html = idx.read_text(encoding='utf-8')
if 'mascot.js' in html:
    print('index.html already loads mascot.js, skipping that edit.'); new_html = html
else:
    if html.count('</body>') != 1: die(f'expected one </body>, found {html.count("</body>")}')
    new_html = html.replace('</body>', TAG + '\n</body>')
if 'footer' not in html: die('index.html has no <footer>; the mascot mounts above it.')

sws = sw.read_text(encoding='utf-8')
new_sw, notes = sws, []
m = re.search(r"(queuezerotwo-v)(\d+)", sws)
if not m: die('cache name queuezerotwo-vN not found in sw.js')
if 'mascot.js' not in sws:
    new_sw = new_sw.replace(m.group(0), m.group(1) + str(int(m.group(2)) + 1), 1)
    pm = list(re.finditer(r"(['\"])/profiles\.js\1", new_sw))
    if len(pm) == 1:
        q = pm[0].group(1)
        add = ',' + ','.join(f'{q}{u}{q}' for u in FILES)
        new_sw = new_sw[:pm[0].end()] + add + new_sw[pm[0].end():]
        notes.append('precache list updated')
    else:
        notes.append("WARNING: could not find '/profiles.js' once in sw.js. Add these to the precache list by hand: " + ', '.join(FILES))
    notes.append(f'cache version v{m.group(2)} -> v{int(m.group(2)) + 1}')

print('index.html:', 'edit' if new_html != html else 'unchanged')
print('sw.js:', '; '.join(notes) if notes else 'unchanged')
if DRY:
    print('Dry run OK, nothing written.'); sys.exit(0)

(idx).write_text(new_html, encoding='utf-8')
sw.write_text(new_sw, encoding='utf-8')
shutil.copy2(HERE / 'mascot.js', ROOT / 'mascot.js')
(ROOT / 'mascots').mkdir(exist_ok=True)
for n in ('penguin-directions.webp', 'penguin-reactions.webp'):
    shutil.copy2(HERE / 'mascots' / n, ROOT / 'mascots' / n)
print('Done. Check git diff, run the suite, commit and push.')
