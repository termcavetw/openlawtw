"""內政部地政司 解釋函: header parsing, export parsing and the committed archive."""
import importlib.util, json, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('land', SCRIPTS / 'import-land-rulings.py')
il = importlib.util.module_from_spec(spec); spec.loader.exec_module(il)

PAGE = ("<div class='main3box'><div class='main_title'><a href='https://www.land.moi.gov.tw/law/historylaw?id=1&lid=2' title='x'>耕地分割執行要點 《第7點》</a></div>"
        "<div class='main_span'><table><tr><td colspan='2'> <STRONG class='icon_t'>最新法規條文</STRONG></td></tr><tr><td></td><td>依本條例第16條<br>第二行</td></tr></table></div>"
        "<div class='main_span'> <STRONG class='icon_t'>解釋函</STRONG></div><div class='main_span'><span>公布日期文號</span>內政部八十二年五月廿四日台(82)內地字第八二七五四四七號函</div>"
        "<div class='main_span'><span>要旨</span>毗鄰耕地分割合併</div><div class='main_span'><span>內容</span><br>說明一<br>說明二</div></div>"
        "<div class='main3box'><div class='main_title'><a href='u' title='x'>土地法 《第3.1條》</a></div>"
        "<div class='main_span'> <STRONG class='icon_t'>解釋函</STRONG></div><div class='main_span'><span>公布日期文號</span>內政部八十二年五月廿四日台(82)內地字第八二七五四四七號函</div>"
        "<div class='main_span'><span>要旨</span>毗鄰耕地分割合併</div><div class='main_span'><span>內容</span><br>說明一<br>說明二</div></div>")


class LandRulingTests(unittest.TestCase):
    def test_head_line(self):
        self.assertEqual(il.head_line('內政部88年12月2日台內中地字第8823288號函'), ('內政部', '1999-12-02', '台內中地字第8823288號函'))
        self.assertEqual(il.head_line('內政部七十六年十月二十一日台（七六）內地字第五四四二九三號函')[1], '1987-10-21')
        self.assertEqual(il.head_line('內政部中華民國 105 年 5 月 6 日台內地字第1051303449號令')[:2], ('內政部', '2016-05-06'))
        self.assertEqual(il.head_line('財政部99年8月24台財稅字第09900284670號函')[1], '2010-08-24')

    def test_parse_merges_a_letter_filed_twice(self):
        items, sections = il.parse(PAGE)
        self.assertEqual(len(sections), 2)
        self.assertEqual(sections[0]['text'], '依本條例第16條\n第二行')
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['date'], '1993-05-24')
        self.assertEqual(items[0]['refs'], [{'law': '耕地分割執行要點', 'article': '第 7 點'}, {'law': '土地法', 'article': '第 3-1 條'}])
        self.assertEqual(items[0]['body'], '說明一\n說明二')

    def test_committed_archive(self):
        cspec = importlib.util.spec_from_file_location('check_land', SCRIPTS / 'check-land-rulings.py')
        cl = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(cl)
        self.assertGreaterEqual(cl.check(json.loads(il.ARCHIVE.read_text(encoding='utf-8'))), il.MIN_ITEMS)


if __name__ == '__main__':
    unittest.main()
