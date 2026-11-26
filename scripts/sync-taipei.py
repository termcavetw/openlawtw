"""Import 臺北市政府 interpretations (解釋令函) on building and urban development from the
臺北市法規查詢系統 (laws.gov.taipei): the 都市發展類 and 工務類 categories.

Each category lists its letters newest first, 20 a page; each letter has a content page
(issuer, date, number, summary and full text) and a related-law page listing the
articles the city filed it under.

Incremental: a known letter is not fetched again, except a rotating slice each run so
edits on the site are picked up over a few weeks. If a listing cannot be fetched or
looks wrong, the archive is kept and the run still succeeds. The site answers hosted
runners but not every network, so this only runs in the weekly sync.
"""
from pathlib import Path
import argparse, html, json, re, sys, time, urllib.request
from datetime import date, datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/taipei-rulings.json'
SITE = 'https://laws.gov.taipei/law/Interpretation/'
CATEGORIES = {'002013': '都市發展類', '002007': '工務類'}
SOURCE = '臺北市法規查詢系統 解釋令函（laws.gov.taipei）'
NOTE = ('臺北市政府及所屬機關（都市發展局、建築管理工程處、法務局等）的解釋令函，依臺北市法規查詢系統「都市發展類」「工務類」收錄。'
        '只適用臺北市的案子；與條文或中央主管機關函釋不一致時以條文與中央函釋為準。函釋多針對個案，引用前請讀全文並確認之後有無新的函釋或法規修正。')
AGENT = 'OpenLawTW/official-source-snapshot'
MIN_LISTED = {'002013': 150, '002007': 50}
MAX_REMOVED = 15
REFRESH_PER_RUN = 60
FIELDS = ('id', 'category', 'date', 'docNo', 'issuer', 'summary', 'body', 'refs', 'url')


class ListingProblem(Exception):
    pass


def get(url, timeout=90, tries=4):
    last = None
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read().decode('utf-8', 'replace')
        except Exception as error:
            last = error
            time.sleep(2 + attempt * 3)
    raise ListingProblem(f'{url}: {last}')


def text(fragment):
    fragment = re.sub(r'<br\s*/?>', '\n', fragment, flags=re.I)
    value = html.unescape(re.sub(r'<[^>]+>', '', fragment)).replace('\r', '').replace('\xa0', ' ')
    return '\n'.join(line.rstrip() for line in value.split('\n')).strip('\n')


def flat(fragment):
    return re.sub(r'\s+', ' ', text(fragment)).strip()


def head_line(line):
    """「臺北市政府 115.09.09 府授都設字第1153061485號函」 -> issuer, ISO date, number."""
    m = re.match(r'(.+?)\s+(\d{2,3})\.(\d{1,2})\.(\d{1,2})\s*(.*)$', line.strip())
    if not m:
        return line.strip(), '', ''
    try:
        day = date(int(m[2]) + 1911, int(m[3]), int(m[4])).isoformat()
    except ValueError:
        day = ''
    return m[1].strip(), day, m[5].strip()


def parse_list_page(page_html):
    rows = []
    for block in re.findall(r'<div class="fx-tb">(.*?)</ul>', page_html, re.S):
        m = re.search(r'Interpretation/Content/(\w+)"[^>]*>(.*?)</a>', block, re.S)
        if not m:
            continue
        s = re.search(r'data-prefix="要　　旨"[^>]*>(.*?)</li>', block, re.S)
        rows.append({'id': m[1], 'head': flat(m[2]), 'summary': flat(s[1]) if s else ''})
    total = re.search(r'共<em>\s*([\d,]+)', page_html)
    return rows, int(total[1].replace(',', '')) if total else None


def fetch_listing(category, log=print):
    url = SITE + 'SearchResultByCategory?categoryid=' + category
    first, total = parse_list_page(get(url))
    if not first or not total:
        raise ListingProblem(f'{CATEGORIES[category]}: list page has no rows or total')
    rows = {r['id']: r for r in first}
    for page in range(2, -(-total // len(first)) + 1):
        found, _ = parse_list_page(get(f'{url}&page={page}'))
        if not found:
            raise ListingProblem(f'{CATEGORIES[category]}: list page {page} is empty')
        for r in found:
            rows.setdefault(r['id'], r)
        time.sleep(0.3)
    if len(rows) != total:
        raise ListingProblem(f'{CATEGORIES[category]}: list says {total} letters, pages gave {len(rows)}')
    if total < MIN_LISTED[category]:
        raise ListingProblem(f'{CATEGORIES[category]}: list has only {total} letters')
    return [dict(r, category=CATEGORIES[category]) for r in rows.values()]


def field(page_html, title):
    m = re.search(r'<div class="col-title">' + title + r'：</div>\s*<div class="col-data">(.*?)</div>', page_html, re.S)
    return m[1] if m else ''


def parse_content(page_html, letter_id, category):
    issuer, day, number = head_line(flat(field(page_html, '發文字號')))
    summary = text(re.search(r'<pre title="要旨">(.*?)</pre>', page_html, re.S)[1]) if '<pre title="要旨">' in page_html else ''
    body = re.search(r'<pre title="內容">(.*?)</pre>', page_html, re.S)
    item = {'id': letter_id, 'category': category, 'date': day, 'docNo': number, 'issuer': issuer,
            'summary': re.sub(r'\s*\n\s*', '', summary), 'body': text(body[1]) if body else '', 'refs': [],
            'url': SITE + 'Content/' + letter_id}
    if not issuer or not day or not (item['summary'] or item['body']):
        raise ValueError(f'{letter_id}: content page is missing issuer, date or text')
    return item


def parse_related(page_html):
    """[{scope, law, version, articles}] from the related-law page (中央法規 / 臺北市法規 sections)."""
    refs, scope = [], ''
    body = page_html[page_html.find('detail-body'):page_html.find('</article>')]
    for part in re.split(r'(<div class="law-range-title">.*?</div>|<li class="has-link subtitle">.*?</li>|<div class="col-no">.*?</div>)', body, flags=re.S):
        if part.startswith('<div class="law-range-title">'):
            scope = flat(part).replace('法規', '')
        elif part.startswith('<li class="has-link subtitle">'):
            m = re.match(r'(.+?)（民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日）$', flat(part))
            name, version = (m[1], date(int(m[2]) + 1911, int(m[3]), int(m[4])).isoformat()) if m else (flat(part), '')
            refs.append({'scope': scope, 'law': name.strip(), 'version': version, 'articles': []})
        elif part.startswith('<div class="col-no">') and refs:
            no = re.sub(r'\s+', ' ', flat(part))
            if no and no not in refs[-1]['articles']:
                refs[-1]['articles'].append(no)
    return refs


def merge(archive, rows, fetch, refresh=REFRESH_PER_RUN, log=print):
    old = {it['id']: it for it in archive.get('items', [])}
    listed = {r['id'] for r in rows}
    removed = sorted(set(old) - listed)
    if len(removed) > MAX_REMOVED:
        raise ListingProblem(f'{len(removed)} known letters vanished from the lists: {removed[:10]}')
    known = sorted(i for i in listed if i in old)
    week = datetime.now(timezone.utc).isocalendar()[1]
    slice_ = set(known[(week * refresh) % max(1, len(known)):][:refresh]) if known else set()
    items, new, changed, failed, seen = [], [], [], [], set()
    for r in rows:
        i = r['id']
        if i in seen:
            continue  # filed under both categories
        seen.add(i)
        if i in old and i not in slice_:
            items.append(dict(old[i]))
            continue
        try:
            item = fetch(i, r['category'])
        except Exception as error:
            if i in old:
                items.append(dict(old[i]))
            else:
                log(f'taipei: {i} not imported this run: {error}')
                failed.append(i)
            continue
        if i not in old:
            new.append(i)
        elif {k: item[k] for k in FIELDS} != {k: old[i][k] for k in FIELDS}:
            changed.append(i)
        items.append(item)
    items.sort(key=lambda it: (it['date'], it['id']), reverse=True)
    return items, {'new': new, 'changed': changed, 'removed': removed, 'failed': failed}


def stats(items, rows, changes):
    return {'listed': len({r['id'] for r in rows}), 'items': len(items), 'failed': len(changes['failed']),
            'categories': [{'name': c, 'items': sum(it['category'] == c for it in items)} for c in CATEGORIES.values()],
            'withRefs': sum(bool(it['refs']) for it in items)}


def make_archive(items, rows, changes, fetched_at):
    items = [{k: it[k] for k in FIELDS} for it in items]
    return {'source': SOURCE, 'sourceUrl': SITE, 'note': NOTE, 'region': '臺北市', 'fetchedAt': fetched_at,
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
        review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 臺北市解釋令函\n\n' + text_ + '\n', encoding='utf-8')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='.taipei-cache', type=Path)
    p.add_argument('--refresh', type=int, default=REFRESH_PER_RUN, help='known letters re-read per run')
    a = p.parse_args(argv)
    a.cache.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE.read_text(encoding='utf-8')) if ARCHIVE.exists() else {}
    try:
        rows = [r for category in CATEGORIES for r in fetch_listing(category)]
        (a.cache / 'list.json').write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')

        def fetch(i, category):
            item = parse_content(get(SITE + 'Content/' + i), i, category)
            item['refs'] = parse_related(get(SITE + 'RelatedLaw/' + i))
            time.sleep(0.3)
            return item
        items, changes = merge(archive, rows, fetch, a.refresh)
    except ListingProblem as error:
        (a.cache / 'list.json').unlink(missing_ok=True)
        message = f'- 清單取得失敗，保留上次資料（{error}）。'
        print('臺北市解釋令函' + message)
        append_review(message)
        return 0
    archive, _ = write_if_changed(archive, items, rows, changes, datetime.now(timezone.utc).date().isoformat())
    s = archive['stats']
    lines = [f'- 共 {s["items"]} 則（' + '、'.join(f'{c["name"]} {c["items"]}' for c in s['categories']) + f'）；網站列出 {s["listed"]} 則。']
    for key, label in (('new', '新增'), ('changed', '內容有更新'), ('removed', '網站已移除'), ('failed', '下週再試')):
        if changes[key]:
            lines.append(f'- {label}：' + '、'.join(map(str, changes[key][:60])) + ('…' if len(changes[key]) > 60 else ''))
    print('\n'.join(lines))
    append_review('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main())
