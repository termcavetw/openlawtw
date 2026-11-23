"""Taoyuan minutes sync: listing parsing, cover metadata, incremental merge. Network-free."""
import importlib.util, json, sys, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('sync_minutes', SCRIPTS / 'sync-minutes.py')
sm = importlib.util.module_from_spec(spec); spec.loader.exec_module(sm)
cspec = importlib.util.spec_from_file_location('check_minutes', SCRIPTS / 'check-minutes.py')
cm = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(cm)


def row_html(file_id, name, icon='pdf'):
    return (f'<div class="d-flex border-bottom py-2 mb-3" role="button" onclick=window.open("https://old.tyaa.org.tw/dl_file.php?id={file_id}","_blank","")>'
            f'<div><i class="fa fa-file-{icon}-o fa-3x pe-2"></i></div><div class="ms-1">'
            f'<div class="fs-3 text-black fw-light">{name}</div><div class="fs-5 fw-light mb-2">檔案大小：1 MB</div></div></div>')


def listing(*rows, total=None):
    html = f'<h4 style="mb-3">共有{len(rows) if total is None else total}檔案.</h4>' + ''.join(row_html(*r) for r in rows)
    return json.dumps({'success': True, 'html': html}).encode()


def item(file_id, sort, pages=1, **extra):
    base = {'id': file_id, 'title': f'{file_id} 會議紀錄', 'url': sm.DOWNLOAD + file_id, 'year': int(sort[:3]),
            'sortDate': sort, 'docNo': '', 'docDate': '', 'issuer': '', 'sha256': 'a' * 64,
            'pages': [{'n': n, 'ocr': False, 'text': '內容'} for n in range(1, pages + 1)]}
    base.update(extra)
    return base


MANUAL = {'items': [dict(item('790', '1060531'), sha256=None)]}


class ListingTests(unittest.TestCase):
    def test_parses_pdf_and_archive_rows_in_order(self):
        rows = sm.parse_listing(listing(('1607', '115年10月14日「疑義會議(76)」會議紀錄.pdf'), ('790', '106年第2次.rar', 'archive')))
        self.assertEqual([(r['id'], r['kind']) for r in rows], [('1607', 'pdf'), ('790', 'other')])
        self.assertEqual(rows[0]['name'], '115年10月14日「疑義會議(76)」會議紀錄.pdf')

    def test_count_mismatch_or_empty_listing_is_rejected(self):
        with self.assertRaises(sm.ListingProblem):
            sm.parse_listing(listing(('1', 'a.pdf'), total=2))
        with self.assertRaises(sm.ListingProblem):
            sm.parse_listing(listing())
        with self.assertRaises(sm.ListingProblem):
            sm.parse_listing(b'<html>blocked</html>')


class TextTests(unittest.TestCase):
    def test_spaces_between_chinese_removed_newlines_kept(self):
        self.assertEqual(sm.clean('桃 園 市  政府\n\n\n\n建 築（ 管理 ）處 abc  def\n .  \n'), '桃園市政府\n\n建築（管理）處 abc  def')

    def test_cover_metadata(self):
        page = '桃園市政府都市發展局 函\n發文日期：中華民國 115 年 11 月 3 日\n發文字號：桃都建照字第 1150037102 號\n速別：普通件'
        self.assertEqual(sm.cover_meta(page), {'docNo': '桃都建照字第1150037102號', 'docDate': '民國115年11月3日', 'issuer': '桃園市政府都市發展局'})

    def test_unreadable_cover_stays_empty(self):
        self.assertEqual(sm.cover_meta('發 文 曰 期 ： 中 華 民 國 l l 5 年\n字 號 ： 桃 都 建 照 字 第 l l 5 號'), {'docNo': '', 'docDate': '', 'issuer': ''})

    def test_sort_date_from_title(self):
        self.assertEqual(sm.roc_date('1060531-106年第2次'), (106, 5, 31))
        self.assertEqual(sm.roc_date('115年9月3日召開'), (115, 9, 3))
        self.assertIsNone(sm.roc_date('會議紀錄'))


class MergeTests(unittest.TestCase):
    def rows(self, *ids):
        return [{'id': i, 'name': f'{i} 會議紀錄.pdf', 'kind': 'pdf'} for i in ids] + [{'id': '790', 'name': 'x.rar', 'kind': 'other'}]

    def test_known_files_are_never_fetched_again(self):
        archive = {'items': [item('100', '1100101'), dict(MANUAL['items'][0], manual=True)]}
        fetched = []
        items, changes = sm.merge(archive, MANUAL, self.rows('101', '100'), lambda r: fetched.append(r['id']) or item(r['id'], '1110101'))
        self.assertEqual(fetched, ['101'])
        self.assertEqual([i['id'] for i in items], ['101', '100', '790'])
        self.assertEqual(changes['new'], ['101'])
        self.assertEqual(changes['skipped'][0]['id'], '790')

    def test_manual_items_always_kept_unchanged(self):
        items, _ = sm.merge({'items': [item('100', '1100101')]}, MANUAL, self.rows('100'), lambda r: None)
        manual = [i for i in items if i.get('manual')]
        self.assertEqual(len(manual), 1)
        self.assertEqual(manual[0]['pages'], MANUAL['items'][0]['pages'])

    def test_broken_new_file_waits_and_budget_defers(self):
        def fetch(r):
            if r['id'] == '102':
                raise ValueError('not a PDF')
            return dict(item(r['id'], '1120101'), pages=[{'n': 1, 'ocr': True, 'text': '甲'}])
        items, changes = sm.merge({'items': []}, MANUAL, self.rows('102', '103', '104'), fetch, max_ocr_pages=1, log=lambda *_: None)
        self.assertEqual(changes['new'], ['103'])
        self.assertEqual(changes['deferred'], ['102', '104'])

    def test_many_vanished_files_keep_everything(self):
        archive = {'items': [item(str(i), '1100101') for i in range(100, 110)]}
        with self.assertRaises(sm.ListingProblem):
            sm.merge(archive, MANUAL, self.rows('100'), lambda r: None)


class CheckTests(unittest.TestCase):
    def archive(self, items, rows):
        return sm.make_archive(items, rows, {'skipped': []}, '2026-11-23')

    def test_valid_archive_passes_and_changed_manual_fails(self):
        rows = [{'id': '100', 'name': 'a.pdf', 'kind': 'pdf'}, {'id': '790', 'name': 'b.rar', 'kind': 'other'}]
        manual = {'items': [sm.normalize(dict(MANUAL['items'][0]))]}
        manual['items'][0].pop('sha256')
        good = self.archive([item('100', '1100101'), dict(manual['items'][0], manual=True)], rows)
        self.assertEqual(cm.check(good, manual, rows), (2, 2))
        bad = json.loads(json.dumps(good))
        bad['items'][1]['pages'][0]['text'] = '改過'
        with self.assertRaises(AssertionError):
            cm.check(bad, manual, rows)

    def test_listed_pdf_missing_fails(self):
        rows = [{'id': '100', 'name': 'a.pdf', 'kind': 'pdf'}, {'id': '101', 'name': 'c.pdf', 'kind': 'pdf'}]
        with self.assertRaises(AssertionError):
            cm.check(self.archive([item('100', '1100101')], rows), {'items': []}, rows)


class CommittedArchiveTests(unittest.TestCase):
    def test_committed_archive_is_valid(self):
        archive = json.loads(sm.ARCHIVE.read_text(encoding='utf-8'))
        manual = json.loads(sm.MANUAL.read_text(encoding='utf-8'))
        cm.check(archive, manual)
        self.assertEqual(sorted(i['id'] for i in manual['items']), ['703', '703x', '703y', '710', '710a', '790'])


if __name__ == '__main__':
    unittest.main()
