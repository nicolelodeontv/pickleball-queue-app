#!/usr/bin/env python3
"""
PickleStack -> QueueZeroTwo rebrand, in one pass.

Run from the repo root (the folder holding index.html, sw.js, manifest.webmanifest):

    python3 rebrand.py --brand ./brand --domain https://queuezerotwo.app
    python3 rebrand.py --dry-run            # check every anchor, write nothing
    python3 rebrand.py --move-notice        # also add the "we have moved" dialog for the old .vercel.app URL

Every replacement must match exactly the expected number of times. If any anchor
is off, NOTHING is written and the script lists what did not match.
Run it once on a clean git state (git diff shows the result, git checkout undoes it).
"""
import argparse, shutil, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--domain', default='https://queuezerotwo.app')
ap.add_argument('--brand', default='brand', help='folder with favicon.svg, icon-*.png, apple-touch-icon.png, og.png')
ap.add_argument('--move-notice', action='store_true')
ap.add_argument('--dry-run', action='store_true')
a = ap.parse_args()
D = a.domain.rstrip('/')
HOST = D.split('://', 1)[-1]
errors = []

def rep(s, old, new, count=1):
    n = s.count(old)
    ok = (n >= 1) if count is None else (n == count)
    if not ok:
        errors.append(f'{old[:70]!r}: expected {"1+" if count is None else count}, found {n}')
        return s
    return s.replace(old, new)

# ------------------------------------------------------------------ index.html
p = Path('index.html')
if not p.exists():
    sys.exit('index.html not found. Run this from the repo root.')
s = p.read_text(encoding='utf-8')

# 1. Name and copy
s = rep(s, '<title>PickleStack - Free Pickleball Paddle Stacking & Queue App</title>',
           '<title>QueueZeroTwo - Free Pickleball Queue & Court Rotation App</title>')
s = rep(s, 'Pickle<span class="text-pickle-500">Stack</span>', 'Queue<span class="text-pickle-500">ZeroTwo</span>')
s = rep(s, "T('PICKLESTACK'", "T('QUEUEZEROTWO'")
s = rep(s, "' · pickle-stack-app.vercel.app'", "' · '+location.host")
s = rep(s, 'picklestack-results', 'queuezerotwo-results')
s = rep(s, 'picklestack-backup-', 'queuezerotwo-backup-')

# 2. Head: favicon, canonical, share tags
s = rep(s, '<meta name="theme-color" content="#0B0F19">',
 '<meta name="theme-color" content="#0B0F19">\n'
 '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
 f'<link rel="canonical" href="{D}/">\n'
 '<meta property="og:site_name" content="QueueZeroTwo">\n'
 f'<meta property="og:url" content="{D}/">\n'
 f'<meta property="og:image" content="{D}/og.png">\n'
 '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
 '<meta name="twitter:card" content="summary_large_image">')

# 3. Import hardening
s = rep(s, 'R.snd=!!s.snd;', 'R.snd=s.snd!==false;')
s = rep(s, "R.rest=s.rest&&typeof s.rest==='object'?JSON.parse(JSON.stringify(s.rest)):{};",
 "const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{},clean=(src,f)=>{const o={};Object.keys(obj(src)).slice(0,2000).forEach(k=>{const v=f(src[k]);if(v)o[String(k).toLowerCase().slice(0,60)]=v});return o};\n"
 "  R.rest=clean(s.rest,v=>v?1:0);")
s = rep(s, "R.lv=s.lv&&typeof s.lv==='object'?JSON.parse(JSON.stringify(s.lv)):{};",
 "R.lv=clean(s.lv,v=>Math.min(6,Math.max(0,Math.floor(Number(v))||0)));")
s = rep(s, "R.gp=s.gp&&typeof s.gp==='object'?JSON.parse(JSON.stringify(s.gp)):{};",
 "R.gp=clean(s.gp,v=>Math.max(0,Math.floor(Number(v))||0));")
s = rep(s, '.slice(0,5000).map(x=>String(x)).filter(Boolean)',
           '.slice(0,5000).map(x=>String(x).trim().slice(0,40)).filter(Boolean)', count=2)
s = rep(s, "R.ended=!!s.ended;R.rid='';delete R.sid;delete R.sh;",
 "R.rid='';delete R.sid;delete R.sh;\n"
 "  R.courts.forEach(c=>{if(!c.isActive||c.players.length!==4)Object.assign(c,{isActive:false,players:[],score:[0,0],mid:'',t:0})});")

# 4. Retired #m= match links (live_matches is locked down)
s = rep(s, 'function renderViewer(){let s=V;',
 "function renderViewer(){if(V&&V.code){$('viewer').innerHTML='<div class=\"bg-dark-800 border border-dark-700 rounded-2xl p-8 text-center\"><p class=\"text-gray-300\">This match link is no longer supported.</p><p class=\"text-xs text-gray-400 mt-2\">Ask the organizer for a new Live View link.</p></div>';return}let s=V;")
s = rep(s, 'if(V&&V.code&&sb){', 'if(false){')

# 5. Contrast (white text on red-500 / blue-500 / orange-500 fails AA at small sizes)
s = rep(s, "bD='px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white", "bD='px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white")
s = rep(s, '<button id="rs" class="bg-red-500 hover:bg-red-600 text-white', '<button id="rs" class="bg-red-600 hover:bg-red-700 text-white')
s = rep(s, "'Team 1','bg-blue-500','bg-blue-500/10'],[t.slice(2),'Team 2','bg-orange-500','bg-orange-500/10']",
           "'Team 1','bg-blue-600','bg-blue-500/10'],[t.slice(2),'Team 2','bg-orange-700','bg-orange-500/10']")

# 6. Each dialog is labelled by its own heading
s = rep(s, 'document.body.append(d);',
 "document.body.append(d);const hh=box.querySelector('h3');if(hh){hh.id=mid+'-t';box.setAttribute('aria-labelledby',hh.id);box.removeAttribute('aria-label')}")

# 7. Optional: one-time notice on the old .vercel.app address
if a.move_notice:
    notice = ("if(location.hostname.endsWith('.vercel.app')&&!V&&!SV){try{if(!sessionStorage.moved){sessionStorage.moved=1;"
      "setTimeout(()=>modal('<div class=\"p-6 text-center\"><h3 class=\"text-xl text-white mb-2\">We have moved</h3>"
      f"<p class=\"text-sm text-gray-400 mb-4\">QueueZeroTwo now lives at {HOST}. Tap Export first to keep your players and history, then Import on the new site.</p>"
      f"<a class=\"'+bP+' inline-block\" href=\"{D}/\">Open the new site</a>"
      "<button data-x class=\"block mx-auto mt-4 text-sm text-gray-400\">Stay for now</button></div>'),1200)}}catch(e){}}")
    s = rep(s, 'if(S.ended&&!V&&!SV)showRes();', 'if(S.ended&&!V&&!SV)showRes();\n' + notice)

# 8. Everything left that still says PickleStack (meta tags, footer, titles, strings). Keep last.
s = rep(s, 'PickleStack', 'QueueZeroTwo', count=None)
index_out = s

# ------------------------------------------------------------------ sw.js
sw_p = Path('sw.js'); sw_out = None
if sw_p.exists():
    w = sw_p.read_text(encoding='utf-8')
    w = rep(w, 'PickleStack service worker', 'QueueZeroTwo service worker')
    w = rep(w, "const V = 'picklestack-v2';", "const V = 'queuezerotwo-v1';")
    w = rep(w, "'/manifest.webmanifest', '/icon-192.png'", "'/manifest.webmanifest', '/favicon.svg', '/icon-192.png'")
    sw_out = w
else:
    errors.append('sw.js not found')

# ------------------------------------------------------------------ manifest
MANIFEST = '''{
  "id": "/",
  "name": "QueueZeroTwo",
  "short_name": "QueueZeroTwo",
  "description": "Pickleball queue, live scoring and court rotation for open play.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0B0F19",
  "theme_color": "#0B0F19",
  "categories": ["sports"],
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
'''

# ------------------------------------------------------------------ assets
brand = Path(a.brand)
assets = ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og.png']
for f in assets:
    if not (brand / f).exists():
        errors.append(f'missing brand asset: {brand / f}')

if errors:
    print('NOTHING WRITTEN. Fix these first:')
    for e in errors: print('  -', e)
    sys.exit(1)

if a.dry_run:
    print('Dry run OK: every anchor matched. Nothing written.')
    sys.exit(0)

p.write_text(index_out, encoding='utf-8')
if sw_out is not None: sw_p.write_text(sw_out, encoding='utf-8')
Path('manifest.webmanifest').write_text(MANIFEST, encoding='utf-8')
for f in assets: shutil.copy(brand / f, f)
shutil.copy(brand / 'icon-512.png', 'icon-maskable-512.png')
print('Done: index.html, sw.js, manifest.webmanifest updated; brand assets copied (incl. icon-maskable-512.png).')
print('Next: git diff, test import/export, then push.')
