"""Cross-check the reader, search corpus, chapter index and evidence links."""
from pathlib import Path
import json, re, argparse, hashlib, urllib.parse, xml.etree.ElementTree as ET
p=argparse.ArgumentParser();p.add_argument("--cache",help="Optional directory of official raw HTML/XML for source completeness checks");args=p.parse_args()
ROOT=Path(__file__).resolve().parents[1]
D=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'));laws={x['id']:x for x in D['laws']}
bundle_path=ROOT/'public/data/laws.json'
bundle=json.loads(bundle_path.read_text(encoding='utf-8')) if bundle_path.exists() else {}
def read_law(id):
 return bundle[id]
assert len(laws)==len(D['laws']), 'Duplicate canonical ids'
assert len(D['regions'])==22 and len({r['name'] for r in D['regions']})==22
assert (ROOT/'data/catalog.json').read_bytes()==(ROOT/'public/data/catalog.json').read_bytes()
for law in D['laws']:
 assert law['url'].startswith('https://') and ('.gov.tw' in law['url'] or law['url'].startswith('https://laws.gov.taipei/'))
 doc=read_law(law['id'])
 assert doc['name']==law['name'] and len(doc['articles'])==len(law['articles'])
 assert len({a['no'] for a in doc['articles']})==len(doc['articles'])
 if law['coverage']=='full':
  assert doc['articles'] and all(a['text'] for a in doc['articles'])
  assert [{'no':a['no'],'text':'','path':a['path']} for a in doc['articles']]==law['articles']
 for a in doc['articles']:
  assert not any(v in a['text'] for v in ['<script','ctl00_cp_content','資訊安全政策']),law['name']
for rel in D['relations']:
 assert rel['parent'] in laws and rel['child'] in laws
 assert laws[rel['parent']]['name'] in rel['evidence']
 child=read_law(rel['child'])
 assert rel['evidence']==child['articles'][0]['text']
 assert rel['source']==child['url']
R=json.loads((ROOT/'public/data/rulings.json').read_text(encoding='utf-8'))['items']
for r in R:
 assert r['id'] in r['url'] and (r['body'] or r['number']) 
 for x in r['refs']:
  assert x['law'] in laws
  assert not x['article'] or x['article'] in [a['no'] for a in laws[x['law']]['articles']]
print(f"Validated {len(laws)} indexed laws, {sum(x['coverage']=='full' for x in laws.values())} full texts, {sum(len(x['articles']) for x in laws.values())} articles, {len(D['relations'])} evidence links, {len(R)} rulings.")

if args.cache:
 from lxml import html
 cache=Path(args.cache);checked=0;body_checked=0;blob_checked=0
 # Compare against independently extracted source cells. Only presentation
 # whitespace is ignored; punctuation, figures and legal wording must match.
 squash=lambda text:re.sub(r'\s+','',text)
 for law in D['laws']:
  if law['coverage']!='full' or law['region']=='中央':continue
  raw=cache/(law['id']+'.html')
  if not raw.exists():continue
  tree=html.fromstring(raw.read_bytes());tables=tree.xpath('//table[contains(@id,"tableLawArticle")]')
  if law['region']=='臺北市':
   rows=tree.xpath('//ul[@class="law law-content"]/li[.//div[@class="law-articlepre"]]');expected=len(rows)
   bodies=[row.xpath('.//div[@class="law-articlepre"]')[0].text_content() for row in rows]
  elif law['region']=='新北市':
   rows=tree.xpath('//tr[td[@class="col-th"] and td[@class="col-td"]/pre]');expected=len(rows)
   bodies=[row.xpath('./td[@class="col-td"]/pre')[0].text_content() for row in rows]
  elif tables:
   rows=[tr.xpath('./td|./th') for tr in tables[0].xpath('.//tr')]
   expected=sum(1 for cells in rows if len(cells)>=2 and cells[-1].text_content().strip())
   bodies=[cells[-1].text_content() for cells in rows if len(cells)>=2 and cells[-1].text_content().strip()]
  else:
   containers=tree.xpath('//*[contains(@id,"divLawContent08")]')
   assert containers,(law['name'],'missing official body container')
   source=squash(containers[0].text_content());cursor=0
   if read_law(law['id']).get('preamble'):
    prefix=squash(read_law(law['id'])['preamble']);assert source.startswith(prefix),(law['name'],'preamble differs');cursor=len(prefix)
   # These three existing source pages contain a title/publication preamble or
   # a part heading outside their numbered paragraphs. Preserve that exception
   # explicitly rather than allowing arbitrary dropped text in new imports.
   preambles={
    '連江縣-GL000083':'連江縣建築物簡化管理自治條例',
    '連江縣-GL000088':'連60-8連江縣聚落保存專用區建築管理自治條例中華民國95年10月30日連企法字第0950030739號令發布',
    '高雄市-GL002088':'壹、總則',
   }
   for index,article in enumerate(read_law(law['id'])['articles']):
    body=squash(article['text']);start=source.find(body,cursor)
    assert start>=cursor,(law['name'],article['no'],'source body differs')
    gap=source[cursor:start]
    for chapter in article['path']:gap=gap.replace(squash(chapter),'')
    if index==0 and law['id'] in preambles:
     prefix=preambles[law['id']]
     assert gap.startswith(prefix),(law['name'],'changed source preamble')
     gap=gap[len(prefix):]
    no=squash(article['no']);point=re.sub(r'^第|點$','',no)
    assert gap in [no,point,point+'、',point+'.',point+'．'],(law['name'],article['no'],'unparsed source text',gap[:100])
    cursor=start+len(body);body_checked+=1
   assert cursor==len(source),(law['name'],'unparsed trailing source text')
   blob_checked+=1
   continue
  assert expected==len(law['articles']),(law['name'],'official rows',expected,'parsed articles',len(law['articles']))
  for article,official in zip(read_law(law['id'])['articles'],bodies):
   body=squash(article['text']);source=squash(official)
   # Some GLRS cells include the article/point heading in the same cell.
   prefix=source[:-len(body)] if source.endswith(body) else None
   assert prefix is not None and (not prefix or re.fullmatch(r'第?[\d一二三四五六六七八九十百千零〇兩ㄧ]+(?:之[\d一二三四五六六七八九十百千零〇兩ㄧ]+)?(?:條(?:之[\d一二三四五六六七八九十百千零〇兩ㄧ]+)?|[、.．])',prefix)),(law['name'],article['no'],'source body differs')
   body_checked+=1
  checked+=1
 print(f'Official HTML row counts checked for {checked} local laws; no nonempty article row omitted.')
 print(f'Compared {body_checked} complete local article bodies against official sources, including {blob_checked} unstructured pages (presentation whitespace only).')

 if (ROOT/'data/provenance.json').exists():
  sources=json.loads((ROOT/'data/provenance.json').read_text(encoding='utf-8'))['sources'];verified=0
  for id,source in sources.items():
   path=cache/('laws/FalV.xml' if id=='CF' else 'orders/MingLing.xml' if id=='CM' else id+'.html')
   if path.exists():assert hashlib.sha256(path.read_bytes()).hexdigest()==source['sha256'],id;verified+=1
  print(f'Verified {verified} raw source SHA-256 records (file scope, not fabricated per-law raw hashes).')
 checked_xml=0
 for path in [cache/'laws/FalV.xml',cache/'orders/MingLing.xml']:
  if not path.exists():continue
  for item in ET.parse(path).getroot().findall('法規'):
   url=(item.findtext('法規網址') or '').strip();id=urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('pcode',[''])[0]
   if id not in bundle or bundle[id]['source']!='全國法規資料庫':continue
   official=[(a.findtext('條文內容') or '').strip() for a in item.findall('法規內容/條文') if (a.findtext('條號') or '').strip() and (a.findtext('條文內容') or '').strip()]
   assert official==[a['text'] for a in bundle[id]['articles']],id
   checked_xml+=1
 print(f'Compared full official XML article text for {checked_xml} central laws.')
