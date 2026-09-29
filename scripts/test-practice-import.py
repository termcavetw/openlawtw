"""Offline source pairing, extraction and failed-import publication regressions."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import importlib.util,json,unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('practice_import',ROOT/'scripts/import-practice-forms.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
catalog=json.loads((ROOT/'data/practice/ntpc-interior-forms.json').read_text(encoding='utf-8'))
raw=(ROOT/catalog['pageFile']).read_bytes()
bodies={item['source']:(ROOT/item['file']).read_bytes() for item in catalog['items']}

def fixture_rows():
    return '<html><head><meta charset="utf-8"></head><body><div>'+('<br>'.join(f'{i}.115/08/01 {official}(<a href="{item["source"]}">.doc.odf</a>)' for i,((_,official,_),item) in enumerate(zip(module.FORMS,catalog['items']),1)))+'</div></body></html>'

class PracticeImportTests(unittest.TestCase):
    def test_archived_source_and_every_original(self):
        self.assertEqual(module.sha256(raw).hexdigest(),catalog['pageSHA256'])
        selected=module.select_forms(raw)
        self.assertEqual(len(selected),11)
        for i,(source,item) in enumerate(zip(selected,catalog['items']),1):
            self.assertEqual(item['id'],f'ntpc-interior-{i:02}')
            for field,value in source.items():self.assertEqual(item[field],value)
            self.assertEqual(item['sourcePageSHA256'],catalog['pageSHA256'])
            body=bodies[item['source']]
            self.assertEqual(module.sha256(body).hexdigest(),item['sha256'])
            self.assertEqual(len(body),item['bytes'])
            self.assertEqual(module.extract_odt(body),item['text'])
            self.assertIn('版本標示不等於施行日期',item['note'])

    def test_date_is_bound_to_its_own_row(self):
        updated=fixture_rows().replace('1.115/08/01','1.115/09/01',1).encode()
        selected=module.select_forms(updated)
        self.assertEqual(selected[0]['versionDate'],'2026-09-01')
        self.assertEqual(selected[0]['versionLabel'],'115/09/01（官方清單標示）')
        self.assertEqual(selected[1]['versionDate'],'2026-08-01')
        with self.assertRaises(ValueError):module.select_forms(fixture_rows().replace('1.115/08/01','1.',1).encode())

    def test_swapped_link_or_title_cannot_be_mislabeled(self):
        first,second=[item['source'] for item in catalog['items'][:2]]
        swapped=fixture_rows().replace(first,'TEMP').replace(second,first).replace('TEMP',second)
        with self.assertRaises(ValueError):module.select_forms(swapped.encode())
        with self.assertRaises(ValueError):module.select_forms(fixture_rows().replace('1.115/08/01','2.115/08/01',1).encode())

    def test_bad_download_does_not_publish_anything(self):
        with TemporaryDirectory() as temp:
            root=Path(temp);current=root/'data/practice/ntpc-interior-forms.json';current.parent.mkdir(parents=True);current.write_bytes(b'previous catalog')
            def fetch(url):
                if url==module.SOURCE:return raw
                if url==catalog['items'][5]['source']:raise OSError('simulated download failure')
                return bodies[url]
            with self.assertRaises(OSError):module.capture(fetcher=fetch,root=root)
            self.assertEqual(current.read_bytes(),b'previous catalog')
            self.assertFalse((current.parent/'assets').exists())
            self.assertFalse((current.parent/'sources').exists())

    def test_success_and_failed_final_commit_preserve_current_snapshot(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            fetch=lambda url:raw if url==module.SOURCE else bodies[url]
            result=module.capture(fetcher=fetch,root=root,observed=catalog['observedAt'])
            self.assertEqual(result['items'],catalog['items'])
            current=root/'data/practice/ntpc-interior-forms.json';before=current.read_bytes()
            changed=fixture_rows().replace('1.115/08/01','1.115/09/01',1).encode()
            replace=module.os.replace
            def fail_catalog(source,target):
                if Path(target)==current:raise OSError('simulated final replace failure')
                replace(source,target)
            with patch.object(module.os,'replace',side_effect=fail_catalog):
                with self.assertRaises(OSError):module.capture(fetcher=lambda url:changed if url==module.SOURCE else bodies[url],root=root)
            self.assertEqual(current.read_bytes(),before)
            self.assertEqual((root/result['pageFile']).read_bytes(),raw)
            self.assertFalse(list(current.parent.glob('.ntpc-interior-forms.json-*')))

    def test_invalid_attachment_rejected(self):
        with self.assertRaises(Exception):module.extract_odt(b'<html>error page</html>')

    def test_valid_odt_returned_for_wrong_form_is_rejected(self):
        with TemporaryDirectory() as temp:
            def fetch(url):
                if url==module.SOURCE:return raw
                return bodies[catalog['items'][1]['source']]
            with self.assertRaisesRegex(ValueError,'document heading changed'):module.capture(fetcher=fetch,root=Path(temp))
            self.assertFalse((Path(temp)/'data/practice/ntpc-interior-forms.json').exists())

if __name__=='__main__':unittest.main()
