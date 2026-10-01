"""Guard faithful originals, separate handbook editions and reproducible ingestion."""
from pathlib import Path
import hashlib
import importlib.util
import json
import unittest
ROOT = Path(__file__).resolve().parents[2]

class GreenBuildingSources(unittest.TestCase):
    def setUp(self):
        self.sources = json.loads((ROOT / 'data/green-building-sources.json').read_text())
        self.laws = json.loads((ROOT / 'public/data/laws.json').read_text())

    def test_originals_are_complete_and_not_invented_articles(self):
        self.assertEqual(len(self.sources['documents']), 7)
        self.assertEqual(sum(x['pages'] for x in self.sources['documents']), 126)
        for item in self.sources['documents']:
            with self.subTest(id=item['id']):
                raw = (ROOT / item['file']).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), item['sha256'])
                law = self.laws[item['id']]
                self.assertEqual(law['coverage'], 'link')
                self.assertEqual(law['articles'], [])
                self.assertEqual(law['document']['pages'], item['pages'])
                self.assertNotEqual(law['modified'][:10], law['retrieved'][:10])
        self.assertNotEqual(self.laws['NLMA-936']['name'], self.laws['NLMA-937']['name'])
        self.assertIn('建築能效標示', self.laws['ABRI-330726']['name'])

    def test_manuals_remain_link_only_and_dates_are_per_edition(self):
        self.assertEqual(len(self.sources['manuals']), 11)
        for item in self.sources['manuals']:
            law = self.laws[item['id']]
            self.assertNotIn('document', law)
            self.assertEqual(law['articles'], [])
            self.assertEqual(law['modified'], '')
            self.assertIn('未收錄手冊全文', law['effectiveNote'])
            if item['edition'] == 2026:
                self.assertEqual(law['effective'], '2030-07-01')
                self.assertIn('自願', law['effectiveNote'])
        self.assertEqual(self.laws['ABRI-EEWH-GF-2025']['effective'], '2025-07-01')
        self.assertNotIn('ABRI-EEWH-GF-2023', self.laws)

    def test_errata_and_energy_annex_scope_are_explicit(self):
        for id in ['NLMA-976', 'NLMA-961', 'NLMA-170', 'NLMA-6187']:
            law = self.laws[id]
            self.assertIn('勘誤', law['document']['versionNote'])
            self.assertTrue(any('勘誤' in a['title'] for a in law['attachments']))
        law = self.laws['NLMA-6187']
        self.assertEqual(sum(a['title'].startswith('附錄') for a in law['attachments']), 5)
        self.assertIn('未宣稱已收錄附錄全文', law['document']['versionNote'])

    def test_import_is_reproducible(self):
        spec = importlib.util.spec_from_file_location('green', ROOT / 'scripts/import-green-building.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.build(check=True)

if __name__ == '__main__':
    unittest.main()
