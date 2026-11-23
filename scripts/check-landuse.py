"""Check the Taoyuan 土管要點 archive: structure, ordering, and coverage of this run's listing.

With --cache, every 土管要點 file in this run's saved listing must be in the archive, except
files the sync deferred to next week (counted in stats.deferred), and the archive keeps no
file the site no longer lists. Without a saved listing (the site was unreachable this week)
the archive must equal the committed one.
"""
from pathlib import Path
import argparse, importlib.util, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_landuse', ROOT / 'scripts/sync-landuse.py')
sl = importlib.util.module_from_spec(spec); spec.loader.exec_module(sl)


def check(archive, rows=None):
    assert archive['source'] == sl.SOURCE and archive['note'] == sl.NOTE and archive['region'] == '桃園市'
    assert '沒有標示哪一份是現行' in archive['note'] and 'OCR' in archive['note'] and '原檔' in archive['note']
    assert archive['sourceUrl'] == sl.LIST_PAGE
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt'])
    items = archive['items']
    ids = [it['id'] for it in items]
    assert len(ids) == len(set(ids)), 'duplicate id'
    assert [(it['date'], it['id']) for it in items] == sorted(((it['date'], it['id']) for it in items), reverse=True), 'not newest first'
    spaced = re.compile(rf'{sl.sm.CJK}[^\S\n]+{sl.sm.CJK}')
    for it in items:
        assert list(it) == list(sl.FIELDS) + ['sha256', 'pages'], (it['id'], 'field order')
        assert re.fullmatch(r'PF000005\d{6}', it['id']), it['id']
        assert it['url'] == sl.FILE_BASE + it['id'] + '.pdf', (it['id'], it['url'])
        assert it['title'] and it['area'] and it['pages'], it['id']
        assert isinstance(it['caseId'], int)
        assert isinstance(it['kind'], str) and isinstance(it['type'], str), (it['id'], 'kind/type')
        if it['date']:
            assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', it['date']) and it['year'] == int(it['date'][:4]) - 1911, (it['id'], 'date')
        else:
            assert it['year'] is None, (it['id'], 'year without a date')
        assert it['docNo'] == '' or it['docNo'].endswith('號'), (it['id'], it['docNo'])
        assert all(f['url'].startswith(sl.FILE_BASE) and f['url'] != it['url'] for f in it['files']), (it['id'], 'files')
        assert re.fullmatch(r'[0-9a-f]{64}', it['sha256'] or ''), (it['id'], 'sha256')
        assert [p['n'] for p in it['pages']] == list(range(1, len(it['pages']) + 1)), (it['id'], 'page numbers')
        for p in it['pages']:
            assert set(p) == {'n', 'ocr', 'text'} and isinstance(p['ocr'], bool) and isinstance(p['text'], str)
            assert not spaced.search(p['text']), (it['id'], p['n'], 'space between Chinese characters')
    pages = [p for it in items for p in it['pages']]
    s = archive['stats']
    assert (s['items'], s['pages'], s['ocrPages'], s['areas']) == (len(items), len(pages), sum(p['ocr'] for p in pages), len({it['area'] for it in items}))
    if rows is not None:
        assert s['listed'] == len(rows)
        listed = {r['id']: r for r in rows}
        assert set(ids) <= set(listed), 'archive keeps a file the site no longer lists'
        assert len(set(listed) - set(ids)) == s['deferred'], 'listed files missing beyond the deferred ones'
        for it in items:  # case metadata follows the site
            assert {k: it[k] for k in sl.FIELDS} == sl.case_meta(listed[it['id']]), (it['id'], 'metadata differs from listing')
    return len(items), len(pages)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=Path)
    a = p.parse_args()
    archive = json.loads(sl.ARCHIVE.read_text(encoding='utf-8'))
    rows = None
    listing = a.cache / 'list.json' if a.cache else None
    if listing and listing.exists():
        rows = sl.parse_listing(json.loads(listing.read_text(encoding='utf-8')))
    elif a.cache:
        committed = subprocess.run(['git', 'show', 'HEAD:public/data/landuse.json'], cwd=ROOT,
                                   capture_output=True, check=True).stdout
        assert json.loads(committed) == archive, 'listing unavailable, yet the archive changed'
    n, pages = check(archive, rows)
    print(f'Verified {n} Taoyuan 土管要點 files ({pages} pages) '
          + ('and coverage of this run\'s listing.' if rows is not None else 'without a fresh listing.'))


if __name__ == '__main__':
    main()
