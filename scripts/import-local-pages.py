#!/usr/bin/env python3
"""Put local-law pages fetched on a Taiwan connection into the sync-laws.py cache.

Several county law systems refuse connections from outside Taiwan, where the weekly sync runs. A browser in Taiwan
saves their LawContent pages as a bundle {url: base64 of the page bytes}; this writes each page as <id>.html with the
<id>.source.json record sync-laws.py checks (url, sha256 of the bytes, observedAt), then prints the law ids so
sync-laws.py --add-only --only-laws can parse them exactly as it parses pages it downloads itself.

Usage: python scripts/import-local-pages.py --cache .law-cache bundle.json [...]
"""
import argparse, base64, hashlib, json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ap = argparse.ArgumentParser()
ap.add_argument('--cache', default='.law-cache')
ap.add_argument('bundles', nargs='+')
a = ap.parse_args()

laws = json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8'))
by_url = {law['url']: law_id for law_id, law in laws.items() if law['region'] != '中央' or '-' in law_id}
# laws the weekly sync tried to add but could not reach are only in the sync report
report = ROOT / 'data/sync-report.json'
if report.exists():
    for failure in json.loads(report.read_text(encoding='utf-8')).get('localFailures', []):
        if failure.get('url') and failure.get('id'):
            by_url.setdefault(failure['url'], failure['id'])
cache = Path(a.cache)
cache.mkdir(parents=True, exist_ok=True)
ids, unknown = [], []
for bundle in a.bundles:
    observed = datetime.fromtimestamp(os.path.getmtime(bundle), timezone.utc).isoformat(timespec='seconds')
    for url, b64 in json.loads(Path(bundle).read_text(encoding='utf-8')).items():
        law_id = by_url.get(url)
        if not law_id:
            unknown.append(url)
            continue
        raw = base64.b64decode(b64)
        if b'LawContent' not in raw and '法規名稱'.encode('utf-8') not in raw:
            unknown.append(url + ' (not a law page)')
            continue
        (cache / f'{law_id}.html').write_bytes(raw)
        meta = {'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'hashScope': 'downloaded-html-file',
                'observedAt': observed, 'fetchedBy': 'browser on a Taiwan connection (site refuses foreign hosts)'}
        (cache / f'{law_id}.source.json').write_text(json.dumps(meta) + '\n', encoding='utf-8')
        ids.append(law_id)
print(','.join(sorted(ids)))
print(f'{len(ids)} pages; {len(unknown)} not matched', *unknown[:10], sep='\n', file=sys.stderr)
