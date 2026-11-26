"""Check the central agencies' letters (via laws.gov.taipei) and their coverage of this run's list.
Without a saved list (the site was unreachable) the archive must equal the committed one, or still not exist."""
from pathlib import Path
import argparse, importlib.util, json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_central', ROOT / 'scripts/sync-central.py')
sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)


def check(archive, rows=None):
    assert archive['source'] == sc.SOURCE and archive['note'] == sc.NOTE
    assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', archive['fetchedAt'])
    names = {name for _, name, _ in sc.LAWS}
    items = archive['items']
    ids = [it['id'] for it in items]
    assert len(ids) == len(set(ids)), 'duplicate id'
    assert [(it['date'], it['id']) for it in items] == sorted(((it['date'], it['id']) for it in items), reverse=True), 'not newest first'
    for it in items:
        assert list(it) == list(sc.FIELDS), (it['id'], 'field order')
        assert re.fullmatch(r'\w{2,20}', it['id']) and it['url'] == sc.st.SITE + 'Content/' + it['id'], it['id']
        assert re.fullmatch(r'\d{4}-\d{2}-\d{2}', it['date']) and it['issuer'] and (it['summary'] or it['body']), it['id']
        assert it['filed'] and all(f['law'] in names and re.fullmatch(r'第 [\d-]+ 條', f['article']) for f in it['filed']), (it['id'], it['filed'])
        assert '<' not in it['body'] + it['summary'], (it['id'], 'markup')
    assert archive['stats']['items'] == len(items)
    if rows is not None:
        listed = {r['id']: r for r in rows}
        assert archive['stats']['listed'] == len(listed)
        assert set(ids) <= set(listed), 'archive keeps a letter no longer listed'
        assert len(set(listed) - set(ids)) == archive['stats']['failed'], 'listed letters missing beyond the failed ones'
        for it in items:
            assert it['filed'] == listed[it['id']]['filed'], (it['id'], 'filing differs from this run')
            assert it['date'] == sc.st.head_line(listed[it['id']]['head'])[1], (it['id'], 'date differs from the list')
    return len(items)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', type=Path)
    a = p.parse_args()
    saved = a.cache / 'list.json' if a.cache else None
    rows = json.loads(saved.read_text(encoding='utf-8')) if saved and saved.exists() else None
    if not sc.ARCHIVE.exists():
        assert rows is None, 'the list was read, yet no archive was written'
        print('No central-agency archive yet.')
        return
    archive = json.loads(sc.ARCHIVE.read_text(encoding='utf-8'))
    if rows is None and a.cache:
        committed = subprocess.run(['git', 'show', 'HEAD:public/data/central-rulings.json'], cwd=ROOT, capture_output=True)
        assert committed.returncode == 0 and json.loads(committed.stdout) == archive, 'list unavailable, yet the archive changed'
    n = check(archive, rows)
    print(f'Verified {n} central-agency letters' + (' and coverage of this run\'s list.' if rows is not None else '.'))


if __name__ == '__main__':
    main()
