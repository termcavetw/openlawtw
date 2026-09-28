"""Check the imported archive against its official source, without network access."""
from pathlib import Path
import argparse, json, re, hashlib, importlib.util
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--cache',required=True);args=p.parse_args()
source=Path(args.cache)/'interpcomp-list.json';raw=source.read_bytes()
records=json.loads(raw);archive=json.loads((ROOT/'public/data/rulings.json').read_text())
spec=importlib.util.spec_from_file_location('sync_rulings',ROOT/'scripts/sync-rulings.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
actual={x['id']:x for x in archive['items']};assert len(actual)==len(records)==archive['stats']['count']
assert archive['stats']['sha256']==hashlib.sha256(raw).hexdigest()
compact=lambda s:re.sub(r'\s+','',s)
for original in records:
    r=actual[str(original['id'])];text,_=mod.plain(original['content'])
    assert compact(r['number']+r['body'])==compact(text),(r['id'],'Source text changed or omitted')
    assert r['title']==original['title'].strip()
    assert r['url'].endswith('/'+r['id'])
    for link in r['citations']: assert link in actual and link!=r['id']
    for ref in r['refs']: assert ref['evidence']
assert actual['17694']['date']=='2026-01-28' and actual['17694']['published']=='2026-09-08'
assert '5396' in actual['13820']['citations']
assert actual['17669']['refs'][0]['article']=='第 88 條'
assert actual['17082']['body']==''
assert '立法旨意' in actual['5714']['body'],'A header and body in one paragraph must remain separate'
print(f"Verified {len(actual)} official record IDs, all source text, issued/publication dates, citation targets, header-only records and source SHA-256.")
