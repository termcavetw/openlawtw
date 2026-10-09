"""Per-law failures are isolated; retained content and evidence cannot move."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from partial_sync import reconcile, fingerprint, validate_candidate
spec=importlib.util.spec_from_file_location('guard',Path(__file__).resolve().parents[1]/'sync-guard.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)

class PartialSyncTests(unittest.TestCase):
 def setUp(self):
  self.old={id:dict(id=id,name=id,region='臺北市',source='臺北市法規查詢系統',kind='自治條例',url='https://laws.gov.taipei/'+id,coverage='full',retrieved='2026-01-01T00:00:00Z',articles=[dict(no='第1條',text='完整的正式條文本文',path=[])]) for id in ['A','B']}
  self.sources={id:dict(url=doc['url'],format='html',sha256='a'*64,observedAt=doc['retrieved']) for id,doc in self.old.items()}
 def run_sync(self,candidates=None,failures=None,ids=None):
  return reconcile(self.old,candidates or self.old,self.sources,self.sources,failures or {},'2026-10-08T00:00:00Z',ids if ids is not None else set(self.old))
 def test_mixed_failure_preserves_full_old_record_and_provenance(self):
  candidates=deepcopy(self.old);candidates['A']['articles'][0]['text']='更新後完整正式條文本文'
  candidates['B']['retrieved']='2026-10-08'
  laws,sources,rows=self.run_sync(candidates,{'B':'HTTP 403'})
  self.assertEqual(laws['B'],self.old['B']);self.assertEqual(sources['B'],self.sources['B'])
  self.assertNotEqual(laws['A'],self.old['A']);self.assertEqual([r['status'] for r in rows],['updated','retained'])
  self.assertEqual(guard.partial_errors(self.old,laws,{'outcomes':rows},self.sources,sources),[])
 def test_all_failed_and_missing_law_retained(self):
  laws,sources,rows=self.run_sync({'A':self.old['A']},{'A':'network','B':'missing title'})
  self.assertEqual(laws,self.old);self.assertEqual(sources,self.sources)
  self.assertEqual([r['status'] for r in rows],['retained','retained'])
 def test_unchanged_and_not_attempted(self):
  laws,sources,rows=self.run_sync(ids={'A'})
  self.assertEqual(laws,self.old);self.assertEqual([r['status'] for r in rows],['unchanged','not-attempted'])
 def test_identity_truncation_duplicates_and_empty_rejected_independently(self):
  for edit in [lambda d:d.update(name='wrong title'),lambda d:d.update(coverage='link',articles=[]),lambda d:d['articles'].append(deepcopy(d['articles'][0])),lambda d:d['articles'][0].update(text='短'),lambda d:d.update(retrieved='invented'),lambda d:d['articles'][0].update(text='完整的正式條文資訊安全政策')]:
   candidates=deepcopy(self.old);edit(candidates['B'])
   laws,_,rows=self.run_sync(candidates)
   self.assertEqual(laws['B'],self.old['B']);self.assertEqual(rows[1]['status'],'retained');self.assertEqual(rows[0]['status'],'unchanged')
 def test_guard_rejects_forged_retained_body_provenance_date_and_missing_outcomes(self):
  laws,sources,rows=self.run_sync(failures={'B':'timeout'})
  for edit in [lambda l,s,r:l['B'].update(note='changed'),lambda l,s,r:s['B'].update(sha256='b'*64),lambda l,s,r:r[1].update(lastSuccessfulFetch='invented'),lambda l,s,r:r.pop(),lambda l,s,r:r.append(deepcopy(r[0]))]:
   l,s,r=deepcopy((laws,sources,rows));edit(l,s,r)
   self.assertTrue(guard.partial_errors(self.old,l,{'outcomes':r},self.sources,s))
 def test_missing_new_law_not_published(self):
  laws,sources,rows=self.run_sync(failures={'NEW':'name mismatch'},ids={'NEW'})
  self.assertNotIn('NEW',laws);self.assertEqual(rows[-1]['status'],'unavailable');self.assertIsNone(rows[-1]['candidateHash'])
 def test_legacy_central_provenance_retained_while_neighbor_updates(self):
  for d in self.old.values():d.update(source='全國法規資料庫',kind='法律')
  self.sources={'CF':{'sha256':'a'*64,'observedAt':'2026-01-01T00:00:00Z'}}
  fresh={'A':{'sha256':'b'*64,'observedAt':'2026-01-01T00:00:00Z','lawId':'A','bulkKey':'CF'}}
  laws,sources,rows=reconcile(self.old,self.old,self.sources,fresh,{'B':'missing'},'now',{'A','B'})
  self.assertEqual(sources['CF'],self.sources['CF']);self.assertEqual(rows[1]['source'],self.sources['CF']);self.assertEqual(sources['A'],fresh['A'])

if __name__=='__main__':unittest.main()
