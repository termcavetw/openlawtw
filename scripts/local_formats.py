"""Narrow, reviewed local formats; preserve source characters and list structure."""
from copy import deepcopy
import json
from pathlib import Path
import re

FORMATS=json.loads((Path(__file__).resolve().parents[1]/'data/local-source-formats.json').read_text(encoding='utf-8'))
H=r'[ \t\u3000\xa0]'
CN='一二三四五六六七八九十百ㄧ'
squash=lambda s:re.sub(r'\s+','',s)


def text(node):
 node=deepcopy(node)
 for br in node.xpath('.//br'):br.tail='\n'+(br.tail or '')
 for el in node.xpath('.//p|.//div'):
  if el.tail is None:el.tail='\n'
 return node.text_content().strip()


def body(tree):
 nodes=tree.xpath('//*[contains(@id,"divLawContent08")]')
 if len(nodes)!=1:raise ValueError('Reviewed local format requires one official body')
 if any(isinstance(el.tag,str) and el.tag not in {'p','div','span','b','strong','br','a'} for el in nodes[0].iterdescendants()):
  raise ValueError('Reviewed local format contains unsupported structured media')
 return nodes[0]


def ordered_root(tree):
 tables=tree.xpath('//table[contains(@id,"tableLawArticle")]')
 if len(tables)!=1:raise ValueError('Expected one official ordered-list table')
 rows=tables[0].xpath('.//tr')
 if len(rows)!=1:raise ValueError('Expected one official ordered-list row')
 cells=rows[0].xpath('./td|./th')
 if len(cells)!=2 or cells[0].text_content().strip():raise ValueError('Unexpected list heading cell')
 roots=cells[-1].xpath('./div[@class="ClearCss"]/ol')
 if len(roots)!=1:raise ValueError('Expected one official ordered-list root')
 root=roots[0]
 if squash(cells[-1].text_content())!=squash(root.text_content()):raise ValueError('Text outside official ordered list')
 for ol in root.xpath('descendant-or-self::ol'):
  if ol.attrib or (ol.text or '').strip() or any(el.tag!='li' for el in ol):raise ValueError('Unsupported ordered-list format or numbering')
 for li in root.xpath('.//li'):
  if 'value' in li.attrib or (li.tail or '').strip():raise ValueError('Unsupported list value or trailing text')
  if li.xpath('.//table|.//img|.//svg|.//math|.//iframe|.//canvas|.//ul'):raise ValueError('Unsupported list media')
 if any(isinstance(el.tag,str) and el.tag not in {'li','ol','span','br','b','strong','a','p'} for el in root.iterdescendants()):raise ValueError('Unknown official list element')
 if any(re.search(r'list-style|counter-|display\s*:',el.get('style',''),re.I) for el in root.xpath('descendant-or-self::ol|.//li')):raise ValueError('Unsupported custom list numbering')
 if root.xpath('./li/ol/li/ol'):raise ValueError('Unsupported third-level ordered list')
 if any(ol.getparent().tag!='li' for ol in root.xpath('.//ol')):raise ValueError('Unexpected nested list placement')
 return root


def parse_reviewed(tree, law_id, name):
 strategy=FORMATS.get(law_id,{}).get('parser')
 if strategy is None:return None
 if strategy=='attachment-only':
  if squash(text(body(tree)))!=squash(name):raise ValueError('Attachment-only source gained unparsed text')
  if not tree.xpath('//a[contains(@href,"Download.ashx") or contains(@href,"LawFileList")]'):
   raise ValueError('Attachment-only source has no official attachments')
  return []
 if strategy=='decimal-dom-list':
  root=ordered_root(tree);articles=[]
  for i,li in enumerate(root,1):
   node=deepcopy(li)
   for nested in node.xpath('./ol'):
    parts=['  '+str(j)+'. '+text(item) for j,item in enumerate(nested,1)]
    nested.clear();nested.text='\n'+'\n'.join(parts)+'\n'
   articles.append({'no':f'第{i}點','text':text(node),'path':[]})
  return articles
 source=body(tree)
 if strategy=='bold-article-headings':
  source=deepcopy(source)
  if '\ue000' in source.text_content() or '\ue001' in source.text_content():raise ValueError('Reserved source delimiter')
  headings=source.xpath('.//strong|.//b')
  if not headings:raise ValueError('Missing official bold article headings')
  for heading in headings:
   label=re.sub(r'\s+',' ',heading.text_content()).strip()
   if len(heading) or not re.fullmatch(r'第[\s0-9'+CN+r']+條(?:之[\s0-9'+CN+r']+)?',label):
    raise ValueError('Unexpected official bold heading')
   heading.text='\ue000'+label+'\ue001'
  blob=text(source);pattern=r'\ue000(?P<no>[^\ue001]+)\ue001'
 elif strategy=='sectioned-points':
  blob=text(source)
  pattern=(r'(?m)^'+H+r'*(?:(?P<section>[壹貳參肆伍陸柒捌玖拾]+[、．.][^\n]+)$|(?P<point>['+CN+r']+(?:'+H+r'*['+CN+r']+)*)(?:之(?P<insert>['+CN+r']+))?'+H+r'*[、．.])')
 elif strategy=='parenthesized-points':
  blob=text(source);pattern=r'(?m)^'+H+r'*（(?P<point>['+CN+r']+)）'
 else:raise ValueError('Unknown reviewed local parser')
 matches=list(re.finditer(pattern,blob));articles=[];path=[]
 if not matches or blob[:matches[0].start()].strip():raise ValueError('Unparsed text before reviewed headings')
 for i,m in enumerate(matches):
  end=matches[i+1].start() if i+1<len(matches) else len(blob)
  if m.groupdict().get('section'):
   if blob[m.end():end].strip():raise ValueError('Unparsed section preamble')
   path=[m.group('section')];continue
  no=m.groupdict().get('no') or '第'+re.sub(H,'',m.group('point'))+('之'+m.group('insert') if m.groupdict().get('insert') else '')+'點'
  value=blob[m.end():end].strip()
  if not value:raise ValueError('Empty reviewed article')
  articles.append({'no':no,'text':value,'path':path[:]})
 return articles


def validate_reviewed(tree, doc):
 strategy=FORMATS.get(doc['id'],{}).get('parser')
 if strategy is None:return False
 articles=doc['articles']
 if strategy=='attachment-only':
  if articles or squash(body(tree).text_content())!=squash(doc['name']):raise ValueError('Attachment-only original text changed')
  return True
 if strategy=='decimal-dom-list':
  root=ordered_root(tree)
  if len(root)!=len(articles):raise ValueError('Official DOM point count mismatch')
  for i,(li,article) in enumerate(zip(root,articles),1):
   if article['no']!=f'第{i}點' or article['path']:raise ValueError('Official DOM point numbering mismatch')
   # Independent DOM walk places every implicit marker at its actual
   # source child boundary. Merely deleting markers could accept moved ones.
   def tokens(node):
    yield node.text or ''
    for child in node:
     if child.tag=='ol':
      for number,entry in enumerate(child,1):
       yield str(number)+'.'
       yield from tokens(entry)
       yield entry.tail or ''
     else:yield from tokens(child)
     yield child.tail or ''
   if squash(article['text'])!=squash(''.join(tokens(li))):raise ValueError('Official list text or marker position differs')
  return True
 # Independent whole-body reconstruction. Every gap must be exactly the
 # observed heading, optionally preceded by its newly encountered section.
 raw=squash(body(tree).text_content());cursor=0;previous=[]
 for article in articles:
  value=squash(article['text']);start=raw.find(value,cursor)
  if start<cursor:raise ValueError('Reviewed official body differs')
  gap=raw[cursor:start]
  if article['path']!=previous:
   prefix=''.join(squash(x) for x in article['path'])
   if not gap.startswith(prefix):raise ValueError('Reviewed official chapter differs')
   gap=gap[len(prefix):]
  no=squash(article['no']);point=re.sub(r'^第|點$','',no)
  allowed=[no] if strategy=='bold-article-headings' else ['（'+point+'）'] if strategy=='parenthesized-points' else [point+'、',point+'.',point+'．']
  if gap not in allowed:raise ValueError('Unparsed reviewed source heading: '+gap[:60])
  cursor=start+len(value);previous=article['path']
 if cursor!=len(raw):raise ValueError('Unparsed reviewed source tail')
 return True
