"""Apply reviewed green-building originals and link-only manual editions.

Offline/reproducible: never fetch or silently replace a source. To change a PDF,
review its official publication, date and rights first, then update the manifest.
PDF text is a faithful search aid, not newly invented article structure.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

def encoded(path, value):
    if path in ('public/data/laws.json', 'data/catalog.json', 'public/data/catalog.json'):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'

def build(check=False):
    inputs = read('data/green-building-sources.json')
    documents = read('data/documents/catalog.json')
    provenance = read('data/provenance.json')
    records = []
    outputs = {}
    for item in inputs['documents'] + inputs['manuals']:
        manual = item in inputs['manuals']
        law = dict(id=item['id'], name=item['name'], region='中央', category='建築與設計',
                   kind=item['kind'], url=item['url'], source=item['source'], coverage='link',
                   modified=item.get('modified', ''), effective=item.get('effective', ''),
                   effectiveNote=item['effectiveNote'], snapshot='', retrieved=item['retrieved'],
                   status='官方手冊書目；未收錄全文' if manual else '官方原始文件快照',
                   articles=[], history='', attachments=list(item['attachments']),
                   keywords=item['keywords'], note=item['note'])
        if not manual:
            raw = (ROOT / item['file']).read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            assert raw.startswith(b'%PDF') and digest == item['sha256'], item['id']
            assert len(raw) == item['bytes'], item['id']
            text = subprocess.check_output(['pdftotext', '-layout', str(ROOT / item['file']), '-']).decode('utf-8')
            parts = text.split('\f')
            assert not parts[-1].strip(), item['id']
            pages = [{'page': n + 1, 'text': part.strip()} for n, part in enumerate(parts[:-1])]
            assert len(pages) == item['pages'] and all(p['text'] for p in pages), item['id']
            assert ''.join(item['name'].split()) in ''.join(pages[0]['text'].split()), item['id']
            outputs[item['file'].replace('.pdf', '-text.json')] = {'pages': pages}
            doc = dict(format='pdf', file=item['file'], source=item['documentSource'],
                       sourcePage=item['url'], sha256=digest, hashScope='downloaded-pdf-file',
                       bytes=len(raw), pages=len(pages), retrieved=item['retrieved'],
                       versionNote=item['note'], textMethod='pdftotext -layout 原生文字抽取；無OCR、未重建表格或圖示。')
            documents[item['id']] = doc
            law['document'] = {k: doc[k] for k in ('format', 'pages', 'source', 'sourcePage', 'sha256', 'retrieved', 'versionNote')}
            law['attachments'].insert(0, {'title': '已收錄官方原始PDF（版本及勘誤見說明）', 'url': item['documentSource']})
            provenance['sources'][item['id']] = dict(url=item['documentSource'], sourcePage=item['url'], format='pdf',
                file=item['file'], sha256=digest, hashScope='downloaded-pdf-file', observedAt=item['retrieved'])
        else:
            assert not item.get('file') and not item.get('documentSource'), 'Manual full text is not licensed by this manifest'
            publication = item['publicationSource']
            raw = (ROOT / publication['file']).read_bytes()
            assert hashlib.sha256(raw).hexdigest() == publication['sha256'] and len(raw) == publication['bytes'], item['id']
            provenance['sources'][item['id']] = dict(url=item['url'], observedAt=item['retrieved'],
                file=publication['file'], format='html', sha256=publication['sha256'],
                hashScope='downloaded-publication-page-html', note='僅收錄書目與官方來源連結；雜湊對應出版頁HTML，不是手冊PDF，未下載或重製手冊全文。')
        records.append(law)
    assert len({r['id'] for r in records}) == len(records)
    laws = read('public/data/laws.json')
    for law in records:
        assert law['id'] not in laws or laws[law['id']]['name'] == law['name'], 'Canonical ID collision'
        laws[law['id']] = law
    catalog = read('data/catalog.json')
    catalog['collected'] = max([catalog['collected']] + [r['retrieved'] for r in records])
    catalog['laws'] = [{**law, 'articleCount': len(law['articles']),
                       'articles': [{'no': a['no'], 'text': '', 'path': a['path']} for a in law['articles']],
                       'history': ''} for law in laws.values()]
    outputs.update({'data/green-building-laws.json': records, 'data/documents/catalog.json': documents,
                    'data/provenance.json': provenance, 'public/data/laws.json': laws,
                    'data/catalog.json': catalog, 'public/data/catalog.json': catalog})
    for path, value in outputs.items():
        expected = encoded(path, value)
        if check:
            assert (ROOT / path).read_text(encoding='utf-8') == expected, 'Rebuild needed: ' + path
        else:
            (ROOT / path).write_text(expected, encoding='utf-8')
    print(('Verified' if check else 'Imported'), len(inputs['documents']), 'official PDF documents and', len(inputs['manuals']), 'link-only EEWH editions; total records', len(laws))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify deterministic output without writing')
    build(parser.parse_args().check)
