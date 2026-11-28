"""常用大表 (data/structured-tables): shape and internal consistency of the hand-checked tables (offline)."""
import json, re, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
T = ROOT / 'data/structured-tables'
GROUPS = ['A-1', 'A-2', 'B-1', 'B-2', 'B-3', 'B-4', 'C-1', 'C-2', 'D-1', 'D-2', 'D-3', 'D-4', 'D-5', 'E',
          'F-1', 'F-2', 'F-3', 'F-4', 'G-1', 'G-2', 'G-3', 'H-1', 'H-2', 'I']


def load(name):
    return json.loads((T / f'{name}.json').read_text(encoding='utf-8'))


class Tables(unittest.TestCase):
    def test_every_table_names_its_source(self):
        laws = json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8'))
        files = sorted(T.glob('*.json'))
        self.assertGreaterEqual(len(files), 7)
        for p in files:
            t = json.loads(p.read_text(encoding='utf-8'))
            with self.subTest(table=p.stem):
                self.assertEqual(t['id'], p.stem)
                self.assertIn(t['law'], laws)
                self.assertIn(t['source']['kind'], ('article', 'attachment'))
                self.assertRegex(t['source']['sha256'], r'^[0-9a-f]{64}$')
                self.assertTrue(t['rows'] and t['columns'] and t['method'])

    def test_parking_59(self):
        t = load('parking-59')
        self.assertEqual([r['category'] for r in t['rows']], ['第一類', '第二類', '第三類', '第四類', '第五類'])
        self.assertEqual(t['rows'][1]['urban'], {'exemptUpTo': 500, 'perArea': 150, 'text': t['rows'][1]['urban']['text']})
        self.assertEqual(t['rows'][3]['nonUrban']['perArea'], 350)

    def test_accessible_parking_ranges_are_contiguous(self):
        t = load('accessible-parking-167-6')
        for cat in ('第一類', '第二類'):
            rows = [r for r in t['rows'] if r['category'] == cat]
            self.assertEqual(rows[0]['min'], 51)
            for a, b in zip(rows, rows[1:]):
                self.assertEqual(b['min'], a['max'] + 1)
            self.assertIsNone(rows[-1]['max'])

    def test_change_of_use_matrix_is_complete(self):
        t = load('change-of-use-principles')
        pairs = {(r['from'], r['to']): r['value'] for r in t['rows']}
        self.assertEqual(len(pairs), 24 * 23)
        self.assertTrue(set(pairs.values()) <= set(t['legend']))
        self.assertEqual(pairs[('H-2', 'G-2')], '☆')
        self.assertEqual(pairs[('C-2', 'C-1')], '△')

    def test_review_items_cover_every_group(self):
        t = load('change-of-use-review-items')
        groups = {}
        for r in t['rows']:
            groups.setdefault(r['group'], []).append(r['no'])
        self.assertEqual(sorted(groups), sorted(GROUPS))
        for g, nos in groups.items():
            self.assertEqual(nos, list(range(1, len(nos) + 1)), g)
            self.assertEqual(len(nos), 22 if g in ('H-1', 'H-2') else 20, g)

    def test_live_load_covers_every_group(self):
        t = load('live-load-17')
        self.assertEqual(sorted({r['group'] for r in t['rows']}), sorted(GROUPS))
        self.assertTrue(all(r['load'] in (200, 250, 300, 400, 500, 600) for r in t['rows']))

    def test_nonurban_numbering(self):
        t = load('nonurban-permitted-uses')
        self.assertEqual(len({r['landuse'] for r in t['rows']}), 18)
        seen = {}
        for r in t['rows']:
            m = re.match(r'^(\d+)\.', r['free'] or r['permit'])
            if m:
                seen.setdefault((r['landuse'], r['item']), []).append(int(m.group(1)))
        for k, nos in seen.items():
            self.assertEqual(nos, list(range(1, len(nos) + 1)), k)


if __name__ == '__main__':
    unittest.main()
