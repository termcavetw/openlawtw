#!/usr/bin/env python3
"""Re-read the OCR pages of public/data/attachments with PaddleOCR, in parallel jobs elsewhere.

  pack  <dir>                      render every OCR page (200 dpi, grey) to <dir>/<key>.png + pages.json
  ocr   <dir> --shard i --shards n  OCR this shard's images with scripts/ocr_engine.py -> --out shard-i.json
  apply <shard.json> [...]         put the new text into the attachment files (engine recorded per page)

The rendering needs the original files (data/sources/attachments/cache), which some county sites only serve to
Taiwan; the OCR jobs need only the images, so they can run anywhere.
"""
import argparse, hashlib, importlib.util, json, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/attachments'


def sync_module():
    spec = importlib.util.spec_from_file_location('sync_attachments', ROOT / 'scripts/sync-attachments.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def page_key(url, page):
    return hashlib.sha1(f'{url}#{page}'.encode()).hexdigest()[:20]


def pack(target):
    sa = sync_module()
    target.mkdir(parents=True, exist_ok=True)
    listing = []
    for path in sorted(OUT.glob('*.json')):
        if path.name == 'index.json':
            continue
        for att in json.loads(path.read_text(encoding='utf-8'))['attachments']:
            pages = [p['page'] for p in att.get('pages') or [] if p['method'] == 'ocr']
            if not pages:
                continue
            raw = (sa.CACHE / sa.key_of(att['url'])).read_bytes()
            with tempfile.TemporaryDirectory() as tmp:
                work = Path(tmp)
                if att['kind'] == 'image':
                    src = work / 'a.img'; src.write_bytes(raw)
                    png = target / f"{page_key(att['url'], 1)}.png"
                    subprocess.run(['convert', str(src), '-colorspace', 'Gray', str(png)], check=True) \
                        if shutil.which('convert') else shutil.copy(src, png)
                    listing.append({'key': png.stem, 'url': att['url'], 'page': 1})
                    continue
                pdf = work / 'a.pdf'
                if att['kind'] == 'pdf':
                    pdf.write_bytes(raw)
                else:
                    ext = {'doc': 'doc', 'docx': 'docx', 'odf': 'odt', 'xls': 'xls', 'xlsx': 'xlsx'}[att['kind']]
                    src = work / f'a.{ext}'; src.write_bytes(raw)
                    sa.run(['soffice', '--headless', f'-env:UserInstallation=file://{work}/lo', '--convert-to', 'pdf',
                            '--outdir', str(work), str(src)], 300)
                for page in pages:
                    key = page_key(att['url'], page)
                    subprocess.run(['pdftoppm', '-r', '200', '-gray', '-f', str(page), '-l', str(page), '-png',
                                    '-singlefile', str(pdf), str(target / key)], check=True, capture_output=True)
                    listing.append({'key': key, 'url': att['url'], 'page': page})
    (target / 'pages.json').write_text(json.dumps(listing, ensure_ascii=False), encoding='utf-8')
    print(f'{len(listing)} pages')


def ocr(source, shard, shards, out):
    sys.path.insert(0, str(ROOT / 'scripts'))
    import ocr_engine
    listing = json.loads((source / 'pages.json').read_text(encoding='utf-8'))
    result = {}
    for i, item in enumerate(listing):
        if i % shards != shard:
            continue
        png = next(source.glob(f"{item['key']}.*"))  # .png from pack, or .jpg if recompressed for upload
        try:
            result[item['key']] = {'engine': 'paddle', 'text': ocr_engine.paddle_text(png)}
        except Exception as error:  # noqa: BLE001 - leave the page as it is
            print(f"{item['key']}: {error}")
    Path(out).write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    print(f'{len(result)} pages')


def apply(shard_files):
    new = {}
    for f in shard_files:
        new.update(json.loads(Path(f).read_text(encoding='utf-8')))
    changed = 0
    for path in sorted(OUT.glob('*.json')):
        if path.name == 'index.json':
            continue
        doc = json.loads(path.read_text(encoding='utf-8'))
        touched = False
        for att in doc['attachments']:
            for p in att.get('pages') or []:
                hit = new.get(page_key(att['url'], p['page'])) if p['method'] == 'ocr' else None
                if hit:
                    p['engine'], p['text'] = hit['engine'], hit['text']
                    touched = True
                    changed += 1
        if touched:
            path.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    sync_module().write_index()
    print(f'{changed} pages replaced of {len(new)} read')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['pack', 'ocr', 'apply'])
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--shard', type=int, default=0)
    ap.add_argument('--shards', type=int, default=1)
    ap.add_argument('--out', default='shard.json')
    a = ap.parse_args()
    if a.cmd == 'pack':
        pack(Path(a.paths[0]))
    elif a.cmd == 'ocr':
        ocr(Path(a.paths[0]), a.shard, a.shards, a.out)
    else:
        apply(a.paths)
