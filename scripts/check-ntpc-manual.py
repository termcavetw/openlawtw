"""Check the 新北市建照業務工作手冊 archive. With --cache, the archive must match the PDF this run
downloaded (same edition and checksum); without one (the site was unreachable) it must equal
the committed archive."""
from pathlib import Path
import argparse, importlib.util, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_ntpc', ROOT / 'scripts/sync-ntpc-manual.py')
sn = importlib.util.module_from_spec(spec); spec.loader.exec_module(sn)


def check(archive, seen=None):
    assert archive['source'] == sn.SOURCE and archive['note'] == sn.NOTE and archive['region'] == '新北市'
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt']) and re.fullmatch(r'[0-9a-f]{64}', archive['sha256'])
    assert (archive['edition'], archive['sourceUrl']) in sn.EDITIONS, 'edition not in EDITIONS'
    cases = archive['cases']
    sn.validate(cases)
    for c in cases:
        assert list(c) == list(sn.FIELDS), (c['no'], 'field order')
        assert re.fullmatch(r'\d{2}-\d{2}', c['no']), c['no']
        assert c['chapter'] and isinstance(c['pdfPage'], int) and c['pdfPage'] > 0, c['no']
        assert all('<' not in c[k] for k in ('basis', 'question', 'rule', 'note')), (c['no'], 'markup')
    assert [c['no'] for c in cases] == sorted(c['no'] for c in cases), 'cases out of order'
    s = archive['stats']
    assert s['cases'] == len(cases)
    assert {x['name']: x['cases'] for x in s['chapters']} == {n: sum(c['chapter'] == n for c in cases) for n in {c['chapter'] for c in cases}}
    if seen is not None:
        assert (archive['edition'], archive['sourceUrl'], archive['sha256']) == (seen['edition'], seen['url'], seen['sha256']), 'archive is not from this run\'s PDF'
    return len(cases)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=Path)
    a = p.parse_args()
    archive = json.loads(sn.ARCHIVE.read_text(encoding='utf-8'))
    saved = a.cache / 'manual.json' if a.cache else None
    seen = json.loads(saved.read_text(encoding='utf-8')) if saved and saved.exists() else None
    if seen is None and a.cache:
        committed = subprocess.run(['git', 'show', 'HEAD:public/data/ntpc-manual.json'], cwd=ROOT, capture_output=True)
        assert committed.returncode == 0 and json.loads(committed.stdout) == archive, 'manual unavailable, yet the archive changed'
    n = check(archive, seen)
    print(f'Verified {n} 新北市工作手冊 cases' + (' against this run\'s PDF.' if seen else '.'))


if __name__ == '__main__':
    main()
