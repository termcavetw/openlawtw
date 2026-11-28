"""Reviewed attachment transcriptions (data/attachment-transcriptions): shape, coverage and symbols (offline)."""
import json, re, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
T = ROOT / 'data/attachment-transcriptions'
GROUPS = ['A-1', 'A-2', 'B-1', 'B-2', 'B-3', 'B-4', 'C-1', 'C-2', 'D-1', 'D-2', 'D-3', 'D-4', 'D-5', 'E',
          'F-1', 'F-2', 'F-3', 'F-4', 'G-1', 'G-2', 'G-3', 'H-1', 'H-2', 'I']


def entries():
    for p in sorted(T.glob('*.json')):
        for title, e in json.loads(p.read_text(encoding='utf-8')).items():
            yield p.stem, title, e


class Transcriptions(unittest.TestCase):
    def test_every_entry_has_text_rows_and_method(self):
        n = 0
        for law, title, e in entries():
            n += 1
            with self.subTest(law=law, title=title):
                self.assertTrue(e.get('text'))
                self.assertTrue(e.get('method'))
                self.assertIn(e.get('kind'), ('use-group matrix', 'use-group list', 'zone-use list'))
                self.assertTrue(e.get('rows'))
        self.assertGreaterEqual(n, 12)

    def test_matrices_cover_every_pair_and_use_only_listed_symbols(self):
        for law, title, e in entries():
            if e['kind'] != 'use-group matrix':
                continue
            with self.subTest(law=law):
                pairs = {(r['from'], r['to']) for r in e['rows']}
                for f in GROUPS:
                    for t in GROUPS:
                        if f != t:
                            self.assertIn((f, t), pairs, (f, t))
                if 'legend' not in e:
                    continue
                keys = ''.join(e['legend'])
                for r in e['rows']:
                    for sym in r['value'].split('／'):
                        if sym in ('（空白）',) or re.fullmatch(r'[0-9A-Z]̲?', sym):
                            continue  # digits and letters are explained in the notes when the legend lacks them
                        self.assertIn(sym, keys, (r, law))

    def test_matrix_text_lines_match_rows(self):
        for law, title, e in entries():
            if e['kind'] != 'use-group matrix':
                continue
            lines = [l for l in e['text'].split('\n') if re.match(r'^[^（\s]+ → [^\s]+：', l)]
            self.assertEqual(len(lines), len(e['rows']), law)

    def test_lists_name_the_target_group(self):
        for law, title, e in entries():
            if e['kind'] == 'use-group matrix':
                continue
            for r in e['rows']:
                to = r.get('to') if 'to' in r else r.get('group')
                if isinstance(to, list):
                    to = '、'.join(to)
                cond = r.get('condition') or r.get('rule') or r.get('items') or ''
                self.assertTrue(to or cond, (law, r))


if __name__ == '__main__':
    unittest.main()
