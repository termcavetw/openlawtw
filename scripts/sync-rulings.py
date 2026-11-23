"""Import the NLMA public interpretation catalogue, preserving official text.
Python 3 + lxml. Uses the same public JSON feed as the official website.
No third-party commentary. References are explicit text matches, not legal opinions.
"""
from pathlib import Path
import argparse, json, re, hashlib, unicodedata, urllib.request
from urllib.parse import urljoin
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
from lxml import html
from official_fetch import download, atomic_write

ROOT = Path(__file__).resolve().parents[1]
FEED = 'https://www.nlma.gov.tw/sites/www.nlma.gov.tw/ch/main/interpcomp/list.json'
HOME = 'https://www.nlma.gov.tw'
DIGITS = dict(zip('零〇○Ｏ一二三四五六七八九', '0000123456789'))
NUM = r'[0-9一二三四五六七八九十百千零〇○]+'
ARTICLE = re.compile(r'第('+NUM+r')(?:條之|之)('+NUM+r')條?|第('+NUM+r')(?:-('+NUM+r'))?條')

def cn(s):
    s = unicodedata.normalize('NFKC', s)
    if not re.search('[十百千]', s): return ''.join(DIGITS.get(c,c) for c in s)
    total = current = 0
    for c in s:
        if c in '十百千': total += (current or 1)*{'十':10,'百':100,'千':1000}[c]; current=0
        else: current=int(DIGITS.get(c,c))
    return str(total+current)

def norm(s): return re.sub(r'\s+','',unicodedata.normalize('NFKC',s)).replace('台','臺').replace('○','〇')

def article_key(m):
    a,b,c,d=m.groups(); return '第'+cn(a or c)+('-'+cn(b or d) if b or d else '')+'條'

def plain(content):
    # Some old source records contain literal escaped CR/LF characters.
    content = content.replace('\\r\\n','\n').replace('\\n','\n')
    tree = html.fromstring('<div>'+content+'</div>')
    for e in tree.xpath('.//script|.//style'): e.drop_tree()
    for e in tree.iter():
        if e.tag=='br': e.tail='\n'+(e.tail or '')
        elif e.tag in ('p','div','tr','li','h1','h2','h3','table'): e.tail='\n'+(e.tail or '')
        elif e.tag in ('td','th'): e.tail='\t'+(e.tail or '')
    text = '\n'.join(re.sub(r'[ \t]+',' ',line).strip() for line in tree.text_content().replace('\xa0',' ').splitlines())
    return re.sub(r'\n{3,}','\n\n',text).strip(), tree

def issued_date(header):
    n=unicodedata.normalize('NFKC',header)
    m=re.search(r'(?<!\d)(\d{2,3})[.年/](\d{1,2})[.月/](\d{1,2})(?:日|[.\s]|[^\d]|$)',n)
    if not m:return ''
    try:return datetime(int(m[1])+1911,int(m[2]),int(m[3])).date().isoformat()
    except ValueError:return ''

CN_DIGIT='〇○零一二三四五六七八九十'
ROC_DATE=(r'(?:中華民國)?(?:\d{2,3}\s*[.．年/、]\s*\d{1,2}\s*[.．月/、]\s*\d{1,2}\s*日?'
          r'|\d{2,3}\s*[.．]\s*\d{4}(?!\d)'
          r'|['+CN_DIGIT+r']{2,5}\s*[年、]\s*['+CN_DIGIT+r']{1,3}\s*[月、]\s*['+CN_DIGIT+r']{1,3}\s*日?)')
# Agencies whose name may open a header that runs on into the text ("…號公告依據：…").
KNOWN_AGENCY=(r'(?:內政部(?:營建署|國土管理署)?|營建署|國土管理署|行政院|臺灣省政府|台灣省政府|省政府|經濟部|法務部|財政部|'
              r'教育部|交通部|衛生福利部|考選部|司法院秘書長|司法行政部|[\u4e00-\u9fff]{2}[市縣]政府(?:[\u4e00-\u9fff]{1,4}?局)?)')
# A line that is nothing but a header may carry any short issuer, including the source's own typos
# (內政74.7.23…, 行政部67.2.7…), but never a sentence such as 「請參照本部…號函」.
SHORT_ISSUER=r'(?!請|關於|有關|依|查|復|參照|本部|本院|本署)[\u4e00-\u9fff]{1,6}?'
TAIL=r'[.．\s]*[^\n，。：「」『』]{1,40}?號(?:書函|代電|函|令|公告)?'
LEADING=r'(?:'+KNOWN_AGENCY+r'(?:函)?\s*)?'+ROC_DATE+TAIL
WHOLE_LINE=r'(?:(?:'+KNOWN_AGENCY+r'|'+SHORT_ISSUER+r')(?:函)?\s*)?'+ROC_DATE+TAIL

def _dated(header):return bool(issued_date(header) or fallback_date(header))

def standalone_header(lines):
    """A later line of the official text that is wholly a letter header (old 摘要⏎字號⏎內文 layout)."""
    for line in lines:
        if re.fullmatch(WHOLE_LINE,line) and _dated(line):return line
    return ''

def fallback_header(text):
    """Find the official letter header when it is not the leading 「機關＋字號」 the main rule expects.

    Older catalogue entries put the header after a summary line, inside a meeting record's
    first line, after a stray leading "x", or in other agencies' wording. Only text that is
    itself in the official record is returned, never a reconstruction, and a letter that a
    sentence merely cites (「請參照本部…號函」) is never taken. Returns (header, is_prefix).
    """
    lines=[l.strip() for l in text.split('\n') if l.strip()]
    if not lines:return '',False
    first=lines[0]
    m=re.match(r'^'+LEADING,first)
    if m and _dated(m[0]):return m[0],text.startswith(m[0])
    if re.fullmatch(WHOLE_LINE,first) and _dated(first):return first,text.startswith(first)
    m=re.match(r'^[xＸ]('+KNOWN_AGENCY+r'(?:函)?\s*'+ROC_DATE+TAIL+r')',first)
    if m and _dated(m[1]):return m[1],False
    m=re.fullmatch(r'[\u4e00-\u9fff()（）]{1,12}字第['+CN_DIGIT+r'\d]{5,}號(?:函|令)?',first)
    if m:return m[0],text.startswith(m[0])
    m=re.fullmatch(r'討論案：[^（）\n]*（('+WHOLE_LINE+r')）',first)
    if m and _dated(m[1]):return m[1],False
    m=re.search(r'('+KNOWN_AGENCY+r'(?:函)?\s*'+ROC_DATE+TAIL+r')$',first)
    if m and len(first)-len(m[1])<=30 and _dated(m[1]):return m[1],False
    return standalone_header(lines[1:]),False

def fallback_date(header):
    """Dates the main pattern misses: spaces in separators, Chinese numerals, YYY.MMDD."""
    n=re.sub(r'\s+','',unicodedata.normalize('NFKC',header)).replace('．','.')
    m=re.search(r'(?<![\d'+CN_DIGIT+r'])(\d{2,3})[.年/、](\d{1,2})[.月/、](\d{1,2})(?!\d)',n) \
      or re.search(r'(?<!\d)(\d{2,3})\.(\d{2})(\d{2})(?!\d)',n)
    if m:y,mo,d=m.groups()
    else:
        m=re.search(r'(?<!['+CN_DIGIT+r'])(['+CN_DIGIT+r']{2,5})[年、](['+CN_DIGIT+r']{1,3})[月、](['+CN_DIGIT+r']{1,3})',n)
        if not m:return ''
        y,mo,d=(cn(x) for x in m.groups())
    try:
        year=int(y)
        if not 1<=year<=200:return ''
        return datetime(year+1911,int(mo),int(d)).date().isoformat()
    except ValueError:return ''

def publication_date(raw):
    if not raw:return ''
    try:return (datetime.fromisoformat(raw.replace('Z','+00:00'))+timedelta(hours=8)).date().isoformat()
    except ValueError:return ''

def serials(text):
    n=unicodedata.normalize('NFKC',text).replace('○','〇')
    return [cn(m[1]) for m in re.finditer(r'(['+NUM[1:-2]+r']{5,})\s*號',n)]

def build(raw, retrieved, digest):
    catalog=json.loads((ROOT/'data/catalog.json').read_text())
    laws=catalog['laws']; law_ids={l['id'] for l in laws}
    names={norm(l['name']):l['id'] for l in laws}
    for a,b in [('建築技術規則設計施工編','建築技術規則建築設計施工編')]:
        if b in names:names[a]=names[b]
    name_re=re.compile('|'.join(re.escape(n) for n in sorted(names,key=len,reverse=True)))
    article_names={l['id']:{article_key(m):a['no'] for a in l['articles'] if (m:=ARTICLE.fullmatch(norm(a['no'])))} for l in laws}
    records=[]; source_counts=Counter(); raw_by_id={str(x['id']):x for x in raw}
    for source in raw:
        text,tree=plain(source.get('content') or '')
        if not text:raise ValueError('Empty source body '+str(source['id']))
        first=text.split('\n',1)[0]
        header_match=re.match(r'^(?:內政部|行政院|營建署|國土管理署|本部|台灣省|臺灣省|經濟部|法務部|財政部|教育部|交通部|省政府)[^\n]{0,180}?號(?:書函|代電|函|令|公告)?',first)
        header=header_match[0] if header_match else ''
        body=text[len(header):].strip() if header else text
        if not header:
            # The header is elsewhere in the official text: keep that text whole as the body,
            # and strip only an exact leading header, as for the main rule.
            header,is_prefix=fallback_header(text)
            if header and is_prefix:body=text[len(header):].strip()
        elif not issued_date(header):
            # The leading match may be a letter the summary sentence cites (「本部…號函之適用對象…」);
            # a later line that is wholly a dated header is then the record's own header.
            own=standalone_header([l.strip() for l in text.split('\n')[1:] if l.strip()])
            if own:header,body=own,text
        unit=(source.get('efa_unit') or {}).get('name') or '國土管理署'
        title=source['title'].strip(); normalized=norm(title+'\n'+body)
        refs={}
        for match in name_re.finditer(normalized):
            if match[0].endswith('法') and normalized[match.end():match.end()+1] in ('令','規'):continue
            lid=names[match[0]]
            refs.setdefault((lid,''),{'law':lid,'article':'','evidence':match[0]})
            tail=normalized[match.end():match.end()+100].lstrip('」』）)')
            m=ARTICLE.match(tail)
            while m:
                key=article_key(m)
                canonical=article_names.get(lid,{}).get(key)
                if canonical:refs[(lid,canonical)]={'law':lid,'article':canonical,'evidence':match[0]+m[0]}
                tail=tail[m.end():]
                sep=re.match(r'^[、及與或，]+',tail)
                m=ARTICLE.match(tail[sep.end():]) if sep else None
                if sep:tail=tail[sep.end():]
        # Only resolve 本法 / 本辦法 etc when the source explicitly defines that alias.
        for match in name_re.finditer(normalized):
            tail=normalized[match.end():match.end()+35]
            alias=re.match(r'[」』]?[(（]以下簡稱(本法|本條例|本辦法|本規則|本標準)[)）]',tail)
            if not alias:continue
            lid=names[match[0]]
            for m in re.finditer(re.escape(alias[1])+r'('+ARTICLE.pattern+')',normalized):
                am=ARTICLE.match(normalized,m.start()+len(alias[1]));key=article_key(am)
                canonical=article_names.get(lid,{}).get(key)
                if canonical:refs[(lid,canonical)]={'law':lid,'article':canonical,'evidence':m[0]+'；'+match[0]+alias[0]}
        exact_laws={lid for lid,art in refs if art}
        ref_list=[r for (lid,art),r in refs.items() if art or lid not in exact_laws]
        attachments=[]; linked=[]
        for a in tree.xpath('.//a[@href]'):
            url=urljoin(HOME,a.get('href','').strip())
            if not url.startswith(('https://','http://')):continue
            am=re.search(r'www\.nlma\.gov\.tw/ch/titlelist/interpcomp/(\d+)',url)
            if am:linked.append(am[1])
            elif url not in {x['url'] for x in attachments}:attachments.append({'title':a.text_content().strip() or a.get('title') or '官方附件／連結','url':url})
        for a in source.get('efa_titlelist_files') or []:
            url=urljoin(HOME,a.get('file_path') or '')
            if url.startswith(('https://','http://')) and url not in {x['url'] for x in attachments}:attachments.append({'title':a.get('original_file') or '官方附件','url':url})
        for a in tree.xpath('.//img[@src]'):
            url=urljoin(HOME,a.get('src'))
            if url.startswith(('https://','http://')) and url not in {x['url'] for x in attachments}:attachments.append({'title':a.get('alt') or '官方原文附圖','url':url})
        # This flag reports a mention, never asserts that the current letter is repealed.
        status='mentioned' if re.search(r'停止適用|不再援引|不再適用|廢止',title+'\n'+body) else 'unchecked'
        group='建築設計與管理'
        if re.search('公寓大廈|區分所有權人|管理委員',title):group='公寓大廈'
        elif re.search('室內裝修|使用類組|變更使用|公共安全檢查',title):group='使用與室內裝修'
        elif re.search('農舍|農業設施|農業用地',title):group='農舍與農業設施'
        elif re.search('都市更新|危險及老舊|危老',title) or '更新' in unit:group='都更與危老'
        elif '下水道' in unit or re.search('下水道|排水設備',title):group='下水道與設備'
        elif '住宅發展' in unit:group='住宅政策'
        elif any(w in unit for w in ['都市計畫','國土計畫','都市基礎']):group='都市計畫與土地'
        ids=serials(header)
        records.append({'id':str(source['id']),'title':title,'number':header,'numberKey':ids[-1] if ids else '',
          'date':issued_date(header) or fallback_date(header),'published':publication_date(source.get('publish_up')),'modified':publication_date(source.get('modified')),
          'body':body,'url':HOME+'/ch/titlelist/interpcomp/'+str(source['id']),'unit':unit,'topic':group,'refs':ref_list,
          'status':status,'attachments':attachments,'citations':linked})
        source_counts[unit]+=1
    by_number=defaultdict(list)
    record_by_id={r['id']:r for r in records}
    for r in records:
        if len(r['numberKey'])>=7:by_number[r['numberKey']].append(r['id'])
    for r in records:
        linked=r['citations'][:]
        for num in serials(r['body']):
            ids=by_number.get(num,[])
            if len(ids)==1:linked.extend(ids)
            elif ids and len({(norm(record_by_id[i]['number']),norm(record_by_id[i]['body'])) for i in ids})==1:
                # Identical letters are sometimes filed under multiple official IDs.
                # Only collapse the target when the normalized header AND body agree.
                linked.append(min(ids,key=int))
        r['citations']=list(dict.fromkeys(i for i in linked if i!=r['id'] and i in raw_by_id))
    records.sort(key=lambda r:r['date'] or r['published'],reverse=True)
    stats={'count':len(records),'retrieved':retrieved,'source':HOME+'/ch/titlelist/interpcomp','feed':FEED,'sha256':digest,
      'dated':sum(bool(r['date']) for r in records),'numbered':sum(bool(r['numberKey']) for r in records),
      'articleLinks':sum(bool(x['article']) for r in records for x in r['refs']),
      'crossLinks':sum(len(r['citations']) for r in records),'attachmentLinks':sum(len(r['attachments']) for r in records),
      'statusMentions':sum(r['status']=='mentioned' for r in records),'units':dict(source_counts),
      'bodyCount':sum(bool(r['body']) for r in records),'headerOnlyCount':sum(not r['body'] for r in records),
      'uniqueNumbers':len({r['numberKey'] for r in records if r['numberKey']})}
    return {'stats':stats,'items':records}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',default='.rulings-cache');p.add_argument('--refresh',action='store_true');a=p.parse_args()
    cache=Path(a.cache);cache.mkdir(exist_ok=True,parents=True);source=cache/'interpcomp-list.json'
    if not source.exists() or a.refresh:
        atomic_write(source,download(FEED,timeout=60))
    raw=source.read_bytes();archive=build(json.loads(raw),datetime.now(timezone.utc).date().isoformat(),hashlib.sha256(raw).hexdigest())
    (ROOT/'public/data/rulings.json').write_text(json.dumps(archive,ensure_ascii=False,separators=(',',':')))
    for path in [ROOT/'data/catalog.json',ROOT/'public/data/catalog.json']:
        c=json.loads(path.read_text());c.pop('rulings',None);c['rulingStats']=archive['stats'];c['version']=json.loads((ROOT/'package.json').read_text())['version'];path.write_text(json.dumps(c,ensure_ascii=False,separators=(',',':')))
    print(json.dumps(archive['stats'],ensure_ascii=False,indent=2))
