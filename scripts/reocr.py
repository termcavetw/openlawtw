"""Re-read every OCR'd page of the Taoyuan minutes and 土管要點 archives with scripts/ocr_engine.py.

  python scripts/reocr.py ocr --shards 20 --shard 3 --cache .reocr-cache --out shard-3.json
  python scripts/reocr.py apply shard-*.json --review reocr-pr.md

ocr: pages are split across shards by a stable order. Each PDF is downloaded again and must
match the sha256 the archive recorded, so new text always belongs to the same file.
apply: replaces only the text of pages read by PaddleOCR (a page that fell back to Tesseract
or was not read keeps its old text), leaves everything else in the archives untouched, and
writes a review with before/after samples.
"""
from pathlib import Path
import argparse, hashlib, importlib.util, json, random, re, sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


sm = load('sync_minutes', 'sync-minutes.py')
sl = load('sync_landuse', 'sync-landuse.py')
DATASETS = {'minutes': (sm.ARCHIVE, sm.download_pdf), 'landuse': (sl.ARCHIVE, sl.download_pdf)}


def table_like(page):
    """Pages worth a table pass: OCR rows with cells, or text-layer lines laid out in columns with figures."""
    lines = page['text'].split('\n')
    if page['ocr']:
        return any(' | ' in a and ' | ' in b for a, b in zip(lines, lines[1:]))
    return sum(1 for l in lines if re.search(r'\S\s{3,}\S', l) and re.search(r'\d', l)) >= 3


def table_targets():
    archive = json.loads(sl.ARCHIVE.read_text(encoding='utf-8'))
    return sorted(('landuse', str(it['id']), p['n']) for it in archive['items'] for p in it['pages'] if table_like(p))


def targets():
    out = []
    for name, (path, _) in DATASETS.items():
        archive = json.loads(path.read_text(encoding='utf-8'))
        for item in archive['items']:
            if item.get('manual'):
                continue  # hand-supplied text is never rewritten
            for page in item['pages']:
                if page['ocr']:
                    out.append((name, str(item['id']), page['n']))
    return sorted(out)


def ocr(a):
    import ocr_engine
    pages = {}
    if a.mode == 'tables':
        archive = json.loads(sl.ARCHIVE.read_text(encoding='utf-8'))
        pages = {('landuse', str(it['id']), p['n']): p for it in archive['items'] for p in it['pages']}
    mine = [t for i, t in enumerate(table_targets() if a.mode == 'tables' else targets()) if i % a.shards == a.shard]
    sha = {}
    for name, (path, _) in DATASETS.items():
        for item in json.loads(path.read_text(encoding='utf-8'))['items']:
            sha[(name, str(item['id']))] = item.get('sha256')
    a.cache.mkdir(parents=True, exist_ok=True)
    result, files = {}, {}
    print(f'shard {a.shard}/{a.shards}: {len(mine)} pages')
    for n, (name, item_id, page) in enumerate(mine, 1):
        key = (name, item_id)
        if key not in files:
            try:
                pdf, raw = DATASETS[name][1](item_id, a.cache)
                files[key] = pdf if hashlib.sha256(raw).hexdigest() == sha[key] else None
                if files[key] is None:
                    print(f'{name} {item_id}: file changed on the site since it was archived; skipped')
            except Exception as error:
                print(f'{name} {item_id}: download failed ({error}); skipped')
                files[key] = None
        if files[key] is None:
            continue
        if a.mode == 'tables':
            stored = pages[(name, item_id, page)]
            got = ocr_engine.table_page(files[key], page, None if stored['ocr'] else stored['text'])
            if got is None:
                continue
            text, tables = got
            if stored['ocr']:  # line by line, so the table line ranges stay valid
                text = '\n'.join(sm.clean(line) for line in text.split('\n'))
            result.setdefault(name, {}).setdefault(item_id, {})[str(page)] = {'engine': 'paddle-table', 'text': text, 'tables': tables}
        else:
            text, engine = ocr_engine.ocr_page(files[key], page)
            result.setdefault(name, {}).setdefault(item_id, {})[str(page)] = {'engine': engine, 'text': sm.clean(text)}
        if n % 25 == 0:
            print(f'  {n}/{len(mine)}')
    Path(a.out).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')


PERCENT = re.compile(r'\d%')  # Tesseract often read "%" as 96, so fewer of these survived


def apply_tables(new, review):
    archive = json.loads(sl.ARCHIVE.read_text(encoding='utf-8'))
    got = new.get('landuse', {})
    pages = tables = ocr_pages = 0
    samples = []
    for item in archive['items']:
        for page in item['pages']:
            res = got.get(str(item['id']), {}).get(str(page['n']))
            if not res or not res['tables']:
                continue
            if page['ocr']:
                page['text'] = res['text']
                ocr_pages += 1
            page['tables'] = res['tables']
            pages += 1; tables += len(res['tables'])
            samples.append((item, page))
    archive['fetchedAt'] = datetime.now(timezone.utc).date().isoformat()
    sl.ARCHIVE.write_text(json.dumps(archive, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    wanted = len(table_targets())
    lines = [f'- 檢查 {wanted} 頁可能有表格的土管頁，{pages} 頁辨識出表格（共 {tables} 個表格）；其中 {ocr_pages} 頁是掃描頁，文字也一併以同一次辨識更新。']
    random.seed(11)
    body = ['## 土管要點表格改用 PaddleOCR 表格辨識', '', '每個表格記錄它涵蓋的文字行（from～to），網站在那幾行的位置畫出辨識出的表格（含合併儲存格）；文字本身仍保留供搜尋。', ''] + lines + ['', '### 抽樣', '']
    for item, page in random.sample(samples, min(8, len(samples))):
        t = page['tables'][0]
        body += [f'**{item["id"]} 第 {page["n"]} 頁**　{item["title"][:40]}（第 {t["from"] + 1}～{t["to"]} 行）', '']
        for r in t['rows'][:6]:
            body.append('| ' + ' | '.join(c[0].replace('|', '｜') or '　' for c in r) + ' |')
        body.append('')
    Path(review).write_text('\n'.join(body) + '\n', encoding='utf-8')
    print('\n'.join(lines))


def apply(a):
    new = {}
    for f in a.shards_files:
        for name, items in json.loads(Path(f).read_text(encoding='utf-8')).items():
            for item_id, pages in items.items():
                new.setdefault(name, {}).setdefault(item_id, {}).update(pages)
    if a.mode == 'tables':
        return apply_tables(new, a.review)
    wanted = targets()
    lines, samples, today = [], [], datetime.now(timezone.utc).date().isoformat()
    for name, (path, _) in DATASETS.items():
        archive = json.loads(path.read_text(encoding='utf-8'))
        replaced = kept = 0
        before_bad = after_bad = 0
        for item in archive['items']:
            if item.get('manual'):
                continue
            for page in item['pages']:
                if not page['ocr']:
                    continue
                got = new.get(name, {}).get(str(item['id']), {}).get(str(page['n']))
                before_bad += len(PERCENT.findall(page['text']))
                if got and got['engine'] == 'paddle' and got['text'].strip():
                    samples.append((name, item, page['n'], page['text'], got['text']))
                    page['text'] = got['text']
                    replaced += 1
                else:
                    kept += 1
                after_bad += len(PERCENT.findall(page['text']))
        total = sum(1 for t in wanted if t[0] == name)
        if replaced:
            archive['fetchedAt'] = today
            archive['note'] = (sm if name == 'minutes' else sl).NOTE  # the note names the OCR engine
            path.write_text(json.dumps(archive, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        label = '桃園市會議紀錄' if name == 'minutes' else '桃園市土管要點'
        lines.append(f'- {label}：OCR 頁 {total} 頁，改用 PaddleOCR {replaced} 頁，保留原文字 {kept} 頁。'
                     f'正確讀出的「數字%」：{before_bad} → {after_bad} 處。')
    random.seed(7)
    picks = random.sample(samples, min(12, len(samples)))
    body = ['## 桃園會議紀錄與土管要點改用 PaddleOCR 重新辨識', '',
            '掃描頁改用 PaddleOCR（PP-OCRv6，繁體中文）。只換掉 OCR 頁的文字；有文字層的頁、手動資料、檔案雜湊與其他欄位都不變。', ''] + lines + ['', '### 抽樣對照（前 300 字）', '']
    for name, item, n, old, newtext in picks:
        title = item.get('title', '')[:40]
        body += [f'**{name} {item["id"]} 第 {n} 頁**　{title}', '', '修改前：', '```', old[:300], '```', '修改後：', '```', newtext[:300], '```', '']
    Path(a.review).write_text('\n'.join(body) + '\n', encoding='utf-8')
    print('\n'.join(lines))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='cmd', required=True)
    o = sub.add_parser('ocr')
    o.add_argument('--shards', type=int, required=True)
    o.add_argument('--shard', type=int, required=True)
    o.add_argument('--cache', type=Path, default=Path('.reocr-cache'))
    o.add_argument('--out', required=True)
    o.add_argument('--mode', choices=('text', 'tables'), default='text')
    ap = sub.add_parser('apply')
    ap.add_argument('shards_files', nargs='+')
    ap.add_argument('--review', default='reocr-pr.md')
    ap.add_argument('--mode', choices=('text', 'tables'), default='text')
    a = p.parse_args()
    ocr(a) if a.cmd == 'ocr' else apply(a)


if __name__ == '__main__':
    main()
