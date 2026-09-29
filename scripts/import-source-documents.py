"""Import faithful unnumbered/table HTML snapshots. Never invent article numbers."""
from pathlib import Path
import argparse,json,re,hashlib,shutil
from html import escape
from urllib.parse import urljoin,urlparse
from copy import deepcopy
from lxml import html
ROOT=Path(__file__).resolve().parents[1]
SAFE={'div','p','span','b','strong','i','em','u','s','sup','sub','br','hr','table','tbody','thead','tfoot','tr','td','th','caption','colgroup','col','ul','ol','li','pre','h1','h2','h3','h4','h5','h6','a'}
def safe_html(node,base):
 if not isinstance(node.tag,str):return ''
 tag=node.tag.lower();tag={'font':'span','center':'div'}.get(tag,tag)
 if tag not in SAFE:raise ValueError('Unreviewed source tag: '+tag)
 attrs=''
 for key in ['colspan','rowspan','span','start','value']:
  if node.get(key):
   value=node.get(key)
   if not re.fullmatch(r'\d{1,4}',value):raise ValueError('Unsafe numeric attribute')
   attrs+=' '+key+'="'+value+'"'
 if tag=='a' and node.get('href'):
  url=urljoin(base,node.get('href'))
  if urlparse(url).scheme not in ['http','https']:raise ValueError('Unsafe link')
  attrs+=' href="'+escape(url,quote=True)+'" target="_blank" rel="noreferrer"'
 content=escape(node.text or '')+''.join(safe_html(c,base)+escape(c.tail or '') for c in node)
 return '<'+tag+attrs+'>'+content+('' if tag in ['br','hr','col'] else '</'+tag+'>')
def text_of(node):
 node=deepcopy(node)
 for e in node.iter():
  if e.tag in ['br','p','div','tr','li','h1','h2','h3','h4','table']:e.tail='\n'+(e.tail or '')
  elif e.tag in ['td','th']:e.tail='\t'+(e.tail or '')
 return node.text_content().strip()
def read_source(id,record,source,cache):
 archived=ROOT/record['file'] if record.get('format')=='html' and record.get('file') else None
 p=archived if archived and archived.is_file() else Path(cache)/(id+'.html')
 raw=p.read_bytes();digest=hashlib.sha256(raw).hexdigest()
 if archived and p==archived and digest!=record.get('sha256'):
  raise ValueError('Archived HTML checksum mismatch: '+id)
 if digest!=source['sha256']:
  raise ValueError('Official source provenance checksum mismatch: '+id)
 return p,raw

def import_documents(cache=ROOT/'.law-cache',queue=None):
 catalog=json.loads((ROOT/'data/documents/catalog.json').read_text(encoding='utf-8'));provenance=json.loads((ROOT/'data/provenance.json').read_text(encoding='utf-8'))['sources']
 pending=json.loads(Path(queue).read_text(encoding='utf-8')) if queue else json.loads((ROOT/'data/local-expansion-round2-2026-09-29.json').read_text(encoding='utf-8'))['remainingLinks']
 for item in pending:
  id=item['id']
  if id in ['臺北市-FL069302','雲林縣-GL000243']:continue
  source=provenance[id];assert source['url']==item['source'],id+' source URL mismatch'
  p,raw=read_source(id,catalog.get(id,{}),source,cache)
  tree=html.fromstring(raw);nodes=tree.xpath('//table[contains(@id,"tableLawArticle")]') or tree.xpath('//*[contains(@id,"divLawContent08")]');assert len(nodes)==1,id
  body=nodes[0];markup=safe_html(body,item['source']);clean=html.fromstring(markup)
  squash=lambda s:re.sub(r'\s+','',s)
  assert squash(body.text_content())==squash(clean.text_content()),id
  table_signature=lambda n:[[(c.tag,c.get('rowspan'),c.get('colspan'),squash(c.text_content())) for c in row.xpath('./td|./th')] for row in n.xpath('.//tr')]
  assert table_signature(body)==table_signature(clean),id
  content={'format':'html','html':markup,'pages':[{'page':1,'text':text_of(body)}],'sha256':source['sha256']}
  stem='data/documents/'+id;destination=ROOT/(stem+'-source.html')
  if p.resolve()!=destination.resolve():shutil.copy2(p,destination)
  (ROOT/(stem+'.json')).write_text(json.dumps(content,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
  catalog[id]={'format':'html','file':stem+'-source.html','contentFile':stem+'.json','source':item['source'],'sourcePage':item['source'],'sha256':source['sha256'],'hashScope':source.get('hashScope','downloaded-html'),'bytes':len(raw),'pages':1,'retrieved':source['observedAt'],'versionNote':'官方頁面正文快照；保留表格、原始標題及編號順序。未重新編排為條文；獨立附表與圖說仍請核對官方附件。'+('原頁包含重複編號，依原頁順序完整呈現。' if '重複' in item['reason'] else ''),'textMethod':'HTML 本文全部文字與表格列、欄合併逐一核對；移除站台樣式及可執行內容。'}
  print(id,len(content['pages'][0]['text']),len(body.xpath('.//tr')))
 (ROOT/'data/documents/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--cache',type=Path,default=ROOT/'.law-cache',help='Fallback raw HTML directory when the catalogued source archive is absent')
 parser.add_argument('--queue',type=Path,help='JSON list of verified source IDs, URLs and fallback reasons')
 args=parser.parse_args();import_documents(args.cache,args.queue)
