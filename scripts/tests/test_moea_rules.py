"""經濟部行政規則 (law.moea.gov.tw, read in the user's browser): records, points and catalog entries."""
import json, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
read = lambda p: json.loads((ROOT / p).read_text(encoding='utf-8'))


class MoeaRulesTests(unittest.TestCase):
    def test_records(self):
        rules = read('data/moea-rules-laws.json')
        self.assertEqual(len(rules), 24)
        for r in rules:
            self.assertTrue(r['id'].startswith('經濟部-') and r['articles'] and r['modified'], r['id'])
            self.assertTrue(all(a['no'].startswith('第') and a['no'].endswith('點') for a in r['articles']), r['id'])
        by = {r['id']: r for r in rules}
        self.assertIn('一點五倍', by['經濟部-FL079471']['articles'][1]['text'])
        self.assertEqual(by['經濟部-FL079471']['modified'], '2024-03-04')
        self.assertEqual(by['經濟部-FL064608']['articles'][0]['path'], ['第一章 總則'])
        self.assertEqual(by['經濟部-FL025856']['name'], '工廠檢查作業要點')

    def test_interpretations(self):
        # one-paragraph 解釋令 are letters in the 部會函釋 archive, filed under the article they construe
        items = read('public/data/moea-interpretations.json')['items']
        self.assertEqual(len(items), 10)
        by = {x['id']: x for x in items}
        self.assertEqual(by['RGL001318']['filed'], [{'law': '建築物設置透水保水或滯洪設施適用範圍及容量標準', 'article': ''}])
        self.assertIn({'law': '水利法', 'article': '第 83-10 條'}, by['RGL000837']['filed'])
        self.assertTrue(all(x['url'].startswith('https://law.moea.gov.tw/LawContent.aspx?id=') for x in items))

    def test_catalog_and_sync(self):
        ids = {r['id'] for r in read('data/moea-rules-laws.json')}
        self.assertTrue(ids <= {l['id'] for l in read('data/catalog.json')['laws']})
        self.assertTrue(ids <= set(read('public/data/laws.json')))
        self.assertIn('data/moea-rules-laws.json', (ROOT / 'scripts/sync-laws.py').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
