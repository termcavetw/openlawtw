"""Import central agencies' interpretations (消防署、經濟部、農業部 等) that the 臺北市法規查詢系統
(laws.gov.taipei) files under central laws: its 「中央法規相關解釋令函」 pages, per article.

The agencies' own systems do not answer this project's networks (law.nfa.gov.tw times out,
law.moea.gov.tw sits behind a challenge page, law.moa.gov.tw has no interpretations), while
laws.gov.taipei answers hosted runners and carries the full text of each letter. Coverage is
what the city filed under these laws, not every letter the agencies issued.

For each law in LAWS, the article page lists which articles have related letters; each
article's page lists the letters; each letter has a content page and a related-law page
(shared parsers with scripts/sync-taipei.py). Incremental, with a rotating refresh.
"""
from pathlib import Path
import argparse, html, importlib.util, json, re, sys, time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_taipei', ROOT / 'scripts/sync-taipei.py')
st = importlib.util.module_from_spec(spec); spec.loader.exec_module(st)

ARCHIVE = ROOT / 'public/data/central-rulings.json'
LAW_SITE = 'https://laws.gov.taipei/law/LawSearch/'
# (taipei law id, name, topic): topic groups the source on the site.
LAWS = [
    ('FL005007', '消防法', '消防'),
    ('FL011071', '工廠管理輔導法', '工廠與產業'),
    ('FL011133', '工廠管理輔導法施行細則', '工廠與產業'),
    ('FL014277', '農業發展條例', '農業'),
    ('FL014278', '農業發展條例施行細則', '農業'),
    ('FL027752', '申請農業用地作農業設施容許使用審查辦法', '農業'),
    ('FL014299', '農業用地作農業使用認定及核發證明辦法', '農業'),
]
SOURCE = '臺北市法規查詢系統 中央法規相關解釋令函（laws.gov.taipei）'
NOTE = ('中央機關（內政部消防署、經濟部、行政院農業委員會／農業部、法務部等）的解釋令函，依臺北市法規查詢系統歸在消防法、工廠管理輔導法、'
        '農業發展條例等中央法規條文下者收錄；只是臺北市法務局整理的部分，不是各部會的完整函釋。函釋是主管機關對法規的解釋，個案適用以主管機關認定為準；'
        '較新的函釋或法規修正可能改變見解，引用前請確認。')
MIN_LETTERS = 100
MAX_REMOVED = 20
REFRESH_PER_RUN = 60
FIELDS = ('id', 'date', 'docNo', 'issuer', 'summary', 'body', 'filed', 'refs', 'url')


def article_numbers(page_html, law_id):
    """Article numbers with related letters, from the law's article page (LawRelateInterpretation links)."""
    nos = []
    for no in re.findall(r'LawRelateInterpretation/' + law_id + r'\?no=([\w-]+)', page_html):
        if no not in nos:
            nos.append(no)
    return nos


def law_name(page_html):
    m = re.search(r'<a class="law-link"[^>]*title="([^"]+)"', page_html) or re.search(r'<title>(.*?)</title>', page_html, re.S)
    return st.flat(m[1]) if m else ''


def fetch_listing(log=print):
    """Rows {id, head, summary, filed: [{law, article}]} across all LAWS."""
    rows = {}
    for law_id, name, _ in LAWS:
        page = st.get(LAW_SITE + 'LawArticleContent/' + law_id)
        nos = article_numbers(page, law_id)
        if not nos:  # the city has filed no letters under this law (yet); the others still count
            log(f'central: {name} ({law_id}) has no articles with related letters')
            if name not in html.unescape(page):
                raise st.ListingProblem(f'{law_id}: article page is not {name}')
            continue
        for no in nos:
            related = st.get(f'{LAW_SITE}LawRelateInterpretation/{law_id}?no={no}')
            title = law_name(related)
            if not re.match(re.escape(name) + r' 第 ', title):
                raise st.ListingProblem(f'{law_id} no={no}: page is for {title!r}, not {name}')
            found, _ = st.parse_list_page(related)
            for r in found:
                row = rows.setdefault(r['id'], dict(r, filed=[]))
                ref = {'law': name, 'article': '第 ' + no + ' 條'}
                if ref not in row['filed']:
                    row['filed'].append(ref)
            time.sleep(0.3)
    if len(rows) < MIN_LETTERS:
        raise st.ListingProblem(f'only {len(rows)} letters listed')
    return list(rows.values())


def merge(archive, rows, fetch, refresh=REFRESH_PER_RUN, log=print):
    old = {it['id']: it for it in archive.get('items', [])}
    listed = {r['id']: r for r in rows}
    removed = sorted(set(old) - set(listed))
    if len(removed) > MAX_REMOVED:
        raise st.ListingProblem(f'{len(removed)} known letters vanished: {removed[:10]}')
    known = sorted(i for i in listed if i in old)
    week = datetime.now(timezone.utc).isocalendar()[1]
    slice_ = set(known[(week * refresh) % max(1, len(known)):][:refresh]) if known else set()
    items, new, changed, failed = [], [], [], []
    for i, r in listed.items():
        if i in old and i not in slice_:
            item = dict(old[i])
        else:
            try:
                item = fetch(i)
            except Exception as error:
                if i in old:
                    item = dict(old[i])
                else:
                    log(f'central: {i} not imported this run: {error}')
                    failed.append(i)
                    continue
            if i not in old:
                new.append(i)
            elif {k: item[k] for k in FIELDS if k != 'filed'} != {k: old[i][k] for k in FIELDS if k != 'filed'}:
                changed.append(i)
        item['filed'] = r['filed']
        items.append({k: item[k] for k in FIELDS})
    items.sort(key=lambda it: (it['date'], it['id']), reverse=True)
    return items, {'new': new, 'changed': changed, 'removed': removed, 'failed': failed}


def topic(item):
    topics = {name: t for _, name, t in LAWS}
    return sorted({topics[f['law']] for f in item['filed'] if f['law'] in topics})


def make_archive(items, rows, changes, fetched_at):
    by_issuer = {}
    for it in items:
        key = re.sub(r'(部|署|會|院|局|處)(?!.*(部|署|會|院|局|處)).*$', r'\1', it['issuer']) or it['issuer']
        by_issuer[key] = by_issuer.get(key, 0) + 1
    return {'source': SOURCE, 'sourceUrl': LAW_SITE, 'note': NOTE, 'fetchedAt': fetched_at,
            'laws': [{'id': law_id, 'name': name, 'topic': t} for law_id, name, t in LAWS],
            'stats': {'listed': len(rows), 'items': len(items), 'failed': len(changes['failed']),
                      'topics': [{'name': t, 'items': sum(t in topic(it) for it in items)} for t in dict.fromkeys(t for *_, t in LAWS)],
                      'issuers': [{'name': k, 'items': v} for k, v in sorted(by_issuer.items(), key=lambda x: -x[1])]},
            'items': items}


def append_review(text_):
    review = ROOT / 'sync-pr.md'
    if review.exists():
        review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 中央部會函釋（臺北市法規查詢系統）\n\n' + text_ + '\n', encoding='utf-8')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='.central-cache', type=Path)
    p.add_argument('--refresh', type=int, default=REFRESH_PER_RUN)
    a = p.parse_args(argv)
    a.cache.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE.read_text(encoding='utf-8')) if ARCHIVE.exists() else {}
    try:
        rows = fetch_listing()
        (a.cache / 'list.json').write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')

        def fetch(i):
            item = st.parse_content(st.get(st.SITE + 'Content/' + i), i, '')
            item['refs'] = st.parse_related(st.get(st.SITE + 'RelatedLaw/' + i))
            item['filed'] = []
            time.sleep(0.3)
            return item
        items, changes = merge(archive, rows, fetch, a.refresh)
    except st.ListingProblem as error:
        (a.cache / 'list.json').unlink(missing_ok=True)
        message = f'- 清單取得失敗，保留上次資料（{error}）。'
        print('中央部會函釋' + message)
        append_review(message)
        return 0
    today = datetime.now(timezone.utc).date().isoformat()
    candidate = make_archive(items, rows, changes, archive.get('fetchedAt', today))
    if candidate != archive:
        candidate['fetchedAt'] = today
        ARCHIVE.write_text(json.dumps(candidate, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    s = candidate['stats']
    lines = [f'- 共 {s["items"]} 則（' + '、'.join(f'{t["name"]} {t["items"]}' for t in s['topics']) + f'）；清單列出 {s["listed"]} 則。']
    for key, label in (('new', '新增'), ('changed', '內容有更新'), ('removed', '已移除'), ('failed', '下週再試')):
        if changes[key]:
            lines.append(f'- {label}：' + '、'.join(changes[key][:40]) + ('…' if len(changes[key]) > 40 else ''))
    print('\n'.join(lines))
    append_review('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main())
