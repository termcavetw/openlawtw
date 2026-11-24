"""Import 桃園市政府建管單位法規執行疑義會議紀錄與公文, reposted on the 桃園市建築師公會 website.

Only for Taoyuan cases and not a legal source. The text keeps the reposted files'
wording; pages without a text layer are OCR'd and may contain misread characters.

Incremental: a file id already in the archive keeps its text and is never
downloaded or OCR'd again. Only new PDF ids are fetched. Archives the site posts
as .rar cannot be read here; their content is kept in data/minutes-manual.json
and merged on every run, never overwritten or removed by this sync.

If the listing cannot be fetched or looks wrong, the archive is left unchanged
and the run still succeeds, so law and ruling updates are not blocked.
"""
from pathlib import Path
import argparse, hashlib, html as htmlmod, json, os, re, subprocess, sys, tempfile, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/minutes.json'
MANUAL = ROOT / 'data/minutes-manual.json'
LIST_ID = '665f644e43731ff9db3d341da5c827e1'
LIST_PAGE = 'https://www.tyaa.org.tw/listFiles.php?Id=' + LIST_ID
LIST_API = 'https://www.tyaa.org.tw/ajax/listFiles.php'
DOWNLOAD = 'https://old.tyaa.org.tw/dl_file.php?id='
SOURCE = '桃園市政府建管單位法規執行疑義會議紀錄與公文（轉載於桃園市建築師公會網站）'
NOTE = ('只適用桃園市，不是法源。轉載自桃園市建築師公會網站（tyaa.org.tw）；'
        '部分頁面是掃描影像經 OCR 辨識，可能有誤字，引用前要開原檔核對。')
# Listed archive files whose content is supplied by hand (data/minutes-manual.json).
MANUAL_FOR = {'790': ['790'], '703': ['703', '703x', '703y'], '710': ['710', '710a']}
NATIVE_MIN = 120          # fewer non-space characters than this on a page -> OCR it
MAX_REMOVED = 5           # more files vanishing from the listing than this -> keep everything
CJK = '[一-鿿，。、；：（）「」]'
FIELDS = ('id', 'title', 'url', 'year', 'sortDate', 'docNo', 'docDate', 'issuer')


class ListingProblem(RuntimeError):
    """The listing could not be fetched or does not look like the file list."""


def fetch_listing(timeout=60):
    body = urllib.parse.urlencode({'Id': LIST_ID, 'keyword': ''}).encode()
    request = urllib.request.Request(LIST_API, data=body, headers={
        'User-Agent': 'OpenLawTW/official-source-snapshot',
        'Content-Type': 'application/x-www-form-urlencoded', 'Referer': LIST_PAGE})
    last = None
    for _ in range(2):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception as error:  # transport problems only leave the archive unchanged
            last = error
    raise ListingProblem(f'{LIST_API}: {last}')


def parse_listing(raw):
    """Return [{id, name, kind}] in site order. kind is 'pdf' or 'other'."""
    try:
        data = json.loads(raw)
    except ValueError as error:
        raise ListingProblem('listing is not JSON') from error
    text = data.get('html') if isinstance(data, dict) else None
    if not data.get('success') or not isinstance(text, str):
        raise ListingProblem('listing JSON has no html')
    rows = []
    for block in re.split(r'(?=<div class="d-flex border-bottom)', text)[1:]:
        m = re.search(r'dl_file\.php\?id=(\d+)', block)
        n = re.search(r'fw-light">\s*(.*?)\s*</div>', block, re.S)
        if not m or not n:
            continue
        name = htmlmod.unescape(re.sub(r'<[^>]+>', '', n.group(1))).strip()
        icon = re.search(r'fa-file-(\w+)-o', block)
        kind = 'pdf' if name.lower().endswith('.pdf') and (not icon or icon.group(1) == 'pdf') else 'other'
        rows.append({'id': m.group(1), 'name': name, 'kind': kind})
    total = re.search(r'共有\s*(\d+)\s*檔案', text)
    if not rows:
        raise ListingProblem('listing has no files')
    if total and int(total.group(1)) != len(rows):
        raise ListingProblem(f'listing says {total.group(1)} files but {len(rows)} were parsed')
    if len({r['id'] for r in rows}) != len(rows):
        raise ListingProblem('listing repeats a file id')
    return rows


def clean(text):
    text = re.sub(r'(?m)^[ \t.]+$', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    # Spaces between Chinese characters are layout or OCR artefacts; newlines stay.
    return re.sub(rf'(?<={CJK})[^\S\n]+(?={CJK})', '', text)


def page_count(pdf):
    out = subprocess.run(['pdfinfo', str(pdf)], capture_output=True, text=True, check=True).stdout
    return int(re.search(r'^Pages:\s+(\d+)', out, re.M).group(1))


def native_text(pdf, page):
    return subprocess.run(['pdftotext', '-layout', '-f', str(page), '-l', str(page), str(pdf), '-'],
                          capture_output=True, check=True).stdout.decode('utf-8', 'ignore')


def ocr_text(pdf, page):
    import ocr_engine  # PaddleOCR, Tesseract fallback; imported lazily so checks need neither
    return ocr_engine.ocr_page(pdf, page)[0]


def extract_pages(pdf, workers=2):
    def one(page):
        native = native_text(pdf, page)
        if len(re.sub(r'\s', '', native)) >= NATIVE_MIN:
            return {'n': page, 'ocr': False, 'text': clean(native)}
        return {'n': page, 'ocr': True, 'text': clean(ocr_text(pdf, page))}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(one, range(1, page_count(pdf) + 1)))


def roc_date(text):
    m = re.search(r'(\d{2,3})年(\d{1,2})月(\d{1,2})日', text)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    m = re.match(r'\s*(\d{3})(\d{2})(\d{2})', text)
    if m:
        return int(m.group(1)), int(m.group(2)), int(m.group(3))
    return None


def cover_meta(first_page):
    """發文機關／日期／字號 from the cover letter. Missing or unreadable -> ''. Never guessed."""
    meta = {'docNo': '', 'docDate': '', 'issuer': ''}
    m = re.search(r'發文日期\s*[:：]?\s*中華民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日', first_page)
    if m:
        meta['docDate'] = f'民國{m.group(1)}年{m.group(2)}月{m.group(3)}日'
    m = re.search(r'發文字號\s*[:：]?\s*([^\s]{0,8}字第\s*[0-9A-Za-z\-]+\s*號)', first_page)
    if m:
        meta['docNo'] = re.sub(r'\s+', '', m.group(1))
    # The issuer is the letterhead (「桃園市政府　函」, 「桃園市政府建築管理處　函」). The 正本／副本
    # lists below it name other agencies, so they are never read as the issuer.
    head = re.split(r'(?m)^[^\S\n]*(?:正本|副本)[^\S\n]*[:：]', first_page)[0]
    m = re.search(r'(?m)^[^\S\n]*(?:\S+ \| )?(桃園[縣市]政府(?:[一-鿿]{1,8}?[局處])?)[^\S\n]*(?:函|書函|開會通知單)[^\S\n]*$', head)
    if not m:
        m = re.search(r'(桃園[縣市]政府[一-鿿]{2,8}?[局處])', head)
    if m:
        meta['issuer'] = m.group(1)
    return meta


def build_item(row, pdf, raw, workers=2):
    pages = extract_pages(pdf, workers)
    title = re.sub(r'\.pdf$', '', row['name'], flags=re.I).strip()
    first = pages[0]['text'] if pages else ''
    d = roc_date(title) or roc_date(first)
    item = {'id': row['id'], 'title': title, 'url': DOWNLOAD + row['id'],
            'year': d[0] if d else None, 'sortDate': f'{d[0]:03d}{d[1]:02d}{d[2]:02d}' if d else ''}
    item.update(cover_meta(first))
    item.update(sha256=hashlib.sha256(raw).hexdigest(), pages=pages)
    return item


def download_pdf(file_id, cache, timeout=120):
    path = cache / f'{file_id}.pdf'
    if not path.exists():
        request = urllib.request.Request(DOWNLOAD + file_id, headers={'User-Agent': 'OpenLawTW/official-source-snapshot'})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
        if not raw.startswith(b'%PDF'):
            raise ValueError(f'{file_id}: download is not a PDF')
        tmp = path.with_suffix('.tmp')
        tmp.write_bytes(raw)
        tmp.replace(path)
    return path, path.read_bytes()


def stats(items, rows, skipped):
    pages = [p for it in items for p in it['pages']]
    return {'listed': len(rows), 'items': len(items), 'manual': sum(bool(it.get('manual')) for it in items),
            'pages': len(pages), 'ocrPages': sum(p['ocr'] for p in pages), 'skipped': skipped}


def order(items):
    # Newest first; ties keep their previous order (new files first).
    return sorted(items, key=lambda it: it['sortDate'], reverse=True)


def merge(archive, manual, rows, fetch, max_ocr_pages=400, log=print):
    """Pure merge step. fetch(row) -> new item; it is only called for unknown PDF ids."""
    old = {it['id']: it for it in archive.get('items', []) if not it.get('manual')}
    listed = {r['id'] for r in rows}
    removed = sorted(set(old) - listed, key=int)
    if len(removed) > MAX_REMOVED:
        raise ListingProblem(f'{len(removed)} known files are missing from the listing: {removed[:10]}')
    kept, new, skipped, deferred, budget = [], [], [], [], max_ocr_pages
    for row in rows:
        if row['kind'] != 'pdf':
            covered = MANUAL_FOR.get(row['id'])
            skipped.append({'id': row['id'], 'name': row['name'],
                            'reason': '非 PDF，程式解不開；內容改用手動資料 ' + '、'.join(covered) if covered
                            else '非 PDF，程式解不開，尚無手動資料'})
            continue
        if row['id'] in old:
            item = dict(old[row['id']])
            item['title'] = re.sub(r'\.pdf$', '', row['name'], flags=re.I).strip() or item['title']
            kept.append(item)
            continue
        if budget <= 0:
            deferred.append(row['id'])
            continue
        try:
            item = fetch(row)
        except Exception as error:  # a broken new file waits for next week; nothing else is affected
            log(f'minutes: {row["id"]} not imported this run: {error}')
            deferred.append(row['id'])
            continue
        budget -= sum(p['ocr'] for p in item['pages'])
        new.append(item)
    manual_items = [dict(it, manual=True) for it in manual['items']]
    items = order(new + kept + manual_items)
    ids = [it['id'] for it in items]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate minutes id after merge')
    return items, {'new': [it['id'] for it in new], 'removed': removed, 'deferred': deferred, 'skipped': skipped}


def normalize(item):
    out = {k: item.get(k, '' if k in ('docNo', 'docDate', 'issuer', 'sortDate') else None) for k in FIELDS}
    if item.get('manual'):
        out['manual'] = True
    out['sha256'] = item.get('sha256')
    out['pages'] = [{'n': p['n'], 'ocr': bool(p['ocr']), 'text': p['text']} for p in item['pages']]
    return out


def make_archive(items, rows, changes, fetched_at):
    items = [normalize(it) for it in items]
    return {'source': SOURCE, 'sourceUrl': LIST_PAGE, 'note': NOTE, 'region': '桃園市',
            'fetchedAt': fetched_at, 'stats': stats(items, rows, changes['skipped']), 'items': items}


def write_if_changed(old, items, rows, changes, today):
    """fetchedAt is the date the content last changed, so an unchanged week writes nothing."""
    candidate = make_archive(items, rows, changes, old.get('fetchedAt', today))
    if candidate == old:
        return old, False
    candidate['fetchedAt'] = today
    ARCHIVE.write_text(json.dumps(candidate, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return candidate, True


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='.minutes-cache', type=Path)
    p.add_argument('--listing', type=Path, help='use a saved listing response instead of the network')
    p.add_argument('--max-ocr-pages', type=int, default=30, help='OCR budget per run; the rest waits a week')
    p.add_argument('--workers', type=int, default=max(1, min(4, os.cpu_count() or 1)))
    a = p.parse_args(argv)
    a.cache.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE.read_text(encoding='utf-8'))
    manual = json.loads(MANUAL.read_text(encoding='utf-8'))
    review = ROOT / 'sync-pr.md'
    try:
        raw = a.listing.read_bytes() if a.listing else fetch_listing()
        (a.cache / 'list.json').write_bytes(raw)
        rows = parse_listing(raw)

        def fetch(row):
            pdf, data = download_pdf(row['id'], a.cache)
            return build_item(row, pdf, data, a.workers)
        items, changes = merge(archive, manual, rows, fetch, a.max_ocr_pages)
    except ListingProblem as error:
        (a.cache / 'list.json').unlink(missing_ok=True)
        message = f'桃園市法規執行疑義會議紀錄：清單取得失敗，保留上次資料（{error}）。'
        print(message)
        if review.exists():
            review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 桃園市法規執行疑義會議紀錄\n\n- ' + message + '\n', encoding='utf-8')
        return 0
    archive, _ = write_if_changed(archive, items, rows, changes, datetime.now(timezone.utc).date().isoformat())
    s = archive['stats']
    lines = [f'- 共 {s["items"]} 份、{s["pages"]} 頁（其中 OCR {s["ocrPages"]} 頁、手動資料 {s["manual"]} 份）；公會網站列出 {s["listed"]} 個檔案。']
    for key, label in (('new', '新增'), ('removed', '網站已移除'), ('deferred', '下週再處理')):
        if changes[key]:
            lines.append(f'- {label}：' + '、'.join(changes[key]))
    print('\n'.join(lines))
    if review.exists():
        review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 桃園市法規執行疑義會議紀錄\n\n' + '\n'.join(lines) + '\n', encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
