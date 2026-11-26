#!/usr/bin/env python3
"""Check public/data/moea-factory-rulings.json: it is what the importer makes from the preserved text, and known letters
keep their filing (經濟部中部辦公室《工廠管理輔導法暨相關函釋彙編》)."""
import importlib.util, json, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/moea-factory-rulings.json'
before = OUT.read_bytes()
subprocess.run([sys.executable, str(ROOT / 'scripts/import-moea-factory.py')], check=True, stdout=subprocess.DEVNULL)
assert OUT.read_bytes() == before, 'moea-factory-rulings.json differs from a fresh import of data/sources/moea-factory-*.txt.gz'
d = json.loads(before)
items = d['items']
assert len(items) >= 280, len(items)
assert len({x['id'] for x in items}) == len(items)
for x in items:
    assert re.fullmatch(r'M\w{5,14}', x['id']), x['id']
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', x['date']) and '1990' < x['date'] < '2024', (x['id'], x['date'])
    assert x['body'] and x['summary'] and x['issuer'] and x['filed'] and x['editions'], x['id']
by = lambda no: next(x for x in items if no in x['docNo'])
filed = lambda x: {(f['law'], f['article']) for f in x['filed'] if not f['cited']}
# 非都市土地使用管制規則第 32 條「夾雜」 and 第 33 條, filed by the 106 edition; topics from the 112 edition.
assert ('非都市土地使用管制規則', '第 32 條') in filed(by('10605012970'))
assert ('非都市土地使用管制規則', '第 33 條') in filed(by('09300004920')) and '用地變更' in by('09300004920')['topics']
# 施行細則 printed right after a law article shares its letters.
assert {('工廠管理輔導法', '第 3 條'), ('工廠管理輔導法施行細則', '第 2 條')} <= filed(by('10631307370'))
assert by('09930200410')['editions'] == ['106', '102']
compiler = sum(1 for x in items for f in x['filed'] if not f['cited'] and f['article'])
assert compiler >= 150, compiler
print(json.dumps({'items': len(items), 'compilerFilings': compiler, **d['stats']['byEdition']}, ensure_ascii=False))
