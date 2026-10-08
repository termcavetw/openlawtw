"""Reject incomplete local HTML parses before advertising full-text coverage."""
import re
from local_formats import validate_reviewed

def validate_local_text(tree, doc):
 if validate_reviewed(tree,doc):return
 squash=lambda s:re.sub(r'\s+','',s)
 articles=doc['articles'];region=doc['region'];tables=tree.xpath('//table[contains(@id,"tableLawArticle")]')
 if region=='臺北市':
  bodies=[r.text_content() for r in tree.xpath('//ul[@class="law law-content"]/li//div[@class="law-articlepre"]')]
 elif region=='新北市':
  bodies=[r.text_content() for r in tree.xpath('//tr[td[@class="col-th"]]/td[@class="col-td"]/pre')]
 elif tables:
  rows=[r.xpath('./td|./th') for r in tables[0].xpath('.//tr')]
  bodies=[cells[-1].text_content() for cells in rows if len(cells)>=2 and cells[-1].text_content().strip()]
 else:
  containers=tree.xpath('//*[contains(@id,"divLawContent08")]')
  if not containers:raise ValueError('無法核對官方全文容器')
  source=squash(containers[0].text_content());cursor=0
  if doc.get('preamble'):
   prefix=squash(doc['preamble'])
   if not source.startswith(prefix):raise ValueError('官方前言不符')
   cursor=len(prefix)
  preambles={'連江縣-GL000083':'連江縣建築物簡化管理自治條例','連江縣-GL000088':'連60-8連江縣聚落保存專用區建築管理自治條例中華民國95年10月30日連企法字第0950030739號令發布','高雄市-GL002088':'壹、總則'}
  for i,a in enumerate(articles):
   body=squash(a['text']);start=source.find(body,cursor)
   if start<cursor:raise ValueError('條文與官方原文不符')
   gap=source[cursor:start]
   for heading in a['path']:gap=gap.replace(squash(heading),'')
   if i==0 and doc['id'] in preambles:
    prefix=preambles[doc['id']]
    if not gap.startswith(prefix):raise ValueError('官方前言已變更')
    gap=gap[len(prefix):]
   no=squash(a['no']);point=re.sub(r'^第|點$','',no)
   if gap not in [no,point,point+'、',point+'.',point+'．']:raise ValueError('官方正文含未收錄前言或段落：'+gap[:45])
   cursor=start+len(body)
  if cursor!=len(source):raise ValueError('官方正文尾段尚未完整收錄')
  return
 if len(bodies)!=len(articles):raise ValueError('官方條文列數與解析結果不符')
 for a,original in zip(articles,bodies):
  body=squash(a['text']);source=squash(original);prefix=source[:-len(body)] if body and source.endswith(body) else None
  if prefix is None or (prefix and not re.fullmatch(r'第?[\d一二三四五六六七八九十百千零〇兩ㄧ]+(?:之[\d一二三四五六六七八九十百千零〇兩ㄧ]+)?(?:條(?:之[\d一二三四五六六七八九十百千零〇兩ㄧ]+)?|[、.．])',prefix)):
   raise ValueError('官方條文內容尚未完整收錄：'+a['no'])
