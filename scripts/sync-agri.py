"""Import 農業部 (原農委會) interpretations on farmland and farmhouses from the
農業部農村發展及水土保持署「農地及農舍法規檢索系統」(rmis.ardswc.gov.tw).

The site lists every published 解釋函 / 解釋令 (it says it carries only general-purpose
ones) newest first; each has its own detail page with class, date, number, issuing
agency, summary and full text. Its search can filter by the law a letter belongs to,
which gives each letter its law names.

Incremental: a known letter is not fetched again, except a rotating slice each run so
edits on the site are picked up over a few weeks. If the list cannot be fetched or
looks wrong, the archive is kept and the run still succeeds.
"""
from pathlib import Path
import argparse, html, http.cookiejar, json, re, sys, time, urllib.parse, urllib.request
from datetime import date, datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/agri-rulings.json'
SITE = 'https://rmis.ardswc.gov.tw/web/'
LIST = SITE + 'NewsList.aspx'
SEARCH = SITE + 'Search.aspx'
DETAIL = SITE + 'NewsDetail.aspx?id='
SOURCE = '農業部農村發展及水土保持署 農地及農舍法規檢索系統（rmis.ardswc.gov.tw）'
NOTE = ('農業部（原行政院農業委員會）及所屬機關就農業發展條例、農業用地興建農舍辦法、農業設施容許使用等規定所作的解釋函與解釋令，'
        '依農村發展及水土保持署網站收錄（網站也收有內政部等機關的相關函，發文機關以每則所載為準）；該網站表示只收通案性質的函釋。函釋是主管機關對法規的解釋，個案適用仍以主管機關認定為準；'
        '較新的函釋或法規修正可能改變舊函釋的見解，引用前請確認。')
AGENT = 'OpenLawTW/official-source-snapshot'
MIN_LISTED = 1000
MAX_REMOVED = 20
REFRESH_PER_RUN = 150
FIELDS = ('id', 'cls', 'date', 'docNo', 'issuer', 'title', 'body', 'laws', 'url')


class ListingProblem(Exception):
    pass


def opener():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def get(op, url, data=None, timeout=90, tries=4):
    last = None
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, data=data, headers={'User-Agent': AGENT})
            with op.open(request, timeout=timeout) as response:
                return response.read().decode('utf-8', 'replace')
        except Exception as error:
            last = error
            time.sleep(2 + attempt * 3)
    raise ListingProblem(f'{url}: {last}')


def text(fragment):
    fragment = re.sub(r'<br\s*/?>', '\n', fragment, flags=re.I)
    fragment = re.sub(r'</(p|div|tr)>', '\n', fragment, flags=re.I)
    value = html.unescape(re.sub(r'<[^>]+>', '', fragment)).replace('\r', '').replace('\xa0', ' ')
    lines = [re.sub(r'[ \t　]+', ' ', l).strip() for l in value.split('\n')]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def roc_iso(value):
    m = re.fullmatch(r'(\d{2,3})/(\d{1,2})/(\d{1,2})', value.strip())
    if not m:
        return ''
    try:
        return date(int(m[1]) + 1911, int(m[2]), int(m[3])).isoformat()
    except ValueError:
        return ''


ROW = re.compile(r'<tr[^>]*>(.*?)</tr>', re.S)


def parse_list_page(page_html):
    rows = []
    for row in ROW.findall(page_html):
        m = re.search(r'NewsDetail\.aspx\?id=(\d+)', row)
        if not m:
            continue
        cells = [text(c) for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)]
        if len(cells) < 5:
            continue
        rows.append({'id': int(m[1]), 'date': cells[1], 'docNo': cells[2], 'title': cells[3], 'cls': cells[4]})
    total = re.search(r'共(?:\s|&nbsp;)*([\d,]+)(?:\s|&nbsp;)*筆資料', page_html)
    return rows, int(total[1].replace(',', '')) if total else None


def fetch_listing(op, log=print):
    first, total = [], None
    for attempt in range(4):  # the site sometimes answers a page without its rows; ask again
        first, total = parse_list_page(get(op, LIST))
        if first and total:
            break
        time.sleep(3)
    if not total or not first:
        raise ListingProblem('list page has no rows or total')
    rows = {r['id']: r for r in first}
    pages = -(-total // len(first))
    for page in range(2, pages + 1):
        found = []
        for attempt in range(3):  # the site sometimes answers an empty page; ask again
            found, _ = parse_list_page(get(op, f'{LIST}?page={page}'))
            if found:
                break
            time.sleep(3)
        if not found:
            raise ListingProblem(f'list page {page} stayed empty')
        for r in found:
            rows.setdefault(r['id'], r)
        time.sleep(0.2)
    if len(rows) != total:
        raise ListingProblem(f'list says {total} letters, pages gave {len(rows)}')
    if total < MIN_LISTED:
        raise ListingProblem(f'list has only {total} letters')
    return list(rows.values())


def parse_detail(page_html, letter_id):
    def span(name):
        m = re.search(r'id="ContentPlaceHolder1_ucNewsDetailOut1_' + name + r'"[^>]*>(.*?)</span>', page_html, re.S)
        return text(m[1]) if m else ''
    item = {'id': letter_id, 'cls': span('lblExpClass'), 'date': roc_iso(span('lblExpDate')), 'docNo': span('lblExpWord'),
            'issuer': span('lblExpDept'), 'title': span('lblExpTitle'), 'body': span('lblExpContent'), 'laws': [],
            'url': DETAIL + str(letter_id)}
    if not item['cls'] or not item['title'] or not item['body']:
        raise ValueError(f'{letter_id}: detail page is missing class, summary or text')
    return item


def law_options(op):
    page = get(op, SEARCH)
    return [(v, html.unescape(n).strip()) for v, n in re.findall(r'<option value="(\d{4})"[^>]*>([^<]+)', page)]


def search_ids(law, start, end, tries=4):
    """Letter ids the site files under one law between two ROC dates (one result page, max 50)."""
    for attempt in range(tries):
        try:
            return _search_ids(law, start, end)
        except ListingProblem:
            if attempt == tries - 1:
                raise
            time.sleep(5 + attempt * 5)


def _search_ids(law, start, end):
    op = opener()
    page = get(op, SEARCH)
    form = dict(re.findall(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', page))
    p = 'ctl00$ContentPlaceHolder1$ucSearchOut1$'
    form.update({p + 'ddlLawName': law, p + 'ucStartDate$txtCalender': start, p + 'ucEndDate$txtCalender': end,
                 p + 'DropDownList1': '50', p + 'DropDownList2': '0', p + 'DropDownList3': '0', p + 'btnSearch': '　搜尋　',
                 p + 'chkExpClass$0': '1', p + 'chkExpClass$1': '2', p + 'chkExpClass$2': '3'})
    for k in ('txbAnd1', 'txbAnd2', 'txbAnd3', 'txbAnd4', 'txbOr', 'txbNot'):
        form[p + k] = ''
    result = get(op, SEARCH, urllib.parse.urlencode(form).encode(), timeout=180)
    total = re.search(r'共有\s*([\d,]+)\s*筆資料', result)
    if not total:
        raise ListingProblem(f'law search {law} {start}-{end} has no result count')
    ids = [int(i) for i in re.findall(r'LawExpDetail\.aspx\?id=(\d+)', result)]
    return int(total[1].replace(',', '')), ids


def law_map(since=None, log=print):
    """{letter id: [law names]} from the site's own law filter; date ranges split until each fits one page.
    With since (a date), only letters issued from that day on are looked up."""
    out = {}
    laws = law_options(opener())
    if len(laws) < 10:
        raise ListingProblem('law list on the search page looks wrong')
    roc = lambda d: f'{d.year - 1911}/{d.month}/{d.day}'
    for code, name in laws:
        stack = [(since or date(1991, 1, 1), date(datetime.now().year + 1, 12, 31))]
        while stack:
            a, b = stack.pop()
            total, ids = search_ids(code, roc(a), roc(b))
            if total > len(ids):
                if a == b:
                    raise ListingProblem(f'{name}: more than 50 letters on {a}')
                mid = a + (b - a) // 2
                stack += [(a, mid), (mid + timedelta(days=1), b)]
                continue
            for i in ids:
                out.setdefault(i, [])
                if name not in out[i]:
                    out[i].append(name)
            time.sleep(0.3)
    order = {name: n for n, (_, name) in enumerate(laws)}
    return {i: sorted(v, key=order.get) for i, v in out.items()}


def merge(archive, rows, fetch, laws, refresh=REFRESH_PER_RUN, log=print):
    old = {it['id']: it for it in archive.get('items', [])}
    listed = {r['id'] for r in rows}
    removed = sorted(set(old) - listed)
    if len(removed) > MAX_REMOVED:
        raise ListingProblem(f'{len(removed)} known letters vanished from the list: {removed[:10]}')
    known = sorted(i for i in listed if i in old)
    week = datetime.now(timezone.utc).isocalendar()[1]
    slice_ = set(known[(week * refresh) % max(1, len(known)):][:refresh]) if known else set()
    items, new, changed, failed = [], [], [], []
    for r in rows:
        i = r['id']
        if i in old and i not in slice_:
            item = dict(old[i])
        else:
            try:
                item = fetch(i)
            except Exception as error:
                if i in old:
                    item = dict(old[i])
                else:
                    log(f'agri: {i} not imported this run: {error}')
                    failed.append(i)
                    continue
            if i not in old:
                new.append(i)
            elif {k: item[k] for k in FIELDS if k != 'laws'} != {k: old[i][k] for k in FIELDS if k != 'laws'}:
                changed.append(i)
        item['laws'] = laws[i] if i in laws else ([] if i not in old else old[i].get('laws', []))
        items.append(item)
    items.sort(key=lambda it: (it['date'], it['id']), reverse=True)
    return items, {'new': new, 'changed': changed, 'removed': removed, 'failed': failed}


def stats(items, rows, changes):
    by_law = {}
    for it in items:
        for name in it['laws']:
            by_law[name] = by_law.get(name, 0) + 1
    return {'listed': len(rows), 'items': len(items), 'failed': len(changes['failed']),
            'interpretationOrders': sum(it['cls'] == '解釋令' for it in items),
            'laws': [{'name': k, 'items': v} for k, v in sorted(by_law.items(), key=lambda x: -x[1])]}


def make_archive(items, rows, changes, fetched_at):
    items = [{k: it[k] for k in FIELDS} for it in items]
    return {'source': SOURCE, 'sourceUrl': LIST, 'note': NOTE, 'issuer': '農業部', 'fetchedAt': fetched_at,
            'stats': stats(items, rows, changes), 'items': items}


def write_if_changed(old, items, rows, changes, today):
    candidate = make_archive(items, rows, changes, old.get('fetchedAt', today))
    if candidate == old:
        return old, False
    candidate['fetchedAt'] = today
    ARCHIVE.write_text(json.dumps(candidate, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return candidate, True


def append_review(text_):
    review = ROOT / 'sync-pr.md'
    if review.exists():
        review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 農業部農地農舍函釋\n\n' + text_ + '\n', encoding='utf-8')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='.agri-cache', type=Path)
    p.add_argument('--refresh', type=int, default=REFRESH_PER_RUN, help='known letters re-read per run')
    a = p.parse_args(argv)
    a.cache.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE.read_text(encoding='utf-8')) if ARCHIVE.exists() else {}
    op = opener()
    try:
        rows = fetch_listing(op)
        known = {it['id'] for it in archive.get('items', [])}
        fresh = [sa_date for r in rows if r['id'] not in known and (sa_date := roc_iso(r['date']))]
        # Law names come from the site's law filter: all of them on the first run, then only for new letters.
        laws = law_map() if not known else law_map(date.fromisoformat(min(fresh))) if fresh else {}
        (a.cache / 'list.json').write_text(json.dumps({'rows': rows, 'laws': laws}, ensure_ascii=False), encoding='utf-8')

        def fetch(i):
            page = get(op, DETAIL + str(i))
            time.sleep(0.2)
            return parse_detail(page, i)
        items, changes = merge(archive, rows, fetch, laws, a.refresh)
    except ListingProblem as error:
        (a.cache / 'list.json').unlink(missing_ok=True)
        message = f'- 清單取得失敗，保留上次資料（{error}）。'
        print('農業部農地農舍函釋' + message)
        append_review(message)
        return 0
    archive, _ = write_if_changed(archive, items, rows, changes, datetime.now(timezone.utc).date().isoformat())
    s = archive['stats']
    lines = [f'- 共 {s["items"]} 則（解釋令 {s["interpretationOrders"]} 則）；網站列出 {s["listed"]} 則。']
    for key, label in (('new', '新增'), ('changed', '內容有更新'), ('removed', '網站已移除'), ('failed', '下週再試')):
        if changes[key]:
            lines.append(f'- {label}：' + '、'.join(map(str, changes[key][:60])) + ('…' if len(changes[key]) > 60 else ''))
    print('\n'.join(lines))
    append_review('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main())
