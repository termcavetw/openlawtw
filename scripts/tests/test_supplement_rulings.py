"""Letters cited elsewhere and added one by one from official pages: the archive is a fresh import of the preserved pages."""
import json, subprocess, sys, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/data/supplement-rulings.json'


class SupplementTests(unittest.TestCase):
    def test_archive_matches_import(self):
        before = OUT.read_bytes()
        subprocess.run([sys.executable, str(ROOT / 'scripts/import-supplement-rulings.py')], check=True, stdout=subprocess.DEVNULL)
        self.assertEqual(OUT.read_bytes(), before)

    def test_known_letters(self):
        items = {x['docNo']: x for x in json.loads(OUT.read_bytes())['items']}
        x = items['法律字第0930019829號']
        self.assertEqual((x['issuer'], x['date']), ('法務部', '2004-05-25'))
        self.assertIn({'law': '區域計畫法', 'article': '第 21 條', 'cited': True}, x['filed'])
        g = items['台內營字第1020806442號令']
        self.assertEqual((g['issuer'], g['date']), ('內政部', '2013-07-04'))
        self.assertIn('公寓大廈防墜設施設置原則', g['body'])
        for x in items.values():
            self.assertTrue(x['url'].startswith(('https://mojlaw.moj.gov.tw/', 'https://gazette.nat.gov.tw/')), x['id'])


if __name__ == '__main__':
    unittest.main()
