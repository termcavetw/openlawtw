#!/usr/bin/env python3
"""Text of every law's official attachments (附表、附件、圖例…) -> public/data/attachments/<lawId>.json + index.json.

Each attachment listed in public/data/laws.json is downloaded from its official URL, typed by its bytes, and turned
into page text: PDF pages by their text layer (pdftotext -layout), pages without one by OCR (PaddleOCR PP-OCRv6 via scripts/ocr_engine.py, Tesseract if it is unavailable);
ODT/DOC/DOCX/XLS(X) are converted to PDF by LibreOffice first so pages and table layout survive; images are OCR'd.
A link that is an HTML page (a law system's own page, a download list) is recorded as kind "page" with no text.

OCR text can be wrong, layout text of a grid table loses its lines: the file says which method each page used, and the
official file (url) stays the authority. data/attachment-transcriptions/<lawId>.json can add a reviewed transcription
of a table (e.g. a use-group matrix as one line per cell); it is stored beside the extracted pages, never instead.

A URL already extracted is not downloaded again (--refresh does): the law systems publish a changed file under a new
URL. Some local law systems refuse connections from outside Taiwan. Files can be fetched elsewhere and handed in with
--import <dir>: a directory of bundles {url: base64} (as a browser on a Taiwan connection saves them) or plain files
named by sha1(url). A file already extracted is kept when its URL cannot be fetched again.
"""
import argparse, base64, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ocr_engine  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/attachments'
CACHE = ROOT / 'data/sources/attachments/cache'
TRANSCRIPTIONS = ROOT / 'data/attachment-transcriptions'
AGENT = 'Mozilla/5.0 (OpenLawTW official-source snapshot)'
OCR_MIN_CHARS = 25


def key_of(url):
    return hashlib.sha1(url.encode('utf-8')).hexdigest()[:20]


def fetch(url, tries=2, timeout=40):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as error:  # noqa: BLE001 - reported per file
            last = error
            time.sleep(2 * (i + 1))
    raise last


def kind_of(raw, title):
    head = raw[:8]
    if head.startswith(b'%PDF'):
        return 'pdf'
    if head.startswith(b'\xd0\xcf\x11\xe0'):
        return 'xls' if re.search(r'\.xls$', title, re.I) else 'doc'
    if head.startswith(b'PK'):
        if b'mimetypeapplication/vnd.oasis.opendocument' in raw[:200]:
            return 'odf'
        if b'word/' in raw[:4000] or re.search(r'\.docx$', title, re.I):
            return 'docx'
        if b'xl/' in raw[:4000] or re.search(r'\.xlsx$', title, re.I):
            return 'xlsx'
        return 'zip'
    if head.startswith(b'\xff\xd8') or head.startswith(b'\x89PNG'):
        return 'image'
    probe = raw[:600].lstrip(b'\xef\xbb\xbf \r\n\t').lower()
    if probe.startswith(b'<!doctype') or probe.startswith(b'<html') or b'<html' in probe:
        return 'page'
    if re.search(r'\.txt$', title, re.I):
        return 'text'
    return 'unknown'


def run(cmd, timeout=600):
    return subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)


def pdf_pages(path):
    r = run(['pdfinfo', str(path)], 60)
    m = re.search(rb'Pages:\s+(\d+)', r.stdout)
    return int(m.group(1)) if m else 0


def ocr_page(pdf, page, work):
    """(text, engine): PaddleOCR (PP-OCRv6, traditional Chinese) via scripts/ocr_engine.py, Tesseract if it is unavailable."""
    return ocr_engine.ocr_page(pdf, page)


def extract_pdf(pdf, work, ocr=True):
    pages = []
    for page in range(1, pdf_pages(pdf) + 1):
        r = run(['pdftotext', '-layout', '-enc', 'UTF-8', '-f', str(page), '-l', str(page), str(pdf), '-'], 120)
        text = r.stdout.decode('utf-8', 'replace').replace('\f', '').rstrip()
        entry = {'page': page, 'method': 'text', 'text': text}
        if len(re.sub(r'\s+', '', text)) < OCR_MIN_CHARS and ocr:
            text, engine = ocr_page(pdf, page, work)
            entry = {'page': page, 'method': 'ocr', 'engine': engine, 'text': text}
        pages.append(entry)
    return pages


def extract(raw, kind, ocr=True):
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        if kind == 'pdf':
            src = work / 'a.pdf'; src.write_bytes(raw)
            return extract_pdf(src, work, ocr)
        if kind in ('doc', 'docx', 'odf', 'xls', 'xlsx'):
            ext = {'doc': 'doc', 'docx': 'docx', 'odf': 'odt', 'xls': 'xls', 'xlsx': 'xlsx'}[kind]
            src = work / f'a.{ext}'; src.write_bytes(raw)
            run(['soffice', '--headless', f'-env:UserInstallation=file://{work}/lo', '--convert-to', 'pdf', '--outdir', str(work), str(src)], 300)
            pdf = work / 'a.pdf'
            if not pdf.exists():
                raise ValueError('LibreOffice could not convert the file')
            return extract_pdf(pdf, work, ocr)
        if kind == 'image':
            src = work / 'a.img'; src.write_bytes(raw)
            try:
                return [{'page': 1, 'method': 'ocr', 'engine': 'paddle', 'text': ocr_engine.paddle_text(src)}]
            except Exception:  # noqa: BLE001 - Tesseract when PaddleOCR is unavailable
                return [{'page': 1, 'method': 'ocr', 'engine': 'tesseract', 'text': ocr_engine.tesseract_text(src)}]
        if kind == 'text':
            for enc in ('utf-8', 'big5', 'cp950'):
                try:
                    return [{'page': 1, 'method': 'text', 'text': raw.decode(enc)}]
                except UnicodeDecodeError:
                    pass
        return []


def targets(laws, only=None):
    out = {}
    for law_id, law in laws.items():
        if only and law_id not in only:
            continue
        for i, a in enumerate(law.get('attachments') or []):
            if not re.match(r'https?://', a.get('url', '')):
                continue
            out.setdefault(law_id, []).append({'index': i, 'title': a['title'], 'url': a['url']})
    return out


def load_imports(dirs):
    files = {}
    for d in dirs or []:
        for p in Path(d).iterdir():
            if p.suffix == '.json':
                try:
                    bundle = json.loads(p.read_text(encoding='utf-8'))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                if isinstance(bundle, dict):
                    for url, b64 in bundle.items():
                        if isinstance(b64, str) and re.match(r'https?://', url):
                            files[key_of(url)] = base64.b64decode(b64)
            elif re.fullmatch(r'[0-9a-f]{20}', p.stem):
                files[p.stem] = p.read_bytes()
    return files


def safe_name(law_id):
    return law_id.replace('/', '_')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--import', dest='imports', nargs='*', help='directories of files fetched elsewhere')
    ap.add_argument('--no-fetch', action='store_true', help='use only the cache and --import files')
    ap.add_argument('--no-ocr', action='store_true')
    ap.add_argument('--refresh', action='store_true', help='download again even if cached')
    ap.add_argument('--delay', type=float, default=0.3)
    ap.add_argument('--list-missing', help='write the URLs still without a file to this JSON, by host')
    a = ap.parse_args()

    laws = json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    imported = load_imports(a.imports)
    for k, raw in imported.items():
        (CACHE / k).write_bytes(raw)
    unreachable_hosts, host_failures = set(), {}
    missing = {}
    stats = {'laws': 0, 'files': 0, 'pages': 0, 'ocrPages': 0, 'linkPages': 0, 'missing': 0}
    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    for law_id, items in sorted(targets(laws, set(a.only) if a.only else None).items()):
        path = OUT / f'{safe_name(law_id)}.json'
        prev = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        prev_by_url = {x['url']: x for x in prev.get('attachments', [])}
        records = []
        for item in items:
            url, host = item['url'], urllib.parse.urlparse(item['url']).netloc
            if re.search(r'/LawContent\.aspx|/LawAll\.aspx|/LawSingle\.aspx', url):
                # a link to the law system's own page, not a file
                records.append({'index': item['index'], 'title': item['title'], 'url': url, 'kind': 'page', 'pages': []})
                stats['linkPages'] += 1
                continue
            cached = CACHE / key_of(url)
            raw, error = None, None
            old = prev_by_url.get(url)
            if old and old.get('kind') != 'missing' and old.get('pages') is not None and not a.refresh \
                    and not (cached.exists() and hashlib.sha256(cached.read_bytes()).hexdigest() != old.get('sha256')):
                # official systems give a changed file a new URL: a URL already extracted is not downloaded again
                records.append({**old, 'index': item['index'], 'title': item['title']})
                stats['files'] += 1
                stats['pages'] += len(old['pages'] or [])
                stats['ocrPages'] += sum(p['method'] == 'ocr' for p in old['pages'] or [])
                continue
            if cached.exists() and not a.refresh:
                raw = cached.read_bytes()
            elif not a.no_fetch and host not in unreachable_hosts:
                try:
                    raw = fetch(url)
                    cached.write_bytes(raw)
                    host_failures[host] = 0
                    time.sleep(a.delay)
                except Exception as e:  # noqa: BLE001
                    error = str(e)[:160]
                    if re.search(r'reset|unreachable|timed out|refused|403', error, re.I):
                        host_failures[host] = host_failures.get(host, 0) + 1
                        if host_failures[host] >= 3:  # a host refusing this connection: stop asking it
                            unreachable_hosts.add(host)
            if raw is None:
                old = prev_by_url.get(url)
                if old and old.get('pages') is not None and old.get('kind') != 'missing':
                    records.append({**old, 'index': item['index'], 'title': item['title']})
                    continue
                missing.setdefault(host, []).append(url)
                stats['missing'] += 1
                records.append({'index': item['index'], 'title': item['title'], 'url': url, 'kind': 'missing',
                                'error': error or 'not fetched', 'pages': None})
                continue
            sha = hashlib.sha256(raw).hexdigest()
            old = prev_by_url.get(url)
            if old and old.get('sha256') == sha and old.get('pages') is not None:
                records.append({**old, 'index': item['index'], 'title': item['title']})
                stats['files'] += 1
                stats['pages'] += len(old['pages'] or [])
                stats['ocrPages'] += sum(p['method'] == 'ocr' for p in old['pages'] or [])
                continue
            kind = kind_of(raw, item['title'])
            rec = {'index': item['index'], 'title': item['title'], 'url': url, 'kind': kind, 'sha256': sha,
                   'bytes': len(raw), 'retrieved': now}
            if kind == 'page':
                rec['pages'] = []
                stats['linkPages'] += 1
            else:
                try:
                    rec['pages'] = extract(raw, kind, not a.no_ocr)
                except Exception as e:  # noqa: BLE001
                    rec['pages'], rec['error'] = [], f'extract: {e}'[:200]
                stats['files'] += 1
                stats['pages'] += len(rec['pages'])
                stats['ocrPages'] += sum(p['method'] == 'ocr' for p in rec['pages'])
            records.append(rec)
        transcription = TRANSCRIPTIONS / f'{safe_name(law_id)}.json'
        if transcription.exists():
            reviewed = json.loads(transcription.read_text(encoding='utf-8'))
            for rec in records:
                t = reviewed.get(rec['url']) or reviewed.get(rec['title'])
                if t:
                    rec['transcription'] = t
        law = laws[law_id]
        doc = {'law': law_id, 'name': law['name'], 'region': law['region'],
               'note': '附件文字自官方檔案擷取：method=text 為檔案文字層，method=ocr 為光學辨識（可能有誤字），'
                       '表格只保留排版文字；transcription 是人工對照原檔整理的表格內容。以官方檔案（url）為準。',
               'attachments': records}
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        stats['laws'] += 1
        print(law_id, len(records), file=sys.stderr)
    write_index()
    if a.list_missing:
        Path(a.list_missing).write_text(json.dumps(missing, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({**stats, 'unreachableHosts': sorted(unreachable_hosts)}, ensure_ascii=False))


def write_index():
    laws = {}
    for p in sorted(OUT.glob('*.json')):
        if p.name == 'index.json':
            continue
        d = json.loads(p.read_text(encoding='utf-8'))
        att = d['attachments']
        laws[d['law']] = {'name': d['name'], 'region': d['region'], 'file': p.name,
                          'attachments': len(att),
                          'withText': sum(1 for x in att if x.get('pages')),
                          'missing': sum(1 for x in att if x.get('kind') == 'missing'),
                          'ocrPages': sum(1 for x in att for pg in (x.get('pages') or []) if pg['method'] == 'ocr'),
                          'transcribed': sum(1 for x in att if x.get('transcription'))}
    (OUT / 'index.json').write_text(json.dumps({'schemaVersion': 1, 'laws': laws}, ensure_ascii=False,
                                               separators=(',', ':')) + '\n', encoding='utf-8')
    write_search()


SEARCH_PAGE_CHARS = 4000


def write_search():
    """One search file per region and one for everything: each page's text with runs of spaces collapsed, cut at
    SEARCH_PAGE_CHARS characters (truncated: true), so a reader can search all attachments with one or two requests
    and open the law's own file for the full page."""
    rows = {}
    for p in sorted(OUT.glob('*.json')):
        if p.name == 'index.json':
            continue
        d = json.loads(p.read_text(encoding='utf-8'))
        for i, a in enumerate(d['attachments']):
            for page in a.get('pages') or []:
                text = re.sub(r'[ \t\u3000]+', ' ', page['text'])
                text = re.sub(r'\s*\n\s*', '\n', text).strip()
                if not text:
                    continue
                row = {'law': d['law'], 'name': d['name'], 'attachment': i, 'title': a['title'], 'page': page['page'],
                       'method': page['method'], 'text': text[:SEARCH_PAGE_CHARS]}
                if page.get('engine'):
                    row['engine'] = page['engine']
                if len(text) > SEARCH_PAGE_CHARS:
                    row['truncated'] = True
                rows.setdefault(d['region'], []).append(row)
    target = OUT / 'search'
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
    dump = lambda path, value: path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n',
                                               encoding='utf-8')
    for region, items in rows.items():
        dump(target / f'{region}.json', {'region': region, 'pages': items})
    dump(target / 'all.json', {'region': None, 'pages': [r for items in rows.values() for r in items]})


if __name__ == '__main__':
    main()
