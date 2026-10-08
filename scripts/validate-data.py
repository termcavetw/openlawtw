"""Cross-check the reader, search corpus, chapter index and evidence links."""
from pathlib import Path
import json, re, argparse, hashlib, urllib.parse, xml.etree.ElementTree as ET
p=argparse.ArgumentParser();p.add_argument("--cache",help="Optional directory of official raw HTML/XML for source completeness checks");p.add_argument('--source-ids',help='Comma-separated law IDs to restrict raw-source checks; core validation still covers every law');args=p.parse_args()
ROOT=Path(__file__).resolve().parents[1]
D=json.loads((ROOT/'data/catalog.json').read_text(encoding='utf-8'));laws={x['id']:x for x in D['laws']}
source_ids=None if args.source_ids is None else {id.strip() for id in args.source_ids.split(',') if id.strip()}
if source_ids is not None:
 if not args.cache:p.error('--source-ids requires --cache')
 if not source_ids:p.error('--source-ids must contain at least one law ID')
 unknown=source_ids-laws.keys()
 if unknown:p.error('Unknown --source-ids: '+', '.join(sorted(unknown)))
bundle_path=ROOT/'public/data/laws.json'
bundle=json.loads(bundle_path.read_text(encoding='utf-8')) if bundle_path.exists() else {}
XML_PATHS={'CF':'laws/FalV.xml','CM':'orders/MingLing.xml'}
def source_path(cache,id,source):
 if source.get('format')=='xml' or id in XML_PATHS:
  key=source.get('bulkKey') or (id if id in XML_PATHS else None)
  if key not in XML_PATHS:raise ValueError('XML provenance requires a valid bulkKey: '+id)
  if source.get('lawId') and source['lawId']!=id:raise ValueError('XML provenance lawId mismatch: '+id)
  return cache/XML_PATHS[key]
 return cache/(id+'.html')

def legacy_xml_key(law):
 if law['kind']=='法律':return 'CF'
 if law['kind']=='法規命令':return 'CM'
 raise ValueError('Cannot identify legacy XML source for '+law['id'])
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
  if source_ids is not None and law['id'] not in source_ids:continue
  if law['coverage']!='full' or law['source']=='全國法規資料庫':continue
  raw=cache/(law['id']+'.html')
  if not raw.exists():continue
  tree=html.fromstring(raw.read_bytes());tables=tree.xpath('//table[contains(@id,"tableLawArticle")]')
  from local_formats import validate_reviewed
  if validate_reviewed(tree,read_law(law['id'])):
   body_checked+=len(law['articles']);checked+=1;continue
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

 sources={};verified=0;digests={}
 def source_digest(path):
  if path not in digests:digests[path]=hashlib.sha256(path.read_bytes()).hexdigest()
  return digests[path]
 if (ROOT/'data/provenance.json').exists():
  sources=json.loads((ROOT/'data/provenance.json').read_text(encoding='utf-8'))['sources']
  selected_sources=sources
  if source_ids is not None:
   selected_sources={}
   for id in sorted(source_ids):
    key=id if id in sources else legacy_xml_key(laws[id]) if laws[id]['source']=='全國法規資料庫' else id
    assert key in sources,(id,'missing source provenance')
    selected_sources[key]=sources[key]
  for id,source in selected_sources.items():
   path=source_path(cache,id,source)
   if source_ids is not None:assert path.is_file(),(id,'selected raw source is missing',str(path))
   if path.exists():assert source_digest(path)==source['sha256'],(id,'raw source SHA-256 mismatch');verified+=1
   if source.get('schema')=='moj-openapi-v1' and path.exists():
    schema=path.parent/'schema.csv';archive=path.parent.parent/(path.parent.name+'.zip')
    assert schema.is_file() and source_digest(schema)==source['schemaSha256'],(id,'API schema SHA-256 mismatch')
    assert archive.is_file() and source_digest(archive)==source['archiveSha256'],(id,'API archive SHA-256 mismatch')
   if source.get('history'):
    hp=cache/(id+'-history.html')
    if source_ids is not None:assert hp.is_file(),(id,'selected history source is missing')
    if hp.exists():assert source_digest(hp)==source['history']['sha256'],(id,'history SHA-256 mismatch')
  print(f'Verified {verified} raw source SHA-256 records (file scope, not fabricated per-law raw hashes).')
 elif source_ids is not None:
  raise ValueError('Scoped source validation requires data/provenance.json')
 # Independently compare MOJ HTML article rows and all body characters. The
 # importer owns line boundaries; this check independently rejects omitted,
 # duplicated or rewritten official text, headings, metadata and attachments.
 checked_html_ids=set()
 for id,source in sources.items():
  if source_ids is not None and id not in source_ids:continue
  if source.get('parser')!='moj-lawall-html' or id not in bundle:continue
  path=cache/(id+'.html')
  if not path.exists():continue
  tree=html.fromstring(path.read_bytes(),parser=html.HTMLParser(encoding='utf-8'))
  rows=tree.xpath('//*[@id="pnLawFla"]//div[@class="law-reg-content"]/div[contains(concat(" ",normalize-space(@class)," ")," row ")]')
  assert len(rows)==len(bundle[id]['articles']),(id,'MOJ article count')
  for row,article in zip(rows,bundle[id]['articles']):
   no=row.xpath('./div[@class="col-no"]/a')[0].text_content()
   body=row.xpath('./div[@class="col-data"]/div[@class="law-article"]')[0].text_content()
   assert squash(no)==squash(article['no']),(id,'MOJ article number')
   assert squash(body)==squash(article['text']),(id,article['no'],'MOJ original text differs')
  meta=tree.xpath('//*[@id="hlLawName"]/ancestor::table[1]')[0]
  date_cells=meta.xpath('.//tr[th[contains(.,"修正日期") or contains(.,"公布日期")]]/td')
  assert len(date_cells)==1,(id,'MOJ date metadata')
  dm=re.search(r'民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日',date_cells[0].text_content())
  assert dm,(id,'MOJ ROC date')
  year,month,day=map(int,dm.groups())
  assert bundle[id]['modified']==f'{year+1911:04d}-{month:02d}-{day:02d}',(id,'MOJ modified date')
  effect=meta.xpath('.//tr[th[contains(.,"生效狀態")]]/td')
  effect_text=''
  if effect:
   from copy import deepcopy
   ec=deepcopy(effect[0])
   for link in ec.xpath('.//a'):link.drop_tree()
   effect_text=ec.text_content()
  assert squash(effect_text)==squash(bundle[id]['effectiveNote']),(id,'MOJ effective notice')
  assert bundle[id]['effective']=='',(id,'HTML import must not infer a whole-law effective date')
  chapter_path=[];article_index=0
  for node in tree.xpath('//*[@id="pnLawFla"]//div[@class="law-reg-content"]/*'):
   if re.search(r'(?:^| )char-\d+(?: |$)',node.get('class','')):
    label=re.sub(r'\s+',' ',node.text_content()).strip()
    match=re.match(r'^第\s*[\d一二三四五六七八九十百千零〇兩\s]+([編章節款目])',label)
    assert match,(id,'MOJ chapter heading')
    level='編章節款目'.index(match.group(1));chapter_path=[(n,t) for n,t in chapter_path if n<level]+[(level,label)]
   elif 'row' in node.get('class','').split():
    assert bundle[id]['articles'][article_index]['path']==[t for _,t in chapter_path],(id,'MOJ chapter path',article_index)
    article_index+=1
  official_title=tree.xpath('//*[@id="hlLawName"]')[0].text_content()
  assert squash(official_title)==squash(bundle[id]['name']),(id,'MOJ name')
  links=tree.xpath('//*[@id="hlLawName"]/ancestor::table[1]//a[contains(@href,"LawGetFile.ashx")]/@href')
  assert {urllib.parse.urljoin(source['url'],url) for url in links}=={a['url'] for a in bundle[id]['attachments']},(id,'MOJ attachments')
  history_path=cache/(id+'-history.html')
  if history_path.exists():
   htree=html.fromstring(history_path.read_bytes(),parser=html.HTMLParser(encoding='utf-8'))
   htexts=htree.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," law-history ")]//*[contains(concat(" ",normalize-space(@class)," ")," text-pre ")]')
   assert squash(''.join(h.text_content() for h in htexts))==squash(bundle[id]['history']),(id,'MOJ history')
  checked_html_ids.add(id)
 print(f'Compared complete official HTML text and attachments for {len(checked_html_ids)} central laws.')
 checked_xml=0;checked_xml_ids=set()
 for bulk_key,relative_path in XML_PATHS.items():
  path=cache/relative_path
  if not path.exists():continue
  xml_root=ET.parse(path).getroot();is_api=xml_root.tag=='Laws'
  for item in xml_root.findall('Law' if is_api else '法規'):
   url=(item.findtext('LawURL' if is_api else '法規網址') or '').strip();id=urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('pcode',[''])[0]
   if source_ids is not None and id not in source_ids:continue
   if id not in bundle or bundle[id]['source']!='全國法規資料庫':continue
   specific=sources.get(id)
   if specific and specific.get('parser')=='moj-lawall-html':continue
   if specific and specific.get('format')=='xml':
    expected_path=source_path(cache,id,specific)
    if path!=expected_path:continue
    assert source_digest(path)==specific['sha256'],(id,'per-law XML snapshot SHA-256 mismatch')
   elif sources.get(bulk_key):
    assert source_digest(path)==sources[bulk_key]['sha256'],(id,'legacy XML snapshot SHA-256 mismatch')
   if is_api:
    for field in ['LawLevel','LawName','LawURL','LawModifiedDate','LawEffectiveDate','LawEffectiveNote','LawAbandonNote','LawHistories','LawForeword']:
     nodes=item.findall(field)
     assert len(nodes)==1 and not len(nodes[0]),(id,'API missing/duplicate/structured scalar',field)
    assert len(item.findall('LawArticles'))==1 and len(item.findall('LawAttachements'))==1,(id,'API duplicate/missing container')
    for row in item.findall('LawArticles/Article'):
     for field in ['ArticleType','ArticleNo']:
      nodes=row.findall(field)
      assert len(nodes)==1 and not len(nodes[0]),(id,'API invalid article scalar',field)
     fields=row.findall('ArticleConctent')+row.findall('ArticleContent')
     assert len(fields)==1 and not len(fields[0]),(id,'API missing/duplicate/structured article body')
    for attachment in item.findall('LawAttachements/File'):
     for field in ['FileName','FileURL']:
      nodes=attachment.findall(field)
      assert len(nodes)==1 and not len(nodes[0]),(id,'API invalid attachment scalar',field)
    rows=[a for a in item.findall('LawArticles/Article') if (a.findtext('ArticleType') or '').strip()=='A']
    official=[]
    for row in rows:
     fields=row.findall('ArticleConctent')+row.findall('ArticleContent')
     assert len(fields)==1,(id,'API article text field')
     no=re.sub(r'\s+',' ',row.findtext('ArticleNo') or '').strip();text=(fields[0].text or '').strip()
     assert no and text,(id,'API empty article')
     official.append({'no':no,'text':text})
    assert official==[{'no':a['no'],'text':a['text']} for a in bundle[id]['articles']],(id,'API original article number/text')
    assert (item.findtext('LawName') or '').strip()==bundle[id]['name'],(id,'API law name')
    assert (item.findtext('LawHistories') or '').strip()==bundle[id]['history'],(id,'API original history')
    assert (item.findtext('LawEffectiveNote') or '').strip()==bundle[id]['effectiveNote'],(id,'API effective notice')
    for field,key in [('LawModifiedDate','modified'),('LawEffectiveDate','effective')]:
     value=(item.findtext(field) or '').strip();value=f'{value[:4]}-{value[4:6]}-{value[6:8]}' if re.fullmatch(r'\d{8}',value) else value
     assert value==bundle[id][key],(id,'API date',field)
    attachments=[{'title':a.findtext('FileName') or '附件','url':a.findtext('FileURL') or ''} for a in item.findall('LawAttachements/File')]
    assert attachments==bundle[id]['attachments'],(id,'API original attachments')
    chapter_path=[];index=0
    for row in item.findall('LawArticles/Article'):
     kind=(row.findtext('ArticleType') or '').strip()
     text=row.findtext('ArticleConctent') if row.find('ArticleConctent') is not None else row.findtext('ArticleContent')
     if kind=='C':
      label=re.sub(r'\s+',' ',text or '').strip();match=re.search('[編章節款目]',label)
      level='編章節款目'.index(match.group()) if match else 1
      chapter_path=[(n,t) for n,t in chapter_path if n<level]+[(level,label)]
     else:
      assert kind=='A',(id,'API unknown article kind')
      assert bundle[id]['articles'][index]['path']==[t for _,t in chapter_path],(id,'API chapter path',index)
      index+=1
    level=(item.findtext('LawLevel') or '').strip()
    assert bundle[id]['kind']==('法規命令' if level=='命令' else level),(id,'API law level')
    assert not (item.findtext('LawAbandonNote') or '').strip(),(id,'API inactive law')
    assert not (item.findtext('LawForeword') or '').strip(),(id,'API unimported foreword')
   else:
    official=[(a.findtext('條文內容') or '').strip() for a in item.findall('法規內容/條文') if (a.findtext('條號') or '').strip() and (a.findtext('條文內容') or '').strip()]
    assert official==[a['text'] for a in bundle[id]['articles']],id
   checked_xml+=1;checked_xml_ids.add(id)
 if source_ids is not None or args.cache:
  expected={id for id in (source_ids if source_ids is not None else laws) if laws[id]['source']=='全國法規資料庫'}
  assert expected<=checked_xml_ids|checked_html_ids,('Selected laws missing from their official XML/HTML',sorted(expected-(checked_xml_ids|checked_html_ids)))
 print(f'Compared full official XML article text for {checked_xml} central laws.')
