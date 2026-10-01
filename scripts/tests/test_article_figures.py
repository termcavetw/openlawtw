import unittest,json,hashlib,io
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import pdfplumber
from lxml import html
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
class ArticleFigureSources(unittest.TestCase):
 def test_official_article_pdf_and_lossless_image(self):
  records=json.loads((ROOT/'data/documents/article-figures/catalog.json').read_text())
  laws=json.loads((ROOT/'public/data/laws.json').read_text())
  for r in records:
   raw=(ROOT/r['file']).read_bytes();source=(ROOT/r['sourceHTML']).read_bytes()
   self.assertEqual(hashlib.sha256(raw).hexdigest(),r['sha256']);self.assertEqual(len(raw),r['bytes'])
   self.assertEqual(hashlib.sha256(source).hexdigest(),r['sourceHTMLSha256'])
   tree=html.fromstring(source);file_id=parse_qs(urlparse(r['source']).query)['FileId']
   links=tree.xpath('//a[contains(@href,"LawGetFile.ashx")]/@href')
   self.assertTrue(any(parse_qs(urlparse(link).query).get('FileId')==file_id for link in links))
   self.assertIn(r['articleText'],tree.text_content())
   article=next(a for a in laws[r['lawId']]['articles'] if a['no']==r['article'])
   self.assertEqual(article['text'],r['articleText'])
   self.assertTrue(any(a['url']==r['source'] for a in laws[r['lawId']]['attachments']))
   with pdfplumber.open(io.BytesIO(raw)) as pdf:
    self.assertEqual(len(pdf.pages),r['pages'])
    self.assertIn('第一百十六條之二',pdf.pages[0].extract_text())
    for img in r['images']:
     data=(ROOT/img['file']).read_bytes();page=pdf.pages[img['page']-1]
     self.assertEqual(hashlib.sha256(data).hexdigest(),img['sha256'])
     self.assertEqual(len(page.images),1)
     # Compare JPEG bytes embedded in the original, not a newly drawn table.
     self.assertEqual(data,page.images[0]['stream'].get_rawdata())
     with Image.open(io.BytesIO(data)) as image:self.assertEqual(image.size,(img['width'],img['height']))
     rect=[page.images[0][k] for k in ['x0','top','x1','bottom']]
     for actual,expected in zip(rect,img['sourceRect']):self.assertAlmostEqual(actual,expected,places=2)
