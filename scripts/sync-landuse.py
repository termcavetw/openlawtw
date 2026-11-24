"""Import 桃園市都市計畫土地使用分區管制要點 (土管要點) from the Taoyuan City urban-planning site.

Source: 桃園市政府都市發展局「都市計畫書圖查詢」(urplanning.tycg.gov.tw). Its plan list API
returns every announced plan case with its files; the files whose names start with
PF000005 are the 土管要點 of that case. Each file is the 要點 as announced by that one
case. The site does not mark which file is in force today, and this archive does not
guess: every case is kept with its area, announcement number and date, newest first.

Text comes from the PDF text layer; pages with almost no text are OCR'd (same engine
as the Taoyuan minutes, scripts/ocr_engine.py) and may contain misread characters, especially in tables.

Incremental: a file already in the archive keeps its text and is never downloaded or
OCR'd again; its case metadata is refreshed from the listing. If the list cannot be
fetched or looks wrong, the archive is left unchanged and the run still succeeds.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, os, re, sys, urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/landuse.json'
SITE = 'https://urplanning.tycg.gov.tw'
LIST_PAGE = SITE + '/Urban/plans.html'
LIST_API = SITE + '/UrbanApi/api/Urban/GetUrbanPlan'
FILE_BASE = SITE + '/tycgfiles/Plans/Final/'
FILE_PREFIX = 'PF000005'          # the site's own category for 土管要點 files
SOURCE = '桃園市政府都市發展局 都市計畫書圖查詢（urplanning.tycg.gov.tw）'
NOTE = ('每份是該次都市計畫公告的土地使用分區管制要點，市府網站沒有標示哪一份是現行版本，本庫也不判斷；'
        '同一計畫區可能有多份細部計畫與後續修訂，引用前要確認基地所屬計畫與是否有較新的公告。'
        '部分頁面是掃描影像經 OCR 辨識，表格的欄位對應與數字可能有誤，引用前要開原檔核對。')
PAGE_SIZE = 500
MIN_LISTED = 300                  # fewer 土管要點 files than this -> the listing is wrong
MAX_REMOVED = 10                  # more known files vanishing than this -> keep everything
FIELDS = ('id', 'caseId', 'area', 'areaId', 'title', 'kind', 'type', 'docNo', 'date', 'year', 'url', 'files')

spec = importlib.util.spec_from_file_location('sync_minutes', ROOT / 'scripts/sync-minutes.py')
sm = importlib.util.module_from_spec(spec); spec.loader.exec_module(sm)
ListingProblem = sm.ListingProblem
extract_pages = sm.extract_pages


def fetch_page(page, timeout=90):
    body = json.dumps({'page': page, 'pageSize': PAGE_SIZE, 'kind': '', 'type': '', 'area': '',
                       'keyword': '', 'year': 0}).encode()
    request = urllib.request.Request(LIST_API, data=body, headers={
        'User-Agent': 'OpenLawTW/official-source-snapshot', 'Content-Type': 'application/json',
        'Referer': LIST_PAGE})
    last = None
    for _ in range(2):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception as error:  # transport problems only leave the archive unchanged
            last = error
    raise ListingProblem(f'{LIST_API} page {page}: {last}')


def fetch_listing():
    """All plan cases, as the list of raw JSON responses (saved for the check step)."""
    pages = []
    for page in range(1, 41):
        raw = fetch_page(page)
        pages.append(json.loads(raw))
        if len(pages[-1].get('DATA') or []) < PAGE_SIZE:
            return pages
    raise ListingProblem('listing does not end after 40 pages')


def parse_listing(pages):
    """Return one row per 土管要點 file: {id, case fields, files of the case}."""
    cases = []
    for data in pages:
        if not isinstance(data, dict) or data.get('resultCode') != '0000' or not isinstance(data.get('DATA'), list):
            raise ListingProblem('listing JSON is not a plan list')
        cases += data['DATA']
    if len({c.get('ID') for c in cases}) != len(cases):
        raise ListingProblem('listing repeats a case')
    rows = []
    for c in cases:
        files = [f for f in c.get('FILES') or [] if re.fullmatch(r'PF\d{12}\.pdf', f.get('fileName') or '')]
        for f in files:
            if not f['fileName'].startswith(FILE_PREFIX):
                continue
            rows.append({'id': f['fileName'][:-4], 'case': c, 'label': (f.get('name') or '').strip(),
                         'files': [{'name': (g.get('name') or '').strip(), 'url': FILE_BASE + g['fileName']} for g in files]})
    if len(rows) < MIN_LISTED:
        raise ListingProblem(f'listing has only {len(rows)} 土管要點 files')
    if len({r['id'] for r in rows}) != len(rows):
        raise ListingProblem('listing repeats a 土管要點 file')
    return rows


def doc_no(case):
    """The announcement number as the city site shows it (PDOC1 + PDOC2 + 號). Never reformatted."""
    a, b = (case.get('PDOC1') or '').strip(), (case.get('PDOC2') or '').strip()
    if not b:
        return ''
    return a + re.sub(r'號$', '', b) + '號'


def case_meta(row):
    c = row['case']
    date = c.get('PPDATE') or ''
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        date = ''
    return {'id': row['id'], 'caseId': int(c['ID']), 'area': (c.get('PPAREA') or '').strip(),
            'areaId': (c.get('PPAREAID') or '').strip(), 'title': re.sub(r'\s+', ' ', c.get('PNAME') or '').strip(),
            'kind': (c.get('PKIND') or '').strip(), 'type': (c.get('PTYPE') or '').strip(), 'docNo': doc_no(c),
            'date': date, 'year': int(date[:4]) - 1911 if date else None, 'url': FILE_BASE + row['id'] + '.pdf',
            'files': [f for f in row['files'] if f['url'] != FILE_BASE + row['id'] + '.pdf']}


def download_pdf(file_id, cache, timeout=300):
    path = cache / f'{file_id}.pdf'
    if not path.exists():
        request = urllib.request.Request(FILE_BASE + file_id + '.pdf', headers={'User-Agent': 'OpenLawTW/official-source-snapshot'})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
        if not raw.startswith(b'%PDF'):
            raise ValueError(f'{file_id}: download is not a PDF')
        tmp = path.with_suffix('.tmp')
        tmp.write_bytes(raw)
        tmp.replace(path)
    return path, path.read_bytes()


def build_item(row, pdf, raw, workers=2):
    item = case_meta(row)
    item.update(sha256=hashlib.sha256(raw).hexdigest(), pages=extract_pages(pdf, workers))
    return item


def order(items):
    return sorted(items, key=lambda it: (it['date'], it['id']), reverse=True)


def merge(archive, rows, fetch, max_ocr_pages=400, log=print):
    """Pure merge step. fetch(row) -> new item; it is only called for unknown file ids."""
    old = {it['id']: it for it in archive.get('items', [])}
    listed = {r['id'] for r in rows}
    removed = sorted(set(old) - listed)
    if len(removed) > MAX_REMOVED:
        raise ListingProblem(f'{len(removed)} known files are missing from the listing: {removed[:10]}')
    kept, new, deferred, budget = [], [], [], max_ocr_pages
    for row in rows:
        if row['id'] in old:
            item = dict(old[row['id']])
            item.update(case_meta(row))
            kept.append(item)
            continue
        if budget <= 0:
            deferred.append(row['id'])
            continue
        try:
            item = fetch(row)
        except Exception as error:  # a broken new file waits for next week; nothing else is affected
            log(f'landuse: {row["id"]} not imported this run: {error}')
            deferred.append(row['id'])
            continue
        budget -= sum(p['ocr'] for p in item['pages'])
        new.append(item)
    items = order(new + kept)
    return items, {'new': [it['id'] for it in new], 'removed': removed, 'deferred': deferred}


def normalize(item):
    out = {k: item.get(k) for k in FIELDS}
    out['sha256'] = item['sha256']
    out['pages'] = [{'n': p['n'], 'ocr': bool(p['ocr']), 'text': p['text']} for p in item['pages']]
    return out


def stats(items, rows, deferred):
    pages = [p for it in items for p in it['pages']]
    return {'listed': len(rows), 'items': len(items), 'areas': len({it['area'] for it in items}),
            'pages': len(pages), 'ocrPages': sum(p['ocr'] for p in pages), 'deferred': len(deferred)}


def make_archive(items, rows, changes, fetched_at):
    items = [normalize(it) for it in items]
    return {'source': SOURCE, 'sourceUrl': LIST_PAGE, 'note': NOTE, 'region': '桃園市',
            'fetchedAt': fetched_at, 'stats': stats(items, rows, changes['deferred']), 'items': items}


def write_if_changed(old, items, rows, changes, today):
    """fetchedAt is the date the content last changed, so an unchanged week writes nothing."""
    candidate = make_archive(items, rows, changes, old.get('fetchedAt', today))
    if candidate == old:
        return old, False
    candidate['fetchedAt'] = today
    ARCHIVE.write_text(json.dumps(candidate, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return candidate, True


def append_review(text):
    review = ROOT / 'sync-pr.md'
    if review.exists():
        review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 桃園市都市計畫土管要點\n\n' + text + '\n', encoding='utf-8')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='.landuse-cache', type=Path)
    p.add_argument('--listing', type=Path, help='use a saved listing (list.json) instead of the network')
    p.add_argument('--max-ocr-pages', type=int, default=60, help='OCR budget per run; the rest waits a week')
    p.add_argument('--workers', type=int, default=max(1, min(4, os.cpu_count() or 1)))
    a = p.parse_args(argv)
    a.cache.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE.read_text(encoding='utf-8')) if ARCHIVE.exists() else {}
    try:
        pages = json.loads(a.listing.read_text(encoding='utf-8')) if a.listing else fetch_listing()
        (a.cache / 'list.json').write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
        rows = parse_listing(pages)

        def fetch(row):
            pdf, data = download_pdf(row['id'], a.cache)
            return build_item(row, pdf, data, a.workers)
        items, changes = merge(archive, rows, fetch, a.max_ocr_pages)
    except (ListingProblem, ValueError) as error:
        (a.cache / 'list.json').unlink(missing_ok=True)
        message = f'- 清單取得失敗，保留上次資料（{error}）。'
        print('桃園市都市計畫土管要點' + message)
        append_review(message)
        return 0
    archive, _ = write_if_changed(archive, items, rows, changes, datetime.now(timezone.utc).date().isoformat())
    s = archive['stats']
    lines = [f'- 共 {s["items"]} 份、{s["areas"]} 個計畫區、{s["pages"]} 頁（其中 OCR {s["ocrPages"]} 頁）；市府網站列出 {s["listed"]} 份土管要點檔。']
    for key, label in (('new', '新增'), ('removed', '網站已移除'), ('deferred', '下週再處理')):
        if changes[key]:
            lines.append(f'- {label}：' + '、'.join(changes[key]))
    print('\n'.join(lines))
    append_review('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main())
