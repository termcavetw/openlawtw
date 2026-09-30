"""Independent fidelity tests against preserved official gazette PDFs."""
import hashlib,json,re,unittest
from pathlib import Path
import pypdfium2 as pdfium
ROOT=Path(__file__).resolve().parents[2]
def read(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))
def squash(s):return re.sub(r'\s+','',s)
class FormalSourceTests(unittest.TestCase):
 def test_sources_and_canonical_records(self):
  laws=read('public/data/laws.json');sources=read('data/provenance.json')['sources']
  formal=read('data/formal-laws.json');self.assertEqual(len(formal),3)
  for law in formal:
   self.assertEqual(law,laws[law['id']])
   source=sources[law['id']];self.assertEqual(source['hashScope'],'downloaded-pdf-file')
   self.assertEqual(hashlib.sha256((ROOT/source['file']).read_bytes()).hexdigest(),source['sha256'])
  self.assertNotIn('特建',read('data/aliases.json'))
 def test_complete_institution_articles(self):
  law=read('public/data/laws.json')['NCC-FL096019'];pdf=pdfium.PdfDocument(ROOT/'data/formal-sources/FL096019.pdf')
  text=''.join(re.sub(r'行政院公報[^\n]*\n','',pdf[i].get_textpage().get_text_range()) for i in range(9,13))
  text=squash(text);text=text[text.index('第一條'):]
  expected=''.join(squash(a['no']+a['text']) for a in law['articles'])
  self.assertEqual(expected,text);self.assertEqual(len(law['articles']),16)
  self.assertEqual(law['modified'],'2021-02-22');self.assertIn('第八十七條第二項',law['articles'][0]['text'])
  self.assertNotIn('電信室：',expected) # Different rule on pp1–9 never merged into this rule.
 def test_complete_fire_points(self):
  law=read('public/data/laws.json')['內政部-GL001203'];pdf=pdfium.PdfDocument(ROOT/'data/formal-sources/GL001203.pdf')
  text=''.join(re.sub(r'行政院公報[^\n]*\n','',p.get_textpage().get_text_range()) for p in pdf)
  text=squash(text);text=text[text.index('一、為利'):text.index('本案附件篇幅過鉅')]
  expected=''.join(re.sub(r'^第|點$','',a['no'])+'、'+squash(a['text']) for a in law['articles'])
  self.assertEqual(expected,text);self.assertEqual(len(law['articles']),12)
  self.assertEqual(law['kind'],'行政規則');self.assertIn('僅修正第六點附件七',law['effectiveNote'])
 def test_norm_original_and_search_scope(self):
  law=read('public/data/laws.json')['NCC-FL096222'];source=read('data/documents/catalog.json')[law['id']]
  pdf=pdfium.PdfDocument(ROOT/source['file']);pages=read(source['file'].replace('.pdf','-text.json'))['pages']
  self.assertEqual(len(pdf),177);self.assertEqual(len(pages),177)
  self.assertEqual(law['articles'],[]);self.assertEqual(law['coverage'],'link');self.assertTrue(law['document'])
  self.assertIn('第四十九條第七項',pages[0]['text'])
  self.assertTrue(any('弱電系統' in p['text'] for p in pages))
  self.assertEqual(source['sha256'],law['document']['sha256'])
if __name__=='__main__':unittest.main()
