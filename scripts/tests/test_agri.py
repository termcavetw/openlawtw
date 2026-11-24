"""農業部 farmland / farmhouse interpretations: parsing, merge and checker. Network-free."""
import importlib.util, sys, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_agri', SCRIPTS / 'sync-agri.py')
sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)
cspec = importlib.util.spec_from_file_location('check_agri', SCRIPTS / 'check-agri.py')
ca = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(ca)

LIST = '''<table><tr><th>序號</th></tr>
<tr><td>1</td><td><span>115/8/25</span></td><td><span>農保規字第1152611951號      </span></td>
<td><a href="NewsDetail.aspx?id=6123">有關貴府函詢&nbsp;造林案，復請查照。</a></td><td><span>解釋函</span></td></tr>
<tr><td>2</td><td><span>99/10/15</span></td><td><span>農水保字第0991875738號</span></td>
<td><a href="NewsDetail.aspx?id=900">集村農舍不得位於特定農業區</a></td><td><span>解釋令</span></td></tr>
</table> (共&nbsp;2&nbsp;筆資料)'''

DETAIL = '''<span id="ContentPlaceHolder1_ucNewsDetailOut1_lblExpClass">解釋函</span>
<span id="ContentPlaceHolder1_ucNewsDetailOut1_lblExpDate">115/8/25</span>
<span id="ContentPlaceHolder1_ucNewsDetailOut1_lblExpWord">農保規字第1152611951號</span>
<span id="ContentPlaceHolder1_ucNewsDetailOut1_lblExpDept">農業部農村發展及水土保持署</span>
<span id="ContentPlaceHolder1_ucNewsDetailOut1_lblExpTitle">有關貴府函詢造林案，復請查照。</span>
<span id="ContentPlaceHolder1_ucNewsDetailOut1_lblExpContent">主旨：復如說明。<br/>說明：<br/>一、依農業發展條例第3條&nbsp;規定。</span>'''


def rows():
    return sa.parse_list_page(LIST)[0]


def fetch(i):
    item = sa.parse_detail(DETAIL, i)
    if i == 900:
        item.update(cls='解釋令', date='2010-10-15', docNo='農水保字第0991875738號', issuer='行政院農業委員會')
    return item


class AgriTests(unittest.TestCase):
    def test_list_and_detail_parse(self):
        found, total = sa.parse_list_page(LIST)
        self.assertEqual(total, 2)
        self.assertEqual([(r['id'], r['docNo'], r['cls']) for r in found], [(6123, '農保規字第1152611951號', '解釋函'), (900, '農水保字第0991875738號', '解釋令')])
        item = sa.parse_detail(DETAIL, 6123)
        self.assertEqual((item['date'], item['issuer']), ('2026-08-25', '農業部農村發展及水土保持署'))
        self.assertEqual(item['body'], '主旨：復如說明。\n說明：\n一、依農業發展條例第3條 規定。')
        self.assertEqual(sa.roc_iso('99/2/30'), '')
        with self.assertRaises(ValueError):
            sa.parse_detail('<span id="x"></span>', 1)

    def test_merge_reads_only_new_letters_and_sets_laws(self):
        old = fetch(6123); old['laws'] = ['舊']
        seen = []
        items, changes = sa.merge({'items': [old]}, rows(), lambda i: seen.append(i) or fetch(i), {900: ['農業發展條例']}, refresh=0)
        self.assertEqual(seen, [900])
        self.assertEqual([i['id'] for i in items], [6123, 900])
        self.assertEqual((items[0]['laws'], items[1]['laws']), (['舊'], ['農業發展條例']))  # known letters keep their laws unless looked up again
        self.assertEqual((changes['new'], changes['removed']), ([900], []))

    def test_failed_letters_wait_and_mass_removal_keeps_archive(self):
        def broken(i):
            raise ValueError('down')
        items, changes = sa.merge({}, rows(), broken, {}, log=lambda *_: None)
        self.assertEqual((items, changes['failed']), ([], [6123, 900]))
        many = [dict(fetch(6123), id=i, url=sa.DETAIL + str(i)) for i in range(1, sa.MAX_REMOVED + 2)]
        with self.assertRaises(sa.ListingProblem):
            sa.merge({'items': many}, rows(), fetch, {})

    def test_checker(self):
        r = rows()
        items, changes = sa.merge({}, r, fetch, {900: ['農業發展條例']})
        archive = sa.make_archive(items, r, changes, '2026-11-24')
        self.assertEqual(ca.check(archive, r, {'900': ['農業發展條例']}), 2)
        archive['items'][0]['docNo'] = '錯字號'
        with self.assertRaises(AssertionError):
            ca.check(archive, r, {'900': ['農業發展條例']})


if __name__ == '__main__':
    unittest.main()
