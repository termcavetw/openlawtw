"""Partial synchronization validates all structure and only accepted raw sources."""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest

VALIDATOR=Path(__file__).resolve().parents[1]/'validate-data.py'
STAMP='2026-10-08T00:00:00+00:00'


def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()


class PartialValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        for directory in ('scripts','data','public/data','cache/laws','cache/orders'):
            (self.root/directory).mkdir(parents=True,exist_ok=True)
        shutil.copyfile(VALIDATOR,self.root/'scripts/validate-data.py')
        self.docs={
            'A':{'id':'A','name':'Central law','kind':'法律','source':'全國法規資料庫','region':'中央','url':'https://law.moj.gov.tw/?pcode=A','coverage':'full','retrieved':STAMP,'articles':[{'no':'第 1 條','text':'Official text.','path':[]}]},
            'B':{'id':'B','name':'Link law','kind':'自治條例','source':'地方政府','region':'臺北市','url':'https://example.gov.tw/B','coverage':'link-only','retrieved':STAMP,'articles':[]},
        }
        self.raw=b'<html>Official link-only metadata</html>'
        self.sources={'CF':{'format':'xml','sha256':'old digest'},'B':{'format':'html','sha256':hashlib.sha256(self.raw).hexdigest(),'observedAt':STAMP}}
        self.report={'policy':'per-law-v1','status':'complete','outcomes':[
            {'id':id,'name':doc['name'],'status':'retained','attemptedAt':STAMP,'lastSuccessfulFetch':STAMP,'reason':'source unavailable'} for id,doc in self.docs.items()]}

    def accepted(self,id='B'):
        row=next(row for row in self.report['outcomes'] if row['id']==id)
        row.update(status='unchanged',source=copy.deepcopy(self.sources[id]),candidateHash=digest(self.docs[id]))
        if id=='B':(self.root/'cache/B.html').write_bytes(self.raw)

    def run_validation(self):
        catalog={'laws':copy.deepcopy(list(self.docs.values())),'regions':[{'name':str(n)} for n in range(22)],'relations':[]}
        for law in catalog['laws']:
            for article in law['articles']:article['text']=''
        files={'data/catalog.json':catalog,'public/data/catalog.json':catalog,'public/data/laws.json':self.docs,'public/data/rulings.json':{'items':[]},'data/provenance.json':{'sources':self.sources},'report.json':self.report}
        for path,data in files.items():(self.root/path).write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
        return subprocess.run([sys.executable,str(self.root/'scripts/validate-data.py'),'--cache',str(self.root/'cache'),'--sync-report',str(self.root/'report.json')],capture_output=True,text=True)

    def assert_passes(self):
        result=self.run_validation();self.assertEqual(result.returncode,0,result.stderr)

    def assert_fails(self,detail):
        result=self.run_validation();self.assertNotEqual(result.returncode,0);self.assertIn(detail,result.stderr)

    def test_no_accepted_sources_allows_empty_cache(self):
        self.assert_passes()

    def test_failed_bulk_cache_is_not_parsed_or_hashed(self):
        (self.root/'cache/laws/FalV.xml').write_text('broken XML')
        self.accepted();self.assert_passes()

    def test_link_only_raw_is_required(self):
        self.accepted();(self.root/'cache/B.html').unlink()
        self.assert_fails('selected raw source is missing')

    def test_link_only_raw_hash_is_verified(self):
        self.accepted();(self.root/'cache/B.html').write_bytes(b'tampered')
        self.assert_fails('raw source SHA-256 mismatch')

    def test_report_must_cover_current_laws_exactly_once(self):
        self.report['outcomes'].pop();self.assert_fails('cover every current law')

    def test_unavailable_new_candidate_may_be_absent(self):
        self.report['outcomes'].append({'id':'NEW','name':'New law','status':'unavailable','attemptedAt':STAMP,'lastSuccessfulFetch':'','candidateHash':None,'source':None})
        self.assert_passes()

    def test_published_status_for_unknown_candidate_is_rejected(self):
        self.report['outcomes'].append({'id':'NEW','status':'updated'})
        self.assert_fails('Only unavailable unpublished')

    def test_report_rejects_duplicate_ids(self):
        self.report['outcomes'].append(copy.deepcopy(self.report['outcomes'][0]))
        self.assert_fails('Duplicate sync outcome IDs')

    def test_report_rejects_changed_provenance(self):
        self.accepted();self.sources['B']['sha256']='bad'
        self.assert_fails('source differs from provenance')

    def test_report_rejects_changed_candidate(self):
        self.accepted();self.report['outcomes'][1]['candidateHash']='bad'
        self.assert_fails('candidate fingerprint mismatch')

    def test_retained_document_timestamp_must_match(self):
        self.report['outcomes'][0]['lastSuccessfulFetch']='new timestamp'
        self.assert_fails('last successful fetch differs')

    def test_global_structure_still_checked_for_retained_laws(self):
        self.docs['A']['articles'][0]['text']=''
        self.assert_fails('AssertionError')

    def test_central_per_law_provenance(self):
        raw='<root><法規><法規網址>https://law.moj.gov.tw/?pcode=A</法規網址><法規內容><條文><條號>1</條號><條文內容>Official text.</條文內容></條文></法規內容></法規></root>'.encode()
        self.sources['A']={'format':'xml','bulkKey':'CF','lawId':'A','sha256':hashlib.sha256(raw).hexdigest()}
        (self.root/'cache/laws/FalV.xml').write_bytes(raw)
        self.accepted('A');self.assert_passes()


if __name__=='__main__':unittest.main()
