"""Central agencies' letters via laws.gov.taipei: article pages, filing, merge and checker. Network-free."""
import importlib.util, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_central', SCRIPTS / 'sync-central.py')
sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
cspec = importlib.util.spec_from_file_location('check_central', SCRIPTS / 'check-central.py')
cc = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(cc)
FIX = Path(__file__).parent / 'fixtures/central'


class CentralTests(unittest.TestCase):
    def test_article_and_related_pages(self):
        nos = sc.article_numbers((FIX / 'articles.html').read_text(encoding='utf-8'), 'FL005007')
        self.assertEqual(nos[:4], ['2', '3', '6', '8'])
        self.assertIn('14-1', nos)
        related = (FIX / 'related.html').read_text(encoding='utf-8')
        self.assertEqual(sc.law_name(related), '消防法 第 6 條')
        rows, _ = sc.st.parse_list_page(related)
        self.assertEqual(rows[0]['head'], '內政部消防署 115.08.20 消署預字第1153318045號函')

    def test_merge_and_check(self):
        rows = [{'id': 'B1', 'head': '內政部消防署 115.08.20 消署預字第1號函', 'summary': 's', 'filed': [{'law': '消防法', 'article': '第 6 條'}]},
                {'id': 'B2', 'head': '經濟部 110.01.02 經授中字第2號函', 'summary': 's', 'filed': [{'law': '工廠管理輔導法', 'article': '第 28-1 條'}]}]

        def fetch(i):
            issuer, day, number = sc.st.head_line(next(r['head'] for r in rows if r['id'] == i))
            return {'id': i, 'date': day, 'docNo': number, 'issuer': issuer, 'summary': '要旨', 'body': '說明', 'filed': [], 'refs': [], 'url': sc.st.SITE + 'Content/' + i}
        items, changes = sc.merge({}, rows, fetch, log=lambda *_: None)
        self.assertEqual([it['id'] for it in items], ['B1', 'B2'])
        archive = sc.make_archive(items, rows, changes, '2026-11-27')
        self.assertEqual(cc.check(archive, rows), 2)
        self.assertEqual({t['name']: t['items'] for t in archive['stats']['topics']}, {'消防': 1, '工廠與產業': 1, '農業': 0})


if __name__ == '__main__':
    unittest.main()
