"""Lossless regression fixtures captured from twelve official pages, 2026-10-08."""
import ast
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import hashlib,json,re,sys,tempfile,unittest,unicodedata,urllib.parse
from lxml import html
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from local_formats import FORMATS,parse_reviewed,validate_reviewed
from local_source import validate_local_text
from official_fetch import SourceCircuitOpen
ROOT=Path(__file__).resolve().parents[2]
FIX=Path(__file__).parent/'fixtures/local-reviewed'
LAWS=json.loads((ROOT/'public/data/laws.json').read_text())
MANIFEST=json.loads((FIX/'manifest.json').read_text())


def parse(law_id):
 tree=html.fromstring((FIX/(law_id+'.html')).read_bytes());old=LAWS[law_id]
 return tree,{**old,'articles':parse_reviewed(tree,law_id,old['name'])}


class LocalFormatTests(unittest.TestCase):
 def test_all_twelve_source_hashes_and_full_text(self):
  for source in MANIFEST:
   with self.subTest(source=source['id']):
    self.assertEqual(hashlib.sha256((FIX/(source['id']+'.html')).read_bytes()).hexdigest(),source['sha256'])
    tree,doc=parse(source['id']);self.assertEqual(len(doc['articles']),source['articles']);validate_local_text(tree,doc)
    self.assertEqual(len({a['no'] for a in doc['articles']}),len(doc['articles']))

 def test_sectioned_points_spaces_and_nine_chapters(self):
  tree,doc=parse('高雄市-GL002088');self.assertEqual(len(doc['articles']),67)
  self.assertEqual(len({tuple(a['path']) for a in doc['articles']}),9)
  for no in ['第三十點','第四十點','第五十點','第六十點']:
   self.assertIn(no,[a['no'] for a in doc['articles']])
  for mutation in ['delete','rewrite','number','chapter']:
   bad=deepcopy(doc)
   if mutation=='delete':bad['articles'].pop(29)
   if mutation=='rewrite':bad['articles'][29]['text']+='不是官方原文'
   if mutation=='number':bad['articles'][29]['no']='第三點'
   if mutation=='chapter':bad['articles'][29]['path']=['捏造標題']
   with self.assertRaises(ValueError):validate_local_text(tree,bad)

 def test_dom_lists_preserve_child_numbers_and_zero_width_text(self):
  tree,doc=parse('彰化縣-GL000439');self.assertEqual(len(doc['articles']),6)
  self.assertIn('  3. ',doc['articles'][2]['text']);self.assertIn('  2. ',doc['articles'][3]['text'])
  self.assertIn('\u200b',doc['articles'][3]['text'])
  for mutate in ['number','text','marker-position']:
   bad=deepcopy(doc)
   if mutate=='number':bad['articles'][2]['text']=bad['articles'][2]['text'].replace('  2. ','  8. ')
   elif mutate=='text':bad['articles'][2]['text']=bad['articles'][2]['text'].replace('姓名','')
   else:bad['articles'][2]['text']='  1. '+bad['articles'][2]['text'].replace('  1. ','',1)
   with self.assertRaises(ValueError):validate_local_text(tree,bad)
  for attr in ['start','reversed','type']:
   changed=deepcopy(tree);changed.xpath('//div[@class="ClearCss"]/ol')[0].set(attr,'2')
   with self.assertRaises(ValueError):parse_reviewed(changed,doc['id'],doc['name'])

 def test_duplicate_bold_body_headings_are_not_deleted(self):
  for law_id,index,word in [('嘉義市-FL022993',1,'第二條'),('嘉義市-FL031633',4,'第五條')]:
   tree,doc=parse(law_id);self.assertTrue(doc['articles'][index]['text'].startswith(word))
   bad=deepcopy(doc);bad['articles'][index]['text']=bad['articles'][index]['text'].replace(word,'',1)
   with self.assertRaises(ValueError):validate_local_text(tree,bad)

 def test_parentheses_and_attachment_only_fail_closed(self):
  tree,doc=parse('嘉義市-FL030697');self.assertEqual(len(doc['articles']),10)
  self.assertEqual(doc['articles'][0]['no'],'第一點')
  for law_id,config in FORMATS.items():
   if config['parser']!='attachment-only':continue
   tree,doc=parse(law_id);body=tree.xpath('//*[contains(@id,"divLawContent08")]')[0]
   body.text=(body.text or '')+'新增的正式條文'
   with self.assertRaises(ValueError):parse_reviewed(tree,law_id,doc['name'])

 def test_production_getlocal_all_twelve_without_retained_failures(self):
  # Run the real importer function using captured response bytes, not a second
  # implementation of its metadata/attachment/source-evidence integration.
  module=ast.parse((ROOT/'scripts/sync-laws.py').read_text())
  functions=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ['compact','norm','localcat','gettext','getlocal']]
  seed=json.loads((ROOT/'data/extension-seed.json').read_text());expanded=json.loads((ROOT/'data/expanded-local.json').read_text())
  jobs={v['site']+'-'+v['id']:(n,v) for n,v in seed['local'].items()}
  jobs.update({v['site']+'-'+v['id']:(v['name'],v) for v in expanded})
  with tempfile.TemporaryDirectory() as directory:
   cache=Path(directory);report={'localFailures':[],'checks':[]};provenance={'sources':{}}
   for source in MANIFEST:(cache/(source['id']+'.html')).write_bytes((FIX/(source['id']+'.html')).read_bytes())
   scope=dict(attempted_ids=set(),candidate_failures={},ROOT=ROOT,CACHE=cache,report=report,provenance=provenance,previous=LAWS,seed=seed,
    a=SimpleNamespace(add_only=False,refresh=True,only_sites='',skip_sites='',only_laws=''),
    PARSING=json.loads((ROOT/'data/local-parsing.json').read_text()),FORMATS=FORMATS,
    parse_reviewed=parse_reviewed,validate_local_text=validate_local_text,SourceCircuitOpen=SourceCircuitOpen,
    re=re,json=json,hashlib=hashlib,unicodedata=unicodedata,urllib=urllib,html=html,deepcopy=deepcopy,
    datetime=datetime,timezone=timezone,write_report=lambda:None,
    fetch=lambda url,filename:(cache/filename).read_bytes())
   exec(compile(ast.Module(body=functions,type_ignores=[]),'<production-getlocal>','exec'),scope)
   for source in MANIFEST:
    with self.subTest(source=source['id']):
     doc=scope['getlocal'](jobs[source['id']]);self.assertEqual(len(doc['articles']),source['articles'])
     self.assertEqual(doc['coverage'],'full' if source['articles'] else 'link')
     if not source['articles']:self.assertTrue(doc['note'].startswith('官方頁面僅提供附件'))
     self.assertEqual(provenance['sources'][doc['id']]['sha256'],source['sha256'])
     tree=html.fromstring((cache/(doc['id']+'.html')).read_bytes())
     expected={urllib.parse.urljoin(doc['url'],el.get('href')) for el in tree.xpath('//a[contains(@href,"Download.ashx")]')}
     self.assertEqual({a['url'] for a in doc['attachments']},expected)
   self.assertEqual(report['localFailures'],[])
   self.assertEqual(len(report['checks']),7)

if __name__=='__main__':unittest.main()
