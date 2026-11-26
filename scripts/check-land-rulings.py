"""Check the 內政部地政司 解釋函 archive: built from the preserved export (same checksum, same parse)."""
from pathlib import Path
import gzip, hashlib, importlib.util, json, re, tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('land', ROOT / 'scripts/import-land-rulings.py')
il = importlib.util.module_from_spec(spec); spec.loader.exec_module(il)


def check(archive):
    assert archive['source'] == il.SOURCE and archive['note'] == il.NOTE and archive['issuer'] == '內政部地政司'
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt'])
    raw = gzip.decompress(il.EXPORT.read_bytes())
    assert archive['export']['sha256'] == hashlib.sha256(raw).hexdigest(), 'archive is not from the preserved export'
    items = archive['items']
    ids = [it['id'] for it in items]
    assert len(ids) == len(set(ids)) and len(items) >= il.MIN_ITEMS
    for it in items:
        assert list(it) == list(il.FIELDS), it['id']
        assert re.fullmatch(r'[0-9a-f]{12}', it['id']) and (it['summary'] or it['body']) and it['refs'], it['id']
        assert it['date'] == '' or re.fullmatch(r'\d{4}-\d{2}-\d{2}', it['date']), it['id']
        assert '<' not in it['body'] + it['summary'], (it['id'], 'markup')
    with tempfile.NamedTemporaryFile(suffix='.html') as f:
        f.write(raw); f.flush()
        rebuilt = il.build(f.name)
    assert rebuilt['items'] == items and rebuilt['stats'] == archive['stats'], 'archive differs from a fresh parse of the export'
    return len(items)


if __name__ == '__main__':
    n = check(json.loads(il.ARCHIVE.read_text(encoding='utf-8')))
    print(f'Verified {n} 地政司 interpretations against the preserved export.')
