"""Check the 農業部 farmland / farmhouse interpretation archive and its coverage of this run's list.

With --cache, every letter in this run's saved list must be in the archive (except ones the
sync could not read this run, counted in stats.failed), the archive keeps nothing the site
no longer lists, and law names follow the site's own law filter. Without a saved list (the
site was unreachable) the archive must equal the committed one.
"""
from pathlib import Path
import argparse, importlib.util, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_agri', ROOT / 'scripts/sync-agri.py')
sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)


def check(archive, rows=None, laws=None):
    assert archive['source'] == sa.SOURCE and archive['note'] == sa.NOTE and archive['issuer'] == '農業部'
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt'])
    items = archive['items']
    ids = [it['id'] for it in items]
    assert len(ids) == len(set(ids)), 'duplicate id'
    assert [(it['date'], it['id']) for it in items] == sorted(((it['date'], it['id']) for it in items), reverse=True), 'not newest first'
    for it in items:
        assert list(it) == list(sa.FIELDS), (it['id'], 'field order')
        assert isinstance(it['id'], int) and it['url'] == sa.DETAIL + str(it['id']), it['id']
        assert it['cls'] in ('解釋函', '解釋令', '公告'), (it['id'], it['cls'])
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', it['date']), (it['id'], 'date')
        assert it['title'] and it['body'] and it['issuer'], (it['id'], 'empty field')
        assert isinstance(it['docNo'], str), (it['id'], 'number')
        assert '<' not in it['body'] and '&nbsp;' not in it['body'], (it['id'], 'markup left in text')
        assert isinstance(it['laws'], list) and len(set(it['laws'])) == len(it['laws']), (it['id'], 'laws')
    s = archive['stats']
    assert (s['items'], s['interpretationOrders']) == (len(items), sum(it['cls'] == '解釋令' for it in items))
    counts = {}
    for it in items:
        for name in it['laws']:
            counts[name] = counts.get(name, 0) + 1
    assert {l['name']: l['items'] for l in s['laws']} == counts, 'law counts'
    if rows is not None:
        listed = {r['id']: r for r in rows}
        assert s['listed'] == len(rows)
        assert set(ids) <= set(listed), 'archive keeps a letter the site no longer lists'
        assert len(set(listed) - set(ids)) == s['failed'], 'listed letters missing beyond the failed ones'
        for it in items:
            r = listed[it['id']]
            assert (it['cls'], it['docNo']) == (r['cls'], r['docNo']), (it['id'], 'class or number differs from the list')
            assert it['date'] == sa.roc_iso(r['date']), (it['id'], 'date differs from the list')
            if str(it['id']) in laws:  # this run looked the letter up in the site's law filter
                assert it['laws'] == laws[str(it['id'])], (it['id'], 'laws differ from the site filter')
    return len(items)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=Path)
    a = p.parse_args()
    archive = json.loads(sa.ARCHIVE.read_text(encoding='utf-8'))
    rows = laws = None
    saved = a.cache / 'list.json' if a.cache else None
    if saved and saved.exists():
        data = json.loads(saved.read_text(encoding='utf-8'))
        rows, laws = data['rows'], data['laws']
    elif a.cache:
        committed = subprocess.run(['git', 'show', 'HEAD:public/data/agri-rulings.json'], cwd=ROOT, capture_output=True, check=True).stdout
        assert json.loads(committed) == archive, 'list unavailable, yet the archive changed'
    n = check(archive, rows, laws)
    print(f'Verified {n} 農業部 interpretations' + (' and coverage of this run\'s list.' if rows is not None else ' without a fresh list.'))


if __name__ == '__main__':
    main()
