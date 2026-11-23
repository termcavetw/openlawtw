"""Taoyuan 土管要點 sync: listing parsing, case metadata, incremental merge. Network-free."""
import importlib.util, sys, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('sync_landuse', SCRIPTS / 'sync-landuse.py')
sl = importlib.util.module_from_spec(spec); spec.loader.exec_module(sl)
cspec = importlib.util.spec_from_file_location('check_landuse', SCRIPTS / 'check-landuse.py')
cl = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(cl)


def case(cid, files, date='2026-03-13', area='中壢平鎮都市計畫', doc=('府都計', '1150059623')):
    return {'ID': cid, 'ONO': '08143', 'PPAREAID': '08', 'PPAREA': area, 'PNAME': f'變更案 {cid}', 'PKINDID': '000002',
            'PKIND': '細部計畫', 'PTYPEID': '000005', 'PTYPE': '土地管制要點', 'PDOC1': doc[0], 'PDOC2': doc[1],
            'PPDATE': date, 'FILES': [{'name': n, 'fileName': f} for n, f in files]}


def listing(cases):
    return [{'resultCode': '0000', 'resultMsg': '查詢成功', 'DATA': cases}]


def many(n, start=1):
    return [case(i, [('公告', f'PF000001{i:06d}.pdf'), ('土管要點', f'PF000005{i:06d}.pdf')],
                 date=f'20{10 + i % 15:02d}-01-01') for i in range(start, start + n)]


def item_for(row, pages=1):
    it = sl.case_meta(row)
    it.update(sha256='a' * 64, pages=[{'n': n, 'ocr': False, 'text': '建蔽率'} for n in range(1, pages + 1)])
    return it


class ListingTests(unittest.TestCase):
    def setUp(self):
        self.min = sl.MIN_LISTED
        sl.MIN_LISTED = 1

    def tearDown(self):
        sl.MIN_LISTED = self.min

    def test_only_pf000005_files_become_rows(self):
        rows = sl.parse_listing(listing([case(1175, [('公告', 'PF000001000336.pdf'), ('計畫書', 'PF000002001432.pdf'),
                                                     ('土管要點', 'PF000005000514.pdf')])]))
        self.assertEqual([r['id'] for r in rows], ['PF000005000514'])
        meta = sl.case_meta(rows[0])
        self.assertEqual((meta['area'], meta['kind'], meta['docNo'], meta['date'], meta['year']),
                         ('中壢平鎮都市計畫', '細部計畫', '府都計1150059623號', '2026-03-13', 115))
        self.assertEqual(meta['url'], sl.FILE_BASE + 'PF000005000514.pdf')
        self.assertEqual([f['name'] for f in meta['files']], ['公告', '計畫書'])

    def test_doc_number_keeps_site_wording_and_never_doubles_hao(self):
        self.assertEqual(sl.doc_no({'PDOC1': '(90)府城鄉', 'PDOC2': '1080292874號'}), '(90)府城鄉1080292874號')
        self.assertEqual(sl.doc_no({'PDOC1': '府都計', 'PDOC2': ''}), '')

    def test_bad_dates_stay_empty(self):
        rows = sl.parse_listing(listing([case(1, [('土管要點', 'PF000005000001.pdf')], date='')]))
        self.assertEqual((sl.case_meta(rows[0])['date'], sl.case_meta(rows[0])['year']), ('', None))

    def test_broken_or_short_listing_is_rejected(self):
        with self.assertRaises(sl.ListingProblem):
            sl.parse_listing([{'resultCode': '9999', 'DATA': None}])
        with self.assertRaises(sl.ListingProblem):
            sl.parse_listing(listing([case(1, []), case(1, [])]))
        sl.MIN_LISTED = 5
        with self.assertRaises(sl.ListingProblem):
            sl.parse_listing(listing(many(3)))


class MergeTests(unittest.TestCase):
    def setUp(self):
        self.min = sl.MIN_LISTED
        sl.MIN_LISTED = 1

    def tearDown(self):
        sl.MIN_LISTED = self.min

    def test_known_files_are_never_fetched_again_and_metadata_follows_site(self):
        rows = sl.parse_listing(listing(many(3)))
        old = item_for(rows[0]); old['title'] = '舊案名'
        fetched = []
        items, changes = sl.merge({'items': [old]}, rows, lambda r: fetched.append(r['id']) or item_for(r))
        self.assertEqual(sorted(fetched), [rows[1]['id'], rows[2]['id']])
        self.assertEqual(next(i for i in items if i['id'] == rows[0]['id'])['title'], rows[0]['case']['PNAME'])
        self.assertEqual([(i['date'], i['id']) for i in items], sorted(((i['date'], i['id']) for i in items), reverse=True))
        self.assertEqual(changes['removed'], [])

    def test_ocr_budget_defers_the_rest(self):
        rows = sl.parse_listing(listing(many(3)))
        def fetch(r):
            it = item_for(r, pages=2)
            for p in it['pages']:
                p['ocr'] = True
            return it
        items, changes = sl.merge({}, rows, fetch, max_ocr_pages=3)
        self.assertEqual((len(items), len(changes['deferred'])), (2, 1))

    def test_broken_file_waits_and_many_removals_keep_archive(self):
        rows = sl.parse_listing(listing(many(2)))
        def fetch(r):
            if r['id'] == rows[0]['id']:
                raise ValueError('not a PDF')
            return item_for(r)
        items, changes = sl.merge({}, rows, fetch, log=lambda *_: None)
        self.assertEqual(([i['id'] for i in items], changes['deferred']), ([rows[1]['id']], [rows[0]['id']]))
        old = [item_for(r) for r in sl.parse_listing(listing(many(sl.MAX_REMOVED + 1, start=100)))]
        with self.assertRaises(sl.ListingProblem):
            sl.merge({'items': old}, rows, item_for)

    def test_checker_accepts_merged_archive_and_rejects_stale_metadata(self):
        rows = sl.parse_listing(listing(many(3)))
        items, changes = sl.merge({}, rows, item_for)
        archive = sl.make_archive(items, rows, changes, '2026-11-23')
        self.assertEqual(cl.check(archive, rows), (3, 3))
        archive['items'][0]['area'] = '錯的計畫區'
        archive['stats']['areas'] = 2
        with self.assertRaises(AssertionError):
            cl.check(archive, rows)


if __name__ == '__main__':
    unittest.main()
