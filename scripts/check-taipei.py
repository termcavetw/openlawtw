"""Check the 臺北市解釋令函 archive and its coverage of this run's lists.

With --cache, every letter in this run's saved lists must be in the archive (except ones the
sync could not read this run, counted in stats.failed) and the archive keeps nothing the site
no longer lists. Without a saved list (the site was unreachable) the archive must equal the
committed one, or still not exist.
"""
from pathlib import Path
import argparse, importlib.util, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_taipei', ROOT / 'scripts/sync-taipei.py')
st = importlib.util.module_from_spec(spec); spec.loader.exec_module(st)


def check(archive, rows=None):
    assert archive['source'] == st.SOURCE and archive['note'] == st.NOTE and archive['region'] == '臺北市'
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt'])
    items = archive['items']
    ids = [it['id'] for it in items]
    assert len(ids) == len(set(ids)), 'duplicate id'
    assert [(it['date'], it['id']) for it in items] == sorted(((it['date'], it['id']) for it in items), reverse=True), 'not newest first'
    for it in items:
        assert list(it) == list(st.FIELDS), (it['id'], 'field order')
        assert re.fullmatch(r'\w{2,20}', it['id']) and it['url'] == st.SITE + 'Content/' + it['id'], it['id']
        assert it['category'] in st.CATEGORIES.values(), (it['id'], it['category'])
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', it['date']), (it['id'], 'date')
        assert it['issuer'] and (it['summary'] or it['body']), (it['id'], 'empty field')
        assert '<' not in it['body'] + it['summary'] and '&nbsp;' not in it['body'], (it['id'], 'markup left in text')
        for r in it['refs']:
            assert set(r) == {'scope', 'law', 'version', 'articles'} and r['law'], (it['id'], 'ref')
            assert all(re.fullmatch(r'第 [\d-]+ [條點]', a) for a in r['articles']), (it['id'], r['articles'])
    s = archive['stats']
    assert s['items'] == len(items) and s['withRefs'] == sum(bool(it['refs']) for it in items)
    assert {c['name']: c['items'] for c in s['categories']} == {c: sum(it['category'] == c for it in items) for c in st.CATEGORIES.values()}
    if rows is not None:
        listed = {}
        for r in rows:
            listed.setdefault(r['id'], r)
        assert s['listed'] == len(listed)
        assert set(ids) <= set(listed), 'archive keeps a letter the site no longer lists'
        assert len(set(listed) - set(ids)) == s['failed'], 'listed letters missing beyond the failed ones'
        for it in items:
            # The list line and the content page are typed separately on the site and sometimes differ in the issuer
            # or number wording (the 2026-11-26 sync: FE363287); the date must agree.
            issuer, day, number = st.head_line(listed[it['id']]['head'])
            assert it['date'] == day, (it['id'], 'date differs from the list')
    return len(items)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=Path)
    a = p.parse_args()
    saved = a.cache / 'list.json' if a.cache else None
    rows = json.loads(saved.read_text(encoding='utf-8')) if saved and saved.exists() else None
    if not st.ARCHIVE.exists():
        assert rows is None, 'lists were read, yet no archive was written'
        print('No 臺北市解釋令函 archive yet.')
        return
    archive = json.loads(st.ARCHIVE.read_text(encoding='utf-8'))
    if rows is None and a.cache:
        committed = subprocess.run(['git', 'show', 'HEAD:public/data/taipei-rulings.json'], cwd=ROOT, capture_output=True)
        assert committed.returncode == 0 and json.loads(committed.stdout) == archive, 'lists unavailable, yet the archive changed'
    n = check(archive, rows)
    print(f'Verified {n} 臺北市解釋令函' + (' and coverage of this run\'s lists.' if rows is not None else ' without a fresh list.'))


if __name__ == '__main__':
    main()
