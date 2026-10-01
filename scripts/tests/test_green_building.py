"""Guard faithful originals, separate handbook editions and reproducible ingestion."""
from pathlib import Path
import hashlib
import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]

def importer():
    spec = importlib.util.spec_from_file_location('green', ROOT / 'scripts/import-green-building.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

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
        importer().build(check=True)

    def test_reviewed_poppler_variants_preserve_exact_canonical_snapshot(self):
        module = importer()
        canonical = [{'page': 1, 'text': '1.依 據\n    規範'}]
        alternative = [{'page': 1, 'text': '1.依\n1. 依 據\n     規範'}]
        def fingerprint(pages):
            raw = module.encoded('fixture-text.json', {'pages': pages}).encode('utf-8')
            return dict(sha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), extractor='fixture')
        item = dict(id='fixture', file='fixture.pdf', textExtractionReview={
            'canonical': fingerprint(canonical), 'alternatives': [fingerprint(alternative)]})
        with tempfile.TemporaryDirectory() as tmp, patch.object(module, 'ROOT', Path(tmp)):
            snapshot = Path(tmp) / 'fixture-text.json'
            snapshot.write_text(module.encoded(str(snapshot), {'pages': canonical}), encoding='utf-8')
            self.assertEqual(module.reviewed_text_snapshot(item, canonical), {'pages': canonical})
            self.assertEqual(module.reviewed_text_snapshot(item, alternative), {'pages': canonical})
            # Unknown text, whitespace, page number or truncation must not be accepted.
            for changed in ([{'page': 1, 'text': '1.依 據\n    規定'}],
                            [{'page': 1, 'text': canonical[0]['text'] + ' '}],
                            [{'page': 2, 'text': canonical[0]['text']}], []):
                with self.assertRaisesRegex(AssertionError, 'Unreviewed PDF text extraction'):
                    module.reviewed_text_snapshot(item, changed)
            snapshot.write_text(module.encoded(str(snapshot), {'pages': alternative}), encoding='utf-8')
            with self.assertRaisesRegex(AssertionError, 'Canonical text snapshot changed'):
                module.reviewed_text_snapshot(item, alternative)
            snapshot.unlink()
            with self.assertRaisesRegex(AssertionError, 'Missing canonical text snapshot'):
                module.reviewed_text_snapshot(item, alternative)

    def test_only_reviewed_overprint_documents_have_extraction_variants(self):
        reviewed = [item for item in self.sources['documents'] if 'textExtractionReview' in item]
        self.assertEqual({item['id'] for item in reviewed}, {'NLMA-936', 'NLMA-937'})
        for item in reviewed:
            review = item['textExtractionReview']
            raw = (ROOT / item['file'].replace('.pdf', '-text.json')).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), review['canonical']['sha256'])
            self.assertEqual(len(raw), review['canonical']['bytes'])
            self.assertEqual(len(review['alternatives']), 1)
            self.assertIn('25.03.0', review['canonical']['extractor'])
            self.assertIn('24.02.0', review['alternatives'][0]['extractor'])

if __name__ == '__main__':
    unittest.main()
