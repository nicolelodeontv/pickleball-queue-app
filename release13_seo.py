#!/usr/bin/env python3
"""Release 13: point canonical and share-image URLs at the live host, add robots.txt and sitemap.xml.

Run from the repo root on a clean tree:
    python3 release13_seo.py [--dry-run] [--host https://queuezerotwo.app]

Default host is https://queuezerotwo.vercel.app. When queuezerotwo.app is registered and
attached to Vercel, run it again with --host https://queuezerotwo.app to switch everything back.
Nothing is written unless every check passes. Safe to run twice.
"""
import re, sys
from pathlib import Path

DRY = '--dry-run' in sys.argv
HOST = 'https://queuezerotwo.vercel.app'
if '--host' in sys.argv:
    try: HOST = sys.argv[sys.argv.index('--host') + 1].rstrip('/')
    except IndexError: sys.exit('ABORT: --host needs a value')
if not re.fullmatch(r'https://[a-z0-9.-]+', HOST): sys.exit('ABORT: host must look like https://example.com')

KNOWN = ['https://queuezerotwo.app', 'https://www.queuezerotwo.app', 'https://queuezerotwo.vercel.app']
ROOT = Path.cwd()
idx = ROOT / 'index.html'
if not idx.exists(): sys.exit('ABORT: index.html not found. Run from the repo root.')

html = idx.read_text(encoding='utf-8')
if len(re.findall(r'<link[^>]+rel=["\']canonical["\']', html)) != 1:
    sys.exit('ABORT: expected exactly one canonical link in index.html')

new, n = html, 0
for k in KNOWN:
    if k != HOST:
        c = new.count(k + '/') + len(re.findall(re.escape(k) + r'(?![\w./-])', new))
        new = re.sub(re.escape(k) + r'(?![\w-])', HOST, new); n += c
# the canonical/og:url must end up as the bare host with a trailing slash
for pat in (r'(<link[^>]+rel=["\']canonical["\'][^>]+href=["\'])([^"\']+)(["\'])',
            r'(<meta[^>]+property=["\']og:url["\'][^>]+content=["\'])([^"\']+)(["\'])'):
    m = re.search(pat, new)
    if m and m.group(2) != HOST + '/':
        new = new[:m.start(2)] + HOST + '/' + new[m.end(2):]
if 'twitter:image' not in new and 'og:image' in new:
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>', new)
    if m:
        tag = '\n<meta name="twitter:image" content="' + m.group(1) + '">'
        new = new[:m.end()] + tag + new[m.end():]

robots = f'User-agent: *\nAllow: /\nSitemap: {HOST}/sitemap.xml\n'
sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           f'  <url><loc>{HOST}/</loc></url>\n</urlset>\n')

notes = []
if not (ROOT / 'og.png').exists(): notes.append('WARNING: og.png is not in the repo root, so the share preview image will 404.')
for f in ('manifest.webmanifest', 'sw.js', 'vercel.json'):
    p = ROOT / f
    if p.exists() and 'queuezerotwo.app' in p.read_text(encoding='utf-8'):
        notes.append(f'NOTE: {f} also mentions queuezerotwo.app; review it by hand.')

print('index.html:', 'edited' if new != html else 'already correct')
for name, body in (('robots.txt', robots), ('sitemap.xml', sitemap)):
    p = ROOT / name
    state = 'would overwrite' if p.exists() and p.read_text(encoding='utf-8') != body else ('unchanged' if p.exists() else 'new')
    print(f'{name}: {state}')
for x in notes: print(x)
if DRY: print('Dry run OK, nothing written.'); sys.exit(0)

idx.write_text(new, encoding='utf-8')
(ROOT / 'robots.txt').write_text(robots, encoding='utf-8')
(ROOT / 'sitemap.xml').write_text(sitemap, encoding='utf-8')
print('Done. Check git diff, then commit and push.')
