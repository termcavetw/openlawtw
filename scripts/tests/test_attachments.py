"""法規附件全文: file typing, browser bundles, and the stored files (offline)."""
import base64, importlib.util, json, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('attachments', ROOT / 'scripts/sync-attachments.py')
at = importlib.util.module_from_spec(spec)
spec.loader.exec_module(at)


class Typing(unittest.TestCase):
    def test_kinds(self):
        self.assertEqual(at.kind_of(b'%PDF-1.7 ...', 'a.pdf'), 'pdf')
        self.assertEqual(at.kind_of(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest', 'a.doc'), 'doc')
        self.assertEqual(at.kind_of(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest', 'a.xls'), 'xls')
        self.assertEqual(at.kind_of(b'PK\x03\x04' + b'\0' * 26 + b'mimetypeapplication/vnd.oasis.opendocument.text', 'a.odt'), 'odf')
        self.assertEqual(at.kind_of(b'\xef\xbb\xbf\r\n<!DOCTYPE html><html>', '官方附件下載'), 'page')
        self.assertEqual(at.kind_of(b'\xff\xd8\xff\xe0', 'a.jpg'), 'image')

    def test_bundle_import(self):
        url = 'https://law.example.gov.tw/Download.ashx?FileID=1&id=GL000001&type=LAW'
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, 'olw-job-x.json').write_text(json.dumps({url: base64.b64encode(b'%PDF-1.4').decode()}))
            files = at.load_imports([tmp])
        self.assertEqual(files[at.key_of(url)], b'%PDF-1.4')


class StoredFiles(unittest.TestCase):
    def test_index_matches_files(self):
        out = ROOT / 'public/data/attachments'
        index = json.loads((out / 'index.json').read_text(encoding='utf-8'))
        laws = json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8'))
        self.assertGreater(len(index['laws']), 0)
        for law_id, entry in index['laws'].items():
            d = json.loads((out / entry['file']).read_text(encoding='utf-8'))
            self.assertEqual(d['law'], law_id)
            self.assertEqual(len(d['attachments']), entry['attachments'])
            listed = {a['url'] for a in laws[law_id].get('attachments', [])}
            for a in d['attachments']:
                self.assertIn(a.get('listedOn', a['url']), listed, (law_id, a['title']))  # files of a listing page
                if a['kind'] not in ('missing',):
                    self.assertIsInstance(a['pages'], list)
                for page in a.get('pages') or []:
                    self.assertIn(page['method'], ('text', 'ocr'))
                    if page['method'] == 'ocr':
                        self.assertIn(page.get('engine'), ('paddle', 'tesseract'), (law_id, a['title']))

    def test_reviewed_transcription(self):
        d = json.loads((ROOT / 'public/data/attachments/桃園市-GL001285.json').read_text(encoding='utf-8'))
        first = [a for a in d['attachments'] if a['title'] == '附表一.pdf']
        self.assertTrue(first and all(a.get('transcription') for a in first))
        text = first[0]['transcription']['text']
        self.assertIn('H-1 → G-2：③', text)
        self.assertIn('D-5 → G-1：①', text)


class Listing(unittest.TestCase):
    def test_listing_page_becomes_its_files(self):
        page = ('<a href="/Law/File/0000258452" title="x">附表一  一定規模以下建築物變更使用類組免辦理變更使用執照表.pdf</a>'
                '<a href="/Law/File/0000380057">附表二之一.odt</a><a href="/Law/LawSearch/LawFileList/FL038035">清單</a>')
        item = {'index': 3, 'title': '官方附件下載', 'url': 'https://laws.gov.taipei/Law/LawSearch/LawFileList/FL038035'}
        orig = at.fetch
        at.fetch = lambda url, **k: page.encode()
        try:
            with tempfile.TemporaryDirectory() as d:
                saved, at.CACHE = at.CACHE, Path(d)
                try:
                    files = at.expand_listing(item, [])
                finally:
                    at.CACHE = saved
        finally:
            at.fetch = orig
        self.assertEqual([f['url'] for f in files], ['https://laws.gov.taipei/Law/File/0000258452', 'https://laws.gov.taipei/Law/File/0000380057'])
        self.assertEqual(files[0]['title'], '附表一 一定規模以下建築物變更使用類組免辦理變更使用執照表.pdf')
        self.assertTrue(all(f['index'] == 3 and f['listedOn'] == item['url'] for f in files))


if __name__ == '__main__':
    unittest.main()
