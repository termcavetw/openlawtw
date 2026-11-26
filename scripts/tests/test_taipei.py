"""臺北市解釋令函: parsing, merge and checker. Network-free (fixtures saved from laws.gov.taipei)."""
import importlib.util, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_taipei', SCRIPTS / 'sync-taipei.py')
st = importlib.util.module_from_spec(spec); spec.loader.exec_module(st)
cspec = importlib.util.spec_from_file_location('check_taipei', SCRIPTS / 'check-taipei.py')
ct = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(ct)
FIX = Path(__file__).parent / 'fixtures/taipei'
read = lambda name: (FIX / name).read_text(encoding='utf-8')


class TaipeiTests(unittest.TestCase):
    def test_list_page(self):
        rows, total = st.parse_list_page(read('list.html'))
        self.assertEqual(total, 240)
        self.assertEqual(rows[0]['id'], 'FE400046')
        self.assertEqual(rows[0]['head'], '臺北市政府 115.09.09 府授都設字第1153061485號函')
        self.assertTrue(rows[0]['summary'].startswith('臺北市政府就「山限區內未開闢計畫道路'))

    def test_head_line(self):
        self.assertEqual(st.head_line('臺北市政府法務局 102.10.21 簽見'), ('臺北市政府法務局', '2013-10-21', '簽見'))
        self.assertEqual(st.head_line('臺北市政府 115.09.09 府授都設字第1153061485號函')[1:], ('2026-09-09', '府授都設字第1153061485號函'))

    def test_content_and_related(self):
        item = st.parse_content(read('content.html'), 'FE219253', '都市發展類')
        self.assertEqual((item['issuer'], item['date'], item['docNo']), ('臺北市政府法規委員會', '2008-01-08', '北市法二字第09632963500號函'))
        self.assertTrue(item['summary'].startswith('內政部針對防火門開啟方向所作之函釋') and '\n' not in item['summary'])
        self.assertIn('釋字第 287號', item['body'])
        self.assertEqual(st.parse_related(read('related.html')), [{'scope': '中央', 'law': '行政程序法', 'version': '2005-12-28', 'articles': ['第 117 條']}])

    def test_merge_and_check(self):
        rows = [{'id': 'A2', 'head': '臺北市政府 115.01.02 府字第2號函', 'summary': 's', 'category': '都市發展類'},
                {'id': 'A1', 'head': '臺北市政府 114.01.02 府字第1號函', 'summary': 's', 'category': '工務類'},
                {'id': 'A1', 'head': '臺北市政府 114.01.02 府字第1號函', 'summary': 's', 'category': '都市發展類'},
                {'id': 'A3', 'head': '臺北市政府 113.01.02 府字第3號函', 'summary': 's', 'category': '工務類'}]

        def fetch(i, category):
            if i == 'A3':
                raise ValueError('broken page')
            issuer, day, number = st.head_line(next(r['head'] for r in rows if r['id'] == i))
            return {'id': i, 'category': category, 'date': day, 'docNo': number, 'issuer': issuer, 'summary': '要旨', 'body': '說明',
                    'refs': [{'scope': '中央', 'law': '建築法', 'version': '2022-05-11', 'articles': ['第 77-1 條']}], 'url': st.SITE + 'Content/' + i}
        items, changes = st.merge({}, rows, fetch, log=lambda *_: None)
        self.assertEqual([it['id'] for it in items], ['A2', 'A1'])
        self.assertEqual(changes['failed'], ['A3'])
        archive = st.make_archive(items, rows, changes, '2026-11-27')
        self.assertEqual(ct.check(archive, rows), 2)
        with self.assertRaises(st.ListingProblem):
            st.merge({'items': [dict(items[0], id=f'X{n}') for n in range(st.MAX_REMOVED + 1)]}, rows, fetch, log=lambda *_: None)


if __name__ == '__main__':
    unittest.main()
