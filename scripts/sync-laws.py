"""Build traceable law snapshots from official sources. Python 3 + lxml.
No AI rewrites. Download ZIP/XML to a local cache; preserve article text.
Usage: python scripts/sync-laws.py --cache /path/to/cache
"""
from pathlib import Path
import argparse, json, re, urllib.request, urllib.parse, zipfile, hashlib, unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
from lxml import html

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--cache',default='.law-cache');p.add_argument('--refresh',action='store_true');p.add_argument('--add-only',action='store_true',help='Preserve existing full snapshots and retrieve missing local texts');p.add_argument('--only-sites',default='',help='Update only these local sites');p.add_argument('--skip-sites',default='',help='Comma-separated unavailable official sites: retain previous snapshot or link');a=p.parse_args()
if a.add_only and a.refresh:p.error('--add-only and --refresh are mutually exclusive')
CACHE=Path(a.cache);CACHE.mkdir(parents=True,exist_ok=True)
NOW=datetime.now(timezone.utc).isoformat(timespec='seconds')
GROUPS={
 '建築與設計':['建築法','建築技術規則總則編','建築技術規則建築設計施工編','建築技術規則建築構造編','建築技術規則建築設備編','建築師法','營造業法','建築基地法定空地分割辦法','建築物無障礙設施設計規範','建築物耐震設計規範及解說','實施都市計畫以外地區建築物管理辦法'],
 '使用與室內裝修':['建築物使用類組及變更使用辦法','建築物室內裝修管理辦法','建築物公共安全檢查簽證及申報辦法','公寓大廈管理條例','公寓大廈管理條例施行細則','違章建築處理辦法','招牌廣告及樹立廣告管理辦法','建築物昇降設備設置及檢查管理辦法','建築物機械停車設備設置及檢查管理辦法','機械遊樂設施設置及檢查管理辦法'],
 '都市計畫與土地':['都市計畫法','都市計畫法臺灣省施行細則（89.12.29 訂定）','都市計畫定期通盤檢討實施辦法','都市計畫容積移轉實施辦法','區域計畫法','區域計畫法施行細則','非都市土地使用管制規則','國土計畫法','國土計畫法施行細則','土地法','土地登記規則','平均地權條例'],
 '都市更新與危老':['都市更新條例','都市更新條例施行細則','都市更新建築容積獎勵辦法','都市危險及老舊建築物加速重建條例','都市危險及老舊建築物加速重建條例施行細則','都市危險及老舊建築物建築容積獎勵辦法','都市危險及老舊建築物結構安全性能評估辦法'],
 '消防與公共安全':['消防法','消防法施行細則','各類場所消防安全設備設置標準','公共危險物品及可燃性高壓氣體製造儲存處理場所設置標準暨安全管理辦法','消防安全設備檢修及申報辦法','建築物防火避難設施及設備安全標準檢查簽證專業機構或人員認可辦法'],
 '農業與山坡地':['農業發展條例','農業用地興建農舍辦法','申請農業用地作農業設施容許使用審查辦法','水土保持法','水土保持法施行細則','水土保持技術規範','山坡地建築管理辦法','山坡地保育利用條例','休閒農業輔導管理辦法'],
 '環境與其他規範':['環境影響評估法','環境影響評估法施行細則','開發行為應實施環境影響評估細目及範圍認定標準','文化資產保存法','文化資產保存法施行細則','工廠管理輔導法','停車場法','身心障礙者權益保障法','下水道法']
}
for category,names in json.loads((ROOT/'data/expanded-central.json').read_text()).items():
 GROUPS.setdefault(category,[]).extend(n for n in names if n not in GROUPS[category])
NAMES={n:g for g,ns in GROUPS.items() for n in ns}
seed=json.loads((ROOT/'data/extension-seed.json').read_text())
previous=json.loads((ROOT/'public/data/laws.json').read_text()) if (ROOT/'public/data/laws.json').exists() else {}
provenance_path=ROOT/'data/provenance.json'
provenance=json.loads(provenance_path.read_text()) if provenance_path.exists() else {'schemaVersion':2,'sources':{}}

def fetch(url,filename):
 path=CACHE/filename
 if path.exists() and not a.refresh:return path.read_bytes()
 req=urllib.request.Request(url,headers={'User-Agent':'OpenLawTW/0.10 (official source snapshot)'})
 with urllib.request.urlopen(req,timeout=20) as r:b=r.read()
 path.write_bytes(b);return b

def date8(v):
 v=v.strip();return f'{v[:4]}-{v[4:6]}-{v[6:8]}' if re.fullmatch(r'\d{8}',v) else v

def compact(s):return re.sub(r'\s+',' ',s).strip()
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s)).replace('台','臺')
def localcat(n):
 if any(t in n for t in ['都市更新','都市更新','危險及老舊','危老']):return '都市更新與危老'
 if any(t in n for t in ['消防','防火','容留人數']):return '消防與公共安全'
 if any(t in n for t in ['農業','農舍','水土保持','山坡地']):return '農業與山坡地'
 if any(t in n for t in ['都市計畫','畸零地','都市設計','土地']):return '都市計畫與土地'
 if any(t in n for t in ['廣告','使用','室內','容留']):return '使用與室內裝修'
 return '建築與設計'

laws=[]; snapshots=[]; report={'fetchedAt':NOW,'missingCentral':[],'localFailures':[],'checks':[]}
for label,key,xml in [('laws','CF','FalV.xml'),('orders','CM','MingLing.xml')]:
 if a.add_only and previous:
  if label=='laws':
   preserved=[doc for doc in previous.values() if doc['source']=='全國法規資料庫']
   laws.extend(preserved)
   snapshots.extend(sorted({doc.get('snapshot','') for doc in preserved}) or [''])
  # Adding local documents must not download a newer central XML and then
  # advertise that date/hash for central text retained from an older snapshot.
  continue
 target=CACHE/label/xml
 if not target.exists() or a.refresh:
  fetch('https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?AuData='+key+'&DType=XML',label+'.zip')
  with zipfile.ZipFile(CACHE/(label+'.zip')) as z:z.extractall(CACHE/label)
 root=ET.parse(target).getroot(); snapshot=root.attrib.get('UpdateDate','');snapshots.append(snapshot)
 if not a.add_only or key not in provenance['sources']:
  provenance['sources'][key]={'url':'https://sendlaw.moj.gov.tw/PublicData/GetFile.ashx?AuData='+key+'&DType=XML','format':'xml','sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'hashScope':'downloaded-xml-file','observedAt':NOW,'snapshot':snapshot}
 for item in root.findall('法規'):
  get=lambda k:(item.findtext(k) or '').strip()
  name=get('法規名稱')
  if name not in NAMES or get('廢止註記'):continue
  url=get('法規網址');code=urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get('pcode',[''])[0]
  if not code:continue
  if a.add_only and code in previous:
   laws.append(previous[code]);continue
  articles=[];path=[]
  for part in item.find('法規內容'):
   if part.tag=='編章節':
    label=compact(part.text or '')
    match=re.search('[編章節款目]',label); level='編章節款目'.index(match.group()) if match else 1
    path=[q for q in path if q[0]<level]+[(level,label)]
   elif part.tag=='條文':
    no=compact(part.findtext('條號') or '')
    text=(part.findtext('條文內容') or '').strip()
    if no and text: articles.append({'no':no,'text':text,'path':[q[1] for q in path]})
  att=[{'title':f.findtext('檔案名稱') or '附件','url':f.findtext('下載網址') or ''} for f in item.findall('附件/檔案')]
  laws.append(dict(id=code,name=name,region='中央',category=NAMES[name],kind='法規命令' if get('法規性質')=='命令' else get('法規性質'),url=url,source='全國法規資料庫',coverage='full',modified=date8(get('最新異動日期')),effective=date8(get('生效日期')),effectiveNote=get('生效內容'),snapshot=snapshot,retrieved=NOW,status='來源未標廢止',articles=articles,history=get('沿革內容'),attachments=att,keywords=[]))
report['missingCentral']=[n for n in NAMES if not any(l['name']==n for l in laws)]
regions=[{'name':n,'url':u,'kind':'GLRS'} for n,u in seed['hosts'].items() if n not in ['內政部','農業部']]
regions += [{'name':n,'url':v['host'],'kind':v['kind']} for n,v in seed['sites'].items()]
order=['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣']
regions.sort(key=lambda r:order.index(r['name']))


def gettext(node):
 for br in node.xpath('.//br'):br.tail='\n'+(br.tail or '')
 for x in node.xpath('.//p|.//div'):
  if x.tail is None:x.tail='\n'
 return node.text_content().strip()

def getlocal(job):
 name,val=job;site=val['site'];code=val['id'];sid=site+'-'+code
 if a.add_only and previous.get(sid,{}).get('coverage')=='full':return previous[sid]
 host=seed['hosts'].get(site) or seed['sites'].get(site,{}).get('host')
 if not host:return None
 if site=='臺中市':host='https://law.taichung.gov.tw'
 url=(host+'/Law/LawSearch/LawArticleContent/'+code if site=='臺北市' else host+'/Scripts/FLAWDAT0202.aspx?fcode='+code if site=='新北市' else host+'/LawContent.aspx?id='+code)
 doc=dict(id=sid,name=name,region='中央' if site in ['內政部','農業部'] else site,category=val.get('category',localcat(name)),kind='自治條例' if '自治條例' in name else '地方規定',url=url,source=site+'法規查詢系統',coverage='link',modified='',effective='',effectiveNote='',snapshot='',retrieved='',status='待核對',articles=[],history='',attachments=[],keywords=[],note='已核對官方索引連結；尚未完整收錄文字。')
 if a.only_sites and site not in a.only_sites.split(',') and sid in previous:
  cached=CACHE/(sid+'.html')
  if cached.exists() and b'LawContent' in cached.read_bytes():
   provenance['sources'][sid]={'url':previous[sid]['url'],'format':'html','sha256':hashlib.sha256(cached.read_bytes()).hexdigest(),'hashScope':'downloaded-html-file','observedAt':previous[sid]['retrieved']}
  return previous[sid]
 try:
  if site in a.skip_sites.split(','):raise ValueError('官方來源本次無法連線，保留快照或官方連結')
  raw=fetch(url,sid+'.html'); tree=html.fromstring(raw)
  provenance['sources'][sid]={'url':url,'format':'html','sha256':hashlib.sha256(raw).hexdigest(),'hashScope':'downloaded-html-file','observedAt':datetime.fromtimestamp((CACHE/(sid+'.html')).stat().st_mtime,timezone.utc).isoformat(timespec='seconds')}
  abolished=tree.xpath('//tr[th[contains(.,"廢止日期") or contains(.,"停止適用日期")]]/td')
  if abolished and compact(abolished[0].text_content()):
   report.setdefault('excludedInactive',[]).append({'name':name,'url':url,'date':compact(abolished[0].text_content())});return None
  rows=tree.xpath('//tr[th[contains(normalize-space(.),"法規名稱")]]/td')
  actual=compact(rows[0].text_content()) if rows else ''
  if site=='臺北市':
   names=tree.xpath('//div[contains(@class,"form-group")]//a[@class="law-link"]');actual=compact(names[0].text_content()) if names else ''
  if site=='新北市':actual=re.sub(r'\s*[（(]民國.*$','',actual)

  if actual.startswith(('廢','停')):
   report.setdefault('excludedInactive',[]).append({'name':name,'url':url,'reason':actual});return None
  if norm(actual).removesuffix('英')!=norm(name):
   known={'桃園市政府受理興辦工業人利用非都市土地使用管制規則申請變更編定為丁種建築用地審查作業要點':'桃園市政府受理非都市土地使用管制規則申請變更編定為丁種建築用地審查作業要點'}
   if actual==known.get(name):doc['keywords']=[name];doc['name']=actual
   else:raise ValueError('名稱不符：'+actual)
  if val.get('linkOnlyReason'):
   attachments=[{'title':compact(el.text_content()) or '官方附件','url':urllib.parse.urljoin(url,el.get('href'))} for el in tree.xpath('//a[contains(@href,"Download.ashx") or contains(@href,"LawFileList")]')]
   doc.update(retrieved=provenance['sources'][sid]['observedAt'],status='已核對官方頁面',attachments=list({x['url']:x for x in attachments}.values()),note=val['linkOnlyReason'])
   report['checks'].append({'name':name,'url':url,'type':'link-only','reason':val['linkOnlyReason']})
   return doc
  table=tree.xpath('//table[contains(@id,"tableLawArticle")]')
  articles=[];path=[]
  chars=r'\d一二三四五六七八九十百千零〇兩ㄧ'
  article_re=r'(第?[\s'+chars+r']+條(?:之[\s'+chars+r']+)?)'
  if site=='臺北市':
   containers=tree.xpath('//ul[@class="law law-content"]')
   if not containers:raise ValueError('無臺北法規條文容器')
   for row in containers[0].xpath('./li'):
    if row.get('class','').startswith('chapter'):path=[compact(row.text_content())];continue
    no=row.xpath('.//div[@class="col-no"]');body=row.xpath('.//div[@class="law-articlepre"]')
    if no and body:articles.append({'no':compact(no[0].text_content()),'text':gettext(body[0]),'path':path[:]})
    elif body:
     text=gettext(body[0]);m=re.match(r'^(['+chars+r']+(?:之['+chars+r']+)?)[、.．]',text)
     if not m:raise ValueError('無法識別臺北條文段落，保留連結待核對：'+text[:35])
     articles.append({'no':'第'+m.group(1)+'點','text':text[m.end():].strip(),'path':path[:]})
  elif site=='新北市':
   for row in tree.xpath('//tr[td[contains(@class,"col-th")]]'):
    no=row.xpath('./td[@class="col-th"]');body=row.xpath('./td[@class="col-td"]/pre')
    if no and body:
     label=compact(no[0].text_content());label='第 '+label+' 點' if re.fullmatch(r'\d+',label) else label
     articles.append({'no':label,'text':gettext(body[0]),'path':[]})
  elif table:
   for tr in table[0].xpath('.//tr'):
    cells=tr.xpath('./td|./th')
    if len(cells)==1:
     title=compact(cells[0].text_content())
     if re.search(r'第.*[章節編]',title):path=[title]
    elif len(cells)>=2:
     no=compact(cells[0].text_content());text=gettext(cells[-1])
     if re.fullmatch(r'['+chars+r']+(?:之['+chars+r']+)?[、.．]',no):no='第'+no[:-1]+'點'
     if not no:
      m=re.match(r'^\s*'+article_re,text)
      if m:no=compact(m.group(1));text=text[m.end():].strip()
      else:
       m=re.match(r'^\s*(['+chars+r']+(?:之['+chars+r']+)?)[、.．]',text)
       if m:no='第'+m.group(1)+'點';text=text[m.end():].strip()
     if re.search(r'(?:第)?[\d一二三四五六七八九十百千零〇兩ㄧ\s]+(?:之[\d一二三四五六七八九十百千零〇兩ㄧ]+)?[條點]',no) and text:articles.append({'no':no,'text':text,'path':path[:]})
     elif text:raise ValueError('無法識別條文段落，保留連結待核對：'+text[:35])
  else:
   bodies=tree.xpath('//*[contains(@id,"divLawContent08")]')
   if not bodies and site not in ['內政部','農業部']:raise ValueError('無可識別的全文容器')
   if not bodies:bodies=[html.fromstring('<div></div>')]
   blob=gettext(bodies[0])
   # A citation at the beginning of a paragraph is not an article heading.
   # Official headings separate the number from the body with whitespace.
   # A chapter citation such as 第四章第九十條 is body text, not a heading.
   heading=r'(?m)^[ \t\u3000\xa0]*(?P<article>'+article_re+r')(?=[ \t\u3000\xa0]|$)|^[ \t\u3000\xa0]*(?P<chapter>第[ '+chars+r'\u3000\xa0]+[編章節](?:[ \t\u3000\xa0]+[^\n]*)?)$'
   matches=list(re.finditer(heading,blob));path=[]
   for i,m in enumerate(matches):
    if m.group('chapter'):
     path=[compact(m.group('chapter'))];continue
    text=blob[m.end():matches[i+1].start() if i+1<len(matches) else len(blob)].strip()
    if text:articles.append({'no':compact(m.group('article')),'text':text,'path':path[:]})
  if not articles and not table:
   bodies=tree.xpath('//*[contains(@id,"divLawContent08")]')
   if bodies:
    blob=gettext(bodies[0]); points=list(re.finditer(r'(?m)^[ \t\u3000\xa0]*([一二三四五六七八九十百]+)(?:之([一二三四五六七八九十百]+))?(?:[、．.]|[ \t\u3000\xa0]{2,})',blob))
    for i,m in enumerate(points):
     text=blob[m.end():points[i+1].start() if i+1<len(points) else len(blob)].strip()
     if text:articles.append({'no':'第'+m.group(1)+('之'+m.group(2) if m.group(2) else '')+'點','text':text,'path':[]})
  if len({norm(a['no']) for a in articles})!=len(articles):raise ValueError('重複條號，保留連結待核對')
  if not articles and site not in ['內政部','農業部']:raise ValueError('未解析到條文')
  modified=tree.xpath('//tr[th[contains(.,"修正日期")]]/td'); status=compact(tree.text_content())
  attachments=[{'title':compact(el.text_content()),'url':urllib.parse.urljoin(url,el.get('href'))} for el in tree.xpath('//a[contains(@href,"Download.ashx")]')]
  if site=='臺北市':
   modified=tree.xpath('//div[contains(@class,"form-group")][div[contains(@class,"col-label")][contains(.,"修正日期")]]/div[contains(@class,"col-input")]')
   attachments=[{'title':'官方附件下載','url':urllib.parse.urljoin(url,e.get('href'))} for e in tree.xpath('//a[contains(@href,"LawFileList")]')]
  if site=='新北市':
   metadata=tree.xpath('//tr[th[contains(.,"法規名稱")]]/td');m=re.search(r'民國\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日',metadata[0].text_content() if metadata else '')
   modified=[html.fromstring('<span>'+m.group()+'</span>')] if m else []
   attachments=[{'title':'官方附表與沿革','url':url.replace('FLAWDAT0202.aspx?fcode=','FLAWDAT01.aspx?lncode=1')}]
  types=tree.xpath('//tr[th[contains(.,"法規體系")]]/td')
  if site=='臺北市':types=tree.xpath('//div[contains(@class,"form-group")][div[contains(@class,"col-label")][contains(.,"法規位階")]]/div[contains(@class,"col-input")]')
  type_text=compact(types[0].text_content()) if types else ''
  for kind in ['自治條例','自治規則','行政規則']:
   if kind in type_text:doc['kind']=kind
  doc.update(coverage='full' if articles else 'link',retrieved=datetime.fromtimestamp((CACHE/(sid+'.html')).stat().st_mtime,timezone.utc).isoformat(timespec='seconds'),modified=compact(modified[0].text_content()) if modified else '',status='來源現行頁',articles=articles,attachments=list({x['url']:x for x in attachments}.values()),note='地方資料取自官方頁面；附件保留原站連結。')
  if site in ['內政部','農業部']:
   doc['kind']='技術規範';doc['note']='技術規範以官方檔案為準；圖表、公式及附錄請下載官方附件。'
  return doc
 except Exception as e:
  report['localFailures'].append({'name':name,'reason':str(e),'url':url})
  old=previous.get(sid)
  if old and old.get('coverage')=='full':
   return {**old,'note':'本次未能重新擷取；保留原官方快照，擷取日期未更新。'}
  return doc

jobs=[(n,v) for n,v in seed['local'].items() if v['site'] not in ['內政部','農業部'] and not n.startswith('桃園縣') and '原繼續適用' not in n and not any(t in n for t in ['消費者','農作物污染'])]
jobs += [(v['name'],v) for v in json.loads((ROOT/'data/technical-sources.json').read_text())]
jobs += [(v['name'],v) for v in json.loads((ROOT/'data/expanded-local.json').read_text())]
jobs=list({v['site']+'-'+v['id']:(n,v) for n,v in jobs}.values())
with ThreadPoolExecutor(max_workers=3) as pool:
 for doc in pool.map(getlocal,jobs):
  if doc:laws.append(doc); print(doc['name'],doc['coverage'],len(doc['articles']),flush=True)

report['missingCentral']=[n for n in NAMES if not any(l['name']==n for l in laws)]
# Relationships are accepted only with explicit article evidence. Never derive from browsing categories.
byname={l['name']:l for l in laws};relations=[]
for child in laws:
 if not child['articles']:continue
 first=child['articles'][0]['text']
 match=re.search(r'(?:依|依據)([^，。；]{2,60}?)(?:（以下簡稱[^）]+）)?第([一二三四五六七八九十百千零〇兩\d]+)(?:條之([一二三四五六七八九十百\d]+))?條?',first)
 if not match:continue
 parentname=match.group(1).replace('（以下簡稱本法）','').replace('（以下簡稱本條例）','')
 parent=byname.get(parentname)
 if not parent or parent['id']==child['id']:continue
 article='第'+match.group(2)+'條'+('之'+match.group(3) if match.group(3) else '')
 relations.append({'parent':parent['id'],'child':child['id'],'article':article,'evidence':first,'source':child['url'],'label':'依據 '+article})
# Four parts form one named regulation; grouping them is not a fabricated authorization edge.
resources=[
 {'title':'全國法規資料庫','description':'中央法規現行條文、沿革與歷史版本。','region':'中央','category':'法規查詢','url':'https://law.moj.gov.tw/'},
 {'title':'國土署建築法令解釋函彙編','description':'建築法、建築技術規則與建築使用管理解釋函。','region':'中央','category':'函釋','url':'https://www.nlma.gov.tw/ch/sglarticle/buildinterp'},
 {'title':'內政部主管法規查詢系統','description':'內政部法規、行政規則及相關查詢。','region':'中央','category':'法規查詢','url':'https://glrs.moi.gov.tw/'},
 {'title':'農業部主管法規共用系統','description':'農業設施、農業用地與相關主管法規。','region':'中央','category':'法規查詢','url':'https://law.moa.gov.tw/'},
 {'title':'桃園都市計畫地理資訊服務網','description':'都市計畫範圍、土地使用分區及計畫書圖。','region':'桃園市','category':'都市計畫','url':'https://urplanning.tycg.gov.tw/'},
 {'title':'桃園都市計畫書圖下載說明','description':'由市府官方入口查找計畫書、計畫圖與下載資源。','region':'桃園市','category':'都市計畫','url':'https://urdb.tycg.gov.tw/News_Content.aspx?n=15598&s=1090647'},
 {'title':'桃園市政府都市發展局','description':'建管、都市計畫與業務公告入口。','region':'桃園市','category':'申辦資源','url':'https://urdb.tycg.gov.tw/'}
]+[{'title':r['name']+'法規查詢','description':'前往該縣市官方法規系統查詢自治法規及行政規則。','region':r['name'],'category':'法規查詢','url':r['url']} for r in regions]

ruling_stats=json.loads((ROOT/'public/data/rulings.json').read_text())['stats']

laworder={n:i for i,n in enumerate(NAMES)}
laws.sort(key=lambda l:(0 if l['region']=='中央' else 1,laworder.get(l['name'],999),l['name']))
rawdir=ROOT/'public/data/laws';rawdir.mkdir(parents=True,exist_ok=True)
validids={l['id'] for l in laws}
for oldfile in rawdir.glob('*.json'):
 if oldfile.stem not in validids:oldfile.unlink()
# Curated PDF snapshots are independent of refreshed HTML link records.
# Keep their own source/version date; an HTML refresh is not a PDF update.
for doc_id,doc_source in json.loads((ROOT/'data/documents/catalog.json').read_text()).items():
 for law in laws:
  if law['id']==doc_id:
   law['document']={k:doc_source[k] for k in ['pages','source','sourcePage','sha256','versionNote','retrieved']}
   law['attachments']=[{'title':'已收錄官方圖文 PDF（版本見規範頁）','url':doc_source['source']}]+[a for a in law['attachments'] if a['url']!=doc_source['source']]

(ROOT/'public/data/laws.json').write_text(json.dumps({l['id']:l for l in laws},ensure_ascii=False,separators=(',',':')))
for law in laws:
 (ROOT/'public/data/laws'/ (law['id']+'.json')).write_text(json.dumps(law,ensure_ascii=False,separators=(',',':')))
fulls=[l for l in laws if l['coverage']=='full']
# Search indexes are built from canonical records; no duplicate text export.
summary=[]
for law in laws:
 row={**law,'articleCount':len(law['articles']),'articles':[{'no':a['no'],'text':'','path':a['path']} for a in law['articles']],'history':''}
 summary.append(row)
catalog={'version':json.loads((ROOT/'package.json').read_text())['version'],'collected':NOW,'snapshot':snapshots[0],'laws':summary,'regions':regions,'categories':list(GROUPS),'relations':relations,'rulingStats':ruling_stats,'resources':resources,'notes':['分類樹用於瀏覽，不代表法律授權或效力位階。','法源關係只呈現已由條文明示依據的連結，尚未完整盤點。','中央資料為官方批次快照；地方資料為逐筆下載的官方頁面。','尚未收錄全台全部建築相關法規；未收錄不代表沒有規定。','附件、圖表與公式以官方連結為準。歷史版本請開啟官方原文查閱。']}
(ROOT/'data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
(ROOT/'public/data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
provenance_path.write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
(ROOT/'data/sync-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'laws':len(laws),'full':len(fulls),'articles':sum(len(l['articles']) for l in laws),'relations':len(relations),'missing':report['missingCentral'],'failures':report['localFailures']},ensure_ascii=False),flush=True)
