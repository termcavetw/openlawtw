"""Check the Taoyuan minutes archive: structure, hand-supplied items, and coverage of the listing.

With --cache, every file in this run's saved listing must be in the archive: a PDF by
its own id, a .rar by the hand-supplied items that replace it. Without a saved listing
(the site was unreachable this week) the archive must equal the committed one.
"""
from pathlib import Path
import argparse, importlib.util, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_minutes', ROOT / 'scripts/sync-minutes.py')
sm = importlib.util.module_from_spec(spec); spec.loader.exec_module(sm)


def check(archive, manual, rows=None):
    assert archive['source'] == sm.SOURCE and archive['note'] == sm.NOTE and archive['region'] == '桃園市'
    assert '不是法源' in archive['note'] and 'OCR' in archive['note'] and '原檔' in archive['note']
    assert archive['sourceUrl'] == sm.LIST_PAGE
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt'])
    items = archive['items']
    ids = [it['id'] for it in items]
    assert len(ids) == len(set(ids)), 'duplicate id'
    assert [it['sortDate'] for it in items] == sorted((it['sortDate'] for it in items), reverse=True), 'not newest first'
    spaced = re.compile(rf'{sm.CJK}[^\S\n]+{sm.CJK}')
    for it in items:
        assert list(it)[:len(sm.FIELDS)] == list(sm.FIELDS), (it['id'], 'field order')
        assert it['title'] and it['pages'], it['id']
        assert [p['n'] for p in it['pages']] == list(range(1, len(it['pages']) + 1)), (it['id'], 'page numbers')
        for p in it['pages']:
            assert set(p) == {'n', 'ocr', 'text'} and isinstance(p['ocr'], bool) and isinstance(p['text'], str)
            assert not spaced.search(p['text']), (it['id'], p['n'], 'space between Chinese characters')
        if it['sortDate']:
            assert re.fullmatch(r'\d{7}', it['sortDate']) and it['year'] == int(it['sortDate'][:3]), (it['id'], 'date')
        else:
            assert it['year'] is None, (it['id'], 'year without a date')
        assert it['docDate'] == '' or re.fullmatch(r'民國\d{2,3}年\d{1,2}月\d{1,2}日', it['docDate']), (it['id'], it['docDate'])
        assert it['docNo'] == '' or it['docNo'].endswith('號'), (it['id'], it['docNo'])
        assert it['issuer'] == '' or it['issuer'].startswith('桃園'), (it['id'], it['issuer'])
        if it.get('manual'):
            assert it['sha256'] is None
        else:
            assert re.fullmatch(r'[0-9a-f]{64}', it['sha256'] or ''), (it['id'], 'sha256')
            assert it['url'] == sm.DOWNLOAD + it['id'], (it['id'], it['url'])
            assert it['id'].isdigit()
    # Hand-supplied items are present exactly as committed.
    by_id = {it['id']: it for it in items}
    for m in manual['items']:
        got = dict(by_id.get(m['id']) or {})
        assert got.pop('manual', None) is True, (m['id'], 'hand-supplied item missing')
        assert got == dict(m, sha256=None), (m['id'], 'hand-supplied item changed')
    assert sum(bool(it.get('manual')) for it in items) == len(manual['items'])
    pages = [p for it in items for p in it['pages']]
    s = archive['stats']
    assert (s['items'], s['pages'], s['ocrPages'], s['manual']) == (len(items), len(pages), sum(p['ocr'] for p in pages), len(manual['items']))
    if rows is not None:
        assert s['listed'] == len(rows)
        auto = {it['id'] for it in items if not it.get('manual')}
        for r in rows:
            if r['kind'] == 'pdf':
                assert r['id'] in auto, (r['id'], 'listed PDF missing')
            else:
                assert set(sm.MANUAL_FOR.get(r['id'], ['?'])) <= set(by_id), (r['id'], 'non-PDF without hand-supplied content')
        assert auto <= {r['id'] for r in rows}, 'archive keeps a file the site no longer lists'
    return len(items), len(pages)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=Path)
    a = p.parse_args()
    archive = json.loads(sm.ARCHIVE.read_text(encoding='utf-8'))
    manual = json.loads(sm.MANUAL.read_text(encoding='utf-8'))
    rows = None
    listing = a.cache / 'list.json' if a.cache else None
    if listing and listing.exists():
        rows = sm.parse_listing(listing.read_bytes())
    elif a.cache:
        committed = subprocess.run(['git', 'show', 'HEAD:public/data/minutes.json'], cwd=ROOT,
                                   capture_output=True, check=True).stdout
        assert json.loads(committed) == archive, 'listing unavailable, yet the archive changed'
    n, pages = check(archive, manual, rows)
    print(f'Verified {n} Taoyuan minutes ({pages} pages), hand-supplied items, '
          + ('and coverage of this run\'s listing.' if rows is not None else 'without a fresh listing.'))


if __name__ == '__main__':
    main()
