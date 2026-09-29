"""Capture official NTPC forms; validate each source row before atomic publication."""
from pathlib import Path
from urllib.parse import urljoin, quote, urlsplit, urlunsplit, unquote
from urllib.request import Request, urlopen
from datetime import datetime, timezone, date
from hashlib import sha256
from io import BytesIO
from zipfile import ZipFile
from tempfile import NamedTemporaryFile
import json, os, re, unicodedata
from lxml import etree, html

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'data'/'practice'
SOURCE='https://www.publicwork.ntpc.gov.tw/home.jsp?act=be4f48068b2b0031&dataserno=23a761be16cfdfbd37dff6788a03fa0b&id=4efad84c5651a0bc'
MIME='application/vnd.oasis.opendocument.text'
# Stable identity uses the display title, exact official row title and filename.
FORMS=[
 ('住宅類（套房除外）簡易室內裝修施工許可簽章合格審核表','新北市住宅類(套房除外)建築物簡易室內裝修施工許可簽章合格審核表','02-1新增新北市住宅類(套房除外)建築物簡易室內裝修施工許可簽章合格審核表.odt'),
 ('建築物簡易室內裝修施工許可簽章合格審核表','新北市建築物簡易室內裝修施工許可簽章合格審核表','02新北市建築物簡易室內裝修施工許可簽章合格審核表.odt'),
 ('簡易室內裝修施工許可證（雙面列印）','新北市簡易室內裝修施工許可證(雙面列印)','04新北市簡易室內裝修施工許可證(雙面列印).odt'),
 ('建築物簡易室內裝修竣工查驗簽章合格審核表','新北市建築物簡易室內裝修竣工查驗簽章合格審核表','05(本表未變更)新北市建築物簡易室內裝修竣工查驗簽章合格審核表(本表未變更).odt'),
 ('住宅類（套房除外）簡易室內裝修竣工查驗簽章合格審核表','新北市住宅類(套房除外)建築物簡易室內裝修竣工查驗簽章合格審核表','05-1新增新北市住宅類(套房除外)建築物簡易室內裝修竣工查驗簽章合格審核表.odt'),
 ('簡易室內裝修申請竣工核備預審表','簡易室內裝修申請竣工核備預審表','06簡易室內裝修申請竣工核備預審表.odt'),
 ('住宅及集合住宅簡易室內裝修申請竣工核備預審表','住宅及集合住宅建築物簡易室內裝修申請竣工核備預審表','07住宅及集合住宅建築物簡易室內裝修申請竣工核備預審表.odt'),
 ('建築物室內裝修合格證明申請書','新北市建築物室內裝修合格證明申請書','08新北市建築物室內裝修合格證明申請書.odt'),
 ('住宅及集合住宅室內裝修合格證明申請書','新北市住宅及集合住宅建築物室內裝修合格證明申請書','09新北市住宅及集合住宅建築物室內裝修合格證明申請書.odt'),
 ('公有簡易室裝文件','公有-簡易室裝-文件','11新-公有-簡易室裝-文件.odt'),
 ('私人簡易室裝文件','私人-簡易室裝-文件','12私人-簡易室裝-文件.odt'),
]
DOCUMENT_HEADINGS=[
 '新北市建築物簡易室內裝修施工許可簽章合格審核表(住宅類；套房除外)',
 '新北市建築物簡易室內裝修施工許可簽章合格審核表',
 '新北市簡易室內裝修施工許可證',
 '新北市建築物簡易室內裝修竣工查驗簽章合格審核表',
 '新北市建築物簡易室內裝修竣工查驗簽章合格審核表(住宅類；套房除外)',
 '簡易室內裝修申請竣工核備預審表',
 '住宅及集合住宅建築物簡易室內裝修申請竣工核備預審表',
 '新北市建築物室內裝修合格證明申請書',
 '新北市住宅及集合住宅建築物室內裝修合格證明申請書',
 '建築物室內裝修竣工審查表',
 '新北市簡易室內裝修施工許可證申請書',
]

def require(condition,message):
    if not condition:raise ValueError(message)

def fetch(url):
    parts=urlsplit(url)
    require(parts.scheme=='https' and parts.hostname=='www.publicwork.ntpc.gov.tw','Unexpected source host')
    safe=urlunsplit((parts.scheme,parts.netloc,quote(unquote(parts.path),safe='/()'),parts.query,''))
    with urlopen(Request(safe,headers={'User-Agent':'Mozilla/5.0 (Openlawtw official source snapshot)','Accept':'*/*'}),timeout=50) as res:
        require(urlsplit(res.url).hostname=='www.publicwork.ntpc.gov.tw','Unexpected redirect host')
        return res.read()

def extract_odt(raw):
    with ZipFile(BytesIO(raw)) as z:
        require(z.read('mimetype').strip()==MIME.encode(),'Official attachment is not an ODT')
        require(z.getinfo('content.xml').file_size<20_000_000,'Unexpected ODT content size')
        tree=etree.fromstring(z.read('content.xml'),etree.XMLParser(resolve_entities=False,no_network=True))
    ns={'t':'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}
    return '\n'.join(''.join(el.itertext()).strip() for el in tree.xpath('//t:p|//t:h',namespaces=ns)).strip()

def source_rows(raw):
    """Keep visible line text and links together across nested spans."""
    rows=[];text=[];links=[]
    def flush():
        if text or links:rows.append((''.join(text).strip(),links.copy()))
        text.clear();links.clear()
    def walk(node):
        if node.tag in ('script','style'):return
        if node.tag in ('p','div','tr','li','br'):flush()
        if node.tag=='a' and node.get('href'):links.append(urljoin(SOURCE,node.get('href')))
        if node.text:text.append(node.text)
        for child in node:
            walk(child)
            if child.tail:text.append(child.tail)
        if node.tag in ('p','div','tr','li'):flush()
    walk(html.fromstring(raw));flush()
    return rows

def compact(text):return re.sub(r'\s+','',unicodedata.normalize('NFKC',text))

def select_forms(raw):
    rows=source_rows(raw);selected=[];used=set()
    for number,(title,official,filename) in enumerate(FORMS,1):
        matches=[]
        for row,links in rows:
            for url in links:
                if unquote(urlsplit(url).path.rsplit('/',1)[-1])==filename:matches.append((row,url))
        require(len(matches)==1,f'Expected one official row for {filename}; got {len(matches)}')
        row,url=matches[0];require(urlsplit(url).hostname=='www.publicwork.ntpc.gov.tw','Unexpected form host')
        # Date must be on this same numbered row. Future dates are parsed, not
        # copied from another form or an ancestor containing the whole list.
        match=re.fullmatch(r'(\d+)\.(\d{2,3})/(\d{2})/(\d{2})(.+)\(\.doc\.odf\)',compact(row))
        require(match is not None,f'Unrecognized official form row: {row}')
        index,year,month,day,source_title=match.groups()
        require(int(index)==number and source_title==compact(official),f'Official row / title changed: {row}')
        require(url not in used,'Duplicate official attachment');used.add(url)
        selected.append({'title':title,'source':url,'filename':filename,'versionLabel':f'{year}/{month}/{day}（官方清單標示）','versionDate':date(int(year)+1911,int(month),int(day)).isoformat()})
    return selected

def atomic_write(path,raw):
    path.parent.mkdir(parents=True,exist_ok=True);temporary=None
    try:
        with NamedTemporaryFile(dir=path.parent,prefix='.'+path.name+'-',delete=False) as output:
            temporary=Path(output.name);output.write(raw);output.flush();os.fsync(output.fileno())
        os.replace(temporary,path)
    finally:
        if temporary and temporary.exists():temporary.unlink()

def immutable_write(path,raw):
    if path.exists():require(path.read_bytes()==raw,f'Hash-addressed source was modified: {path}')
    else:atomic_write(path,raw)

def capture(fetcher=fetch,root=ROOT,observed=None):
    dest=root/'data'/'practice';raw=fetcher(SOURCE);selected=select_forms(raw)
    observed=observed or datetime.now(timezone.utc).isoformat()
    page_hash=sha256(raw).hexdigest();page_file=dest/'sources'/f'{page_hash}.html';items=[];assets=[]
    for i,source in enumerate(selected,1):
        body=fetcher(source['source']);text=extract_odt(body);require(len(text)>30,'Empty official form text')
        require(compact(text.splitlines()[0])==compact(DOCUMENT_HEADINGS[i-1]),f'Original document heading changed: {source["filename"]}')
        digest=sha256(body).hexdigest();file=dest/'assets'/f'{digest}.odt';assets.append((file,body))
        record={'id':f'ntpc-interior-{i:02}',**source,'region':'新北市','kind':'官方書表','sourcePage':SOURCE,'retrieved':observed,'sourcePageSHA256':page_hash,'sha256':digest,'file':file.relative_to(root).as_posix(),'mime':MIME,'bytes':len(body),'text':text,'group':'施工許可' if i<=3 else '竣工與核備' if i<=9 else '文件清單','note':'原始 ODT 書表保持不變。文字預覽供查找，版面與填寫欄位請以原檔為準；版本標示不等於施行日期。'}
        items.append(record)
    payload={'schemaVersion':1,'title':'新北簡易室裝書表','source':SOURCE,'observedAt':observed,'pageSHA256':page_hash,'pageFile':page_file.relative_to(root).as_posix(),'items':items}
    # Current metadata changes only after every download/extraction succeeds.
    # Hash-addressed old source pages remain valid if the final replace fails.
    for file,body in assets:immutable_write(file,body)
    immutable_write(page_file,raw)
    atomic_write(dest/'ntpc-interior-forms.json',json.dumps(payload,ensure_ascii=False,indent=2).encode())
    return payload

if __name__=='__main__':
    result=capture()
    print(json.dumps({'forms':len(result['items']),'pageSHA256':result['pageSHA256']},ensure_ascii=False))
