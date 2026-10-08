"""Offline transport/schema regression tests; fixture excerpt from official API."""
from pathlib import Path
import hashlib
import io
import json
import sys
import tempfile
import unittest
import urllib.error
import zipfile
import xml.etree.ElementTree as ET
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from official_fetch import download, SourceUnavailable
from central_refresh import refresh_bulk, read_bulk

FIX=Path(__file__).parent/'fixtures'/'moj-api.xml'


def archive(member, raw):
    target=io.BytesIO()
    with zipfile.ZipFile(target,'w') as z:
        z.writestr(member,raw);z.writestr('schema.csv','name,title\nLawName,法規名稱\n')
    return target.getvalue()


class TransportTests(unittest.TestCase):
    def test_bounded_retry_and_no_stale_success(self):
        calls=[];sleeps=[]
        def fail(*args,**kwargs):
            calls.append(1);raise urllib.error.URLError('Network is unreachable')
        with self.assertRaises(SourceUnavailable):
            download('https://law.moj.gov.tw/api/ch/law/xml',opener=fail,sleep=sleeps.append)
        self.assertEqual(len(calls),2);self.assertEqual(sleeps,[1])

    def test_http_404_is_not_retried(self):
        calls=[]
        def fail(*args,**kwargs):
            calls.append(1);raise urllib.error.HTTPError('https://law.moj.gov.tw/',404,'missing',{},None)
        with self.assertRaises(urllib.error.HTTPError):
            download('https://law.moj.gov.tw/',opener=fail,sleep=lambda _:None)
        self.assertEqual(len(calls),1)

    def test_http_and_tls_downgrade_rejected(self):
        with self.assertRaises(ValueError):download('http://law.moj.gov.tw/')


class BulkTests(unittest.TestCase):
    def test_actual_api_spelling_and_source_preservation(self):
        source=ET.parse(FIX).getroot()[0]
        result=read_bulk(FIX)[0]
        self.assertEqual(result.findtext('法規名稱'),source.findtext('LawName'))
        self.assertEqual(result.findtext('沿革內容'),source.findtext('LawHistories'))
        raw_rows=source.findall('LawArticles/Article')
        rows=result.find('法規內容')
        self.assertEqual(len(rows),len(raw_rows))
        for expected,row in zip(raw_rows,rows):
            if expected.findtext('ArticleType')=='C':
                self.assertEqual(row.text,expected.findtext('ArticleConctent'))
            else:
                self.assertEqual(row.findtext('條文內容'),expected.findtext('ArticleConctent'))
                self.assertEqual(row.findtext('條號'),expected.findtext('ArticleNo'))
        self.assertEqual([(x.findtext('檔案名稱'),x.findtext('下載網址')) for x in result.findall('附件/檔案')],
                         [(x.findtext('FileName'),x.findtext('FileURL')) for x in source.findall('LawAttachements/File')])

    def test_unknown_or_ambiguous_article_schema_rejected(self):
        for mutate in ('unknown','ambiguous','missing'):
            root=ET.parse(FIX).getroot();row=root.find('Law/LawArticles/Article')
            if mutate=='unknown':row.find('ArticleType').text='X'
            elif mutate=='ambiguous':ET.SubElement(row,'ArticleContent').text='duplicate'
            else:row.remove(row.find('ArticleConctent'))
            with tempfile.TemporaryDirectory() as d:
                p=Path(d)/'bad.xml';ET.ElementTree(root).write(p,encoding='utf-8')
                with self.assertRaises(ValueError):read_bulk(p)

    def test_raw_bytes_hash_actual_endpoint_and_schema(self):
        raw=FIX.read_bytes()
        def fetch(url,**kwargs):return archive('ChOrder.xml' if '/order/' in url else 'ChLaw.xml',raw)
        with tempfile.TemporaryDirectory() as d:
            refresh_bulk(d,fetch=fetch)
            for label,file,endpoint in [('laws','FalV.xml','law'),('orders','MingLing.xml','order')]:
                base=Path(d)/label;meta=json.loads((base/'source.json').read_text())
                self.assertEqual((base/file).read_bytes(),raw)
                self.assertEqual(meta['sha256'],hashlib.sha256(raw).hexdigest())
                self.assertEqual(meta['url'],f'https://law.moj.gov.tw/api/ch/{endpoint}/xml')
                self.assertEqual(meta['hashScope'],'downloaded-xml-file')
                self.assertTrue((base/'schema.csv').is_file())

    def test_second_download_failure_keeps_existing_raw_cache(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'laws'/'FalV.xml';path.parent.mkdir();path.write_bytes(b'old')
            def fetch(url,**kwargs):
                if '/order/' in url:raise SourceUnavailable('unavailable')
                return archive('ChLaw.xml',FIX.read_bytes())
            with self.assertRaises(SourceUnavailable):refresh_bulk(d,fetch=fetch)
            self.assertEqual(path.read_bytes(),b'old')

    def test_archive_traversal_or_missing_expected_member_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                refresh_bulk(d,fetch=lambda *a,**k:archive('../ChLaw.xml',FIX.read_bytes()))
            self.assertFalse((Path(d)/'laws').exists())

if __name__=='__main__':unittest.main()
