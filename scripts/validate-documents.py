"""Independent fidelity checks for original document text, tables and scoped gazette pages."""
from pathlib import Path
import json,re,hashlib
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
def main():
 catalog=json.loads((ROOT/'data/documents/catalog.json').read_text(encoding='utf-8'));squash=lambda s:re.sub(r'\s+','',s);html_count=0;pdf_count=0
 for id,source in catalog.items():
  raw=(ROOT/source['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==source['sha256'],id
  if source.get('format')=='html':
   tree=html.fromstring(raw);body=(tree.xpath('//table[contains(@id,"tableLawArticle")]') or tree.xpath('//*[contains(@id,"divLawContent08")]'))[0];doc=json.loads((ROOT/source['contentFile']).read_text(encoding='utf-8'));rendered=html.fromstring(doc['html'])
   assert squash(body.text_content())==squash(rendered.text_content())==squash(doc['pages'][0]['text']),id
   signature=lambda b:[(x.tag,x.get('colspan'),x.get('rowspan'),squash(x.text_content())) for x in b.xpath('.//td|.//th')]
   assert signature(body)==signature(rendered),id+' table cells'
   assert [(x.text_content(),x.get('href')) for x in rendered.xpath('.//a')] or not body.xpath('.//a'),id
   for el in rendered.iter():
    assert el.tag in {'div','p','span','b','strong','i','em','u','s','sup','sub','br','hr','table','tbody','thead','tfoot','tr','td','th','caption','colgroup','col','ul','ol','li','pre','h1','h2','h3','h4','h5','h6','a'},(id,el.tag)
    assert set(el.attrib)<={'colspan','rowspan','span','start','value','href','target','rel'},(id,el.attrib)
   html_count+=1
  else:
   doc=json.loads((ROOT/source['file'].replace('.pdf','-text.json')).read_text(encoding='utf-8'));assert len(doc['pages'])==source['pages'];pdf_count+=1
   if 'PDFium' in source.get('textMethod',''):
    import pypdfium2 as pdfium
    pdf=pdfium.PdfDocument(ROOT/source['file']);assert len(pdf)==len(doc['pages'])
    for n,saved in enumerate(doc['pages']):
     page=pdf[n];textpage=page.get_textpage();assert squash(textpage.get_text_range())==squash(saved['text']),(id,n+1,'PDF text differs');textpage.close();page.close()
    pdf.close()
   if source.get('searchRange'):
    scope=source['searchRange'];selected=[dict(p) for p in doc['pages'] if scope['startPage']<=p['page']<=scope['endPage']]
    selected[0]['text']=selected[0]['text'][selected[0]['text'].index(scope['startText']):];selected[-1]['text']=selected[-1]['text'][:selected[-1]['text'].index(scope['endText'])+len(scope['endText'])];assert selected==doc['searchPages'],id
 laws=json.loads((ROOT/'public/data/laws.json').read_text(encoding='utf-8'));pending=json.loads((ROOT/'data/local-expansion-round2-2026-09-29.json').read_text(encoding='utf-8'))['remainingLinks'];assert all(laws[x['id']].get('document') for x in pending)
 print(f'Verified {html_count} HTML source documents: all text and table cells retained; {pdf_count} PDF source hashes; all {len(pending)} formerly pending records have original documents.')
if __name__=='__main__':main()
