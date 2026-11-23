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
    if compact(r['number']+r['body'])!=compact(text):
        # A header found away from the start (after a summary line, in a meeting record's first
        # line) is copied out of the official text, which then stays whole as the body.
        assert compact(r['body'])==compact(text) and r['number'] and compact(r['number']) in compact(text),(r['id'],'Source text changed or omitted')
    if r['date']:assert r['number'],(r['id'],'An issued date must come from the official header')
    assert r['title']==original['title'].strip()
    assert r['url'].endswith('/'+r['id'])
    for link in r['citations']: assert link in actual and link!=r['id']
    for ref in r['refs']: assert ref['evidence']
assert actual['17694']['date']=='2026-01-28' and actual['17694']['published']=='2026-09-08'
assert '5396' in actual['13820']['citations']
assert actual['17669']['refs'][0]['article']=='第 88 條'
assert actual['17082']['body']==''
assert '立法旨意' in actual['5714']['body'],'A header and body in one paragraph must remain separate'
# Headers away from the first line: never the letter a summary sentence cites.
assert actual['7528']['number'].startswith('內政部87.12.1.') and actual['7528']['date']=='1998-12-01'
assert actual['7493']['number'].startswith('內政部86.2.17') and actual['7493']['date']=='1997-02-17'
assert actual['16041']['date']=='','A malformed official year (1113) must stay empty, not be corrected'
print(f"Verified {len(actual)} official record IDs, all source text, issued/publication dates, citation targets, header-only records and source SHA-256.")
