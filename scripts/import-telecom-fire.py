"""Rebuild reviewed formal-law additions from exact official PDF source bytes.
No OCR, invented text, or standalone practical submission materials.
"""
from pathlib import Path
import json,hashlib,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
def write(path,value): (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')) if path in ['public/data/laws.json','data/catalog.json','public/data/catalog.json'] else json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def pdf_pages(path):
 text=subprocess.check_output(['pdftotext','-layout',str(ROOT/path),'-']).decode('utf-8')
 pages=text.split('\f');assert not pages[-1].strip();return [{'page':i+1,'text':s.strip()} for i,s in enumerate(pages[:-1])]
def pdf_source(id,path,url,page,stamp):
 raw=(ROOT/path).read_bytes();return {'url':url,'sourcePage':page,'format':'pdf','file':path,'sha256':hashlib.sha256(raw).hexdigest(),'hashScope':'downloaded-pdf-file','observedAt':stamp}
def build():
 stamp='2026-09-30T10:32:25+00:00';sources=read('data/provenance.json');documents=read('data/documents/catalog.json');records=[]
 index='https://ncclaw.ncc.gov.tw/FLAW/FLAWDAT01.aspx?id='
 for code,name,kind,path,url,keywords in [
 ('FL096222','建築物屋內外電信設備設置技術規範','技術規範','data/documents/NCC-FL096222.pdf','https://gazette2.nat.gov.tw/EG_FileManager/eguploadpub/eg027032/ch06/type1/gov53/num16/images/BB.pdf',['電信設備','電信室','弱電','電信管線','電信配管','電信技術規範','電信設計']),
 ('FL096019','建築物電信設備審查及審驗機構管理辦法','法規命令','data/formal-sources/FL096019.pdf','https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg027032/ch06/type1/gov53/num15/Eg.pdf',['電信送審','電信審查','電信審驗','電信審驗機構','電信設計審查','電信完工審驗'])]:
  id='NCC-'+code;source=pdf_source(id,path,url,index+code,stamp);sources['sources'][id]=source;pages=pdf_pages(path)
  law=dict(id=id,name=name,region='中央',category='建築與設計',kind=kind,url=index+code,source='國家通訊傳播委員會／行政院公報',coverage='link',modified='2021-02-22',effective='2021-02-22',effectiveNote='110年2月22日訂定生效；依電信管理法授權之新制，非依舊電信法訂定之同名規範。',snapshot='',retrieved=stamp,status='官方索引未標廢止',articles=[],history='中華民國110年2月22日訂定。',attachments=[{'title':'官方公報原文（含規範附表及圖示）','url':url}],keywords=keywords)
  if code=='FL096222':
   assert len(pages)==177 and '第四十九條第七項' in pages[0]['text']
   note='110年2月22日通傳基礎字第11063002172號公告訂定，自即日生效。收錄行政院公報所附177頁完整規範原始PDF，保留規範內附表、圖示及附錄，並非另增一般實務資料。文字抽取僅供搜尋；尺寸、表格、公式以原始PDF為準。'
   documents[id]={'format':'pdf','file':path,'source':url,'sourcePage':index+code,'sha256':source['sha256'],'hashScope':source['hashScope'],'bytes':(ROOT/path).stat().st_size,'pages':len(pages),'retrieved':stamp,'versionNote':note,'textMethod':'pdftotext -layout 原生文字抽取；無OCR、未重建圖表。'}
   write(path.replace('.pdf','-text.json'),{'pages':pages})
   law['document']={k:documents[id][k] for k in ['format','pages','source','sourcePage','sha256','retrieved','versionNote']};law['note']=note
  else:
   assert len(pages)==18
   # Gazette contains a different regulation on pp1–9. Only this rule's pp10–13
   # becomes article text. Annexes pp14–18 stay in the unchanged official PDF;
   # their legacy font encodings are not represented as searchable legal text.
   body='\n'.join(re.sub(r'^行政院公報[^\n]*\n','',p['text']) for p in pages[9:13])
   title='建築物電信設備審查及審驗機構管理辦法';assert body.lstrip().startswith(title);body=body.lstrip()[len(title):].strip()
   parts=list(re.finditer(r'^第\s*([一二三四五六七八九十]+)\s*條\s+',body,re.M))
   assert len(parts)==16 and parts[0].start()==0
   for i,m in enumerate(parts):
    law['articles'].append({'no':re.sub(r'\s+','',m.group()).strip(),'text':body[m.end():parts[i+1].start() if i+1<len(parts) else len(body)].strip(),'path':[]})
   assert law['articles'][0]['no']=='第一條' and law['articles'][-1]['no']=='第十六條'
   assert law['articles'][-1]['text']=='本辦法自發布日施行。'
   law['coverage']='full';law['note']='110年2月22日通傳基礎字第11063002171號令訂定。正文16條逐條取自官方公報PDF第10至13頁；第1至9頁為另一法規，未混入本文。法定附件保留官方原檔連結；第14至18頁部分字型無法可靠抽字，未宣稱附件文字可搜尋。'
   source['articlePages']=[10,13];source['textMethod']='pdftotext -layout；只移除公報頁首與法規標題，保留條文內文字、標點及換行。'
  records.append(law)
 # Fire administrative rule: complete 12 points from the 2019 gazette;
 # 2020 amendment changes annex 7 only and does not replace these points.
 id='內政部-GL001203';path='data/formal-sources/GL001203.pdf'
 url='https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg025156/ch02/type2/gov10/num2/Eg.pdf'
 official='https://glrs.moi.gov.tw/LawContent.aspx?id=GL001203'
 source=pdf_source(id,path,url,official,'2026-09-30T10:38:19+00:00');sources['sources'][id]=source
 pages=pdf_pages(path);assert len(pages)==3
 body='\n'.join(re.sub(r'^行政院公報[^\n]*\n','',p['text']) for p in pages)
 body=body[body.index('一、為利'):body.index('本案附件篇幅過鉅')].strip()
 parts=list(re.finditer(r'^([一二三四五六七八九十]+)、',body,re.M));assert len(parts)==12
 articles=[{'no':'第'+m[1]+'點','text':body[m.end():parts[i+1].start() if i+1<len(parts) else len(body)].strip(),'path':[]} for i,m in enumerate(parts)]
 assert articles[-1]['no']=='第十二點' and articles[-1]['text'].endswith('最長不得超過二十日。')
 annex='https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg026070/ch02/type2/gov10/num2/Eg.pdf'
 source['textMethod']='pdftotext -layout；移除公報頁首、發布令、法規標題及附件下載提示；完整保留12點正文。'
 source['amendment']={'url':annex,'date':'2020-04-17','scope':'第六點附件七','verification':'官方公報發布令及消防署修正公告；未將附件抽字冒充正文。'}
 records.append(dict(id=id,name='消防機關辦理建築物消防安全設備審查及查驗作業基準',region='中央',category='消防與公共安全',kind='行政規則',url=official,source='內政部／行政院公報',coverage='full',modified='2020-04-17',effective='2020-04-17',effectiveNote='108年8月20日修正全文12點，自即日生效；109年4月17日僅修正第六點附件七，自即日生效。',snapshot='',retrieved=source['observedAt'],status='已核對官方發布令；中央彙編頁本次無法連線',articles=articles,history='108年8月20日內授消字第1080823018號令修正全文12點，並廢止補充規定。109年4月17日內授消字第1090821936號令修正第六點附件七。',attachments=[{'title':'108年修正正文官方公報','url':url},{'title':'108年法定附件（附件七改依109年修正版）','url':'https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg025156/ch02/type2/gov10/num2/images/BB.pdf'},{'title':'109年4月17日第六點附件七修正規定','url':annex}],keywords=['消防送審','消防查驗','消防審查','消防圖說','消防會審','消防會勘','消防竣工查驗'],note='收錄官方公報12點正文，法定附件提供官方連結；未新增獨立申請表、圖說範例或一般實務資料。109年修正僅涉及第六點附件七。內政部彙編頁本次連線失敗，版本依可核對之官方發布令，請併查官方最新沿革。'))
 write('data/formal-laws.json',records);write('data/provenance.json',sources);write('data/documents/catalog.json',documents)
 # Apply additions and keyword metadata without refetching unrelated snapshots.
 laws=read('public/data/laws.json')
 for law in records:laws[law['id']]=law
 for id,words in read('data/law-keywords.json').items():
  assert id in laws,id;laws[id]['keywords']=list(dict.fromkeys(laws[id].get('keywords',[])+words))
 write('public/data/laws.json',laws)
 catalog=read('data/catalog.json');catalog['collected']=stamp;catalog['version']=read('package.json')['version']
 catalog['laws']=[{**l,'articleCount':len(l['articles']),'articles':[{'no':a['no'],'text':'','path':a['path']} for a in l['articles']],'history':''} for l in laws.values()]
 write('data/catalog.json',catalog);write('public/data/catalog.json',catalog)
 print('Imported',len(records),'formal rules; total',len(laws))
if __name__=='__main__':build()
