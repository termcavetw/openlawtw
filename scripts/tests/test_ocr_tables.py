"""Table-model helpers in scripts/ocr_engine.py: HTML parsing, line mapping, overlap removal. Model-free."""
import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocr_engine as oe


class TableHelpers(unittest.TestCase):
    def test_parse_html_keeps_merged_cells(self):
        rows = oe.parse_table_html('<table><tr><td>土地使用 分區</td><td>建蔽率 (%)</td><td colspan="2">容積率</td></tr>'
                                   '<tr><td rowspan="2">第一種住宅區</td><td>50</td><td>120</td><td></td></tr><tr></tr></table>')
        self.assertEqual(rows, [[['土地使用分區'], ['建蔽率 (%)'], ['容積率', 2, 1]], [['第一種住宅區', 1, 2], ['50'], ['120'], ['']]])

    def test_lines_covered_finds_the_table_run(self):
        lines = ['桃園市都市計畫', '一、本要點依都市計畫法訂定。', '分區   建蔽率   容積率', '', '住宅區   50   120', '商業區   80   320', '三、其他規定依相關法令辦理。']
        self.assertEqual(oe.lines_covered(lines, '分區建蔽率容積率住宅區50120商業區80320'), (2, 6))

    def test_lines_covered_ignores_full_width_forms(self):
        lines = ['商業區種別  建蔽率  容積率', '中心商業區  70％  500％', '鄰里商業區  70％  280％', '註：其他依規定辦理。']
        self.assertEqual(oe.lines_covered(lines, oe._norm('商業區種別建蔽率容積率中心商業區70%500%鄰里商業區70%280%')), (0, 3))

    def test_numbers_must_match_the_text(self):
        lines = ['   項目種類建蔽率(%)    容積率(%)', '         住宅區                 60       200', '         商業區                 80       350',
                 '  使用分區乙種          70       210', '         工業區', '                 零星          70       210']
        moved = [[['項目'], ['種類'], ['建蔽率(%)'], ['容積率(%) 200']], [['使用分區'], ['住宅區'], ['60']], [['商業區'], ['80'], ['350 210']],
                 [['工業區'], ['乙種'], ['70']], [['零星'], ['70 60'], ['210 120']]]
        self.assertFalse(oe.numbers_match(moved, lines))  # 宗教專用區 60/120 pulled in from another row
        right = [[['種類'], ['建蔽率(%)'], ['容積率(%)']], [['住宅區'], ['60'], ['200']], [['商業區'], ['80'], ['350']], [['乙種工業區'], ['70'], ['210']], [['零星工業區'], ['70'], ['210']]]
        self.assertTrue(oe.numbers_match(right, lines))
        self.assertEqual(oe.numbers('面積達１，５００平方公尺、0.25公頃'), {'1500', '0.25'})

    def test_plausible_table_rejects_boxed_prose(self):
        grid = [[['分區'], ['建蔽率'], ['容積率']], [['住宅區'], ['50'], ['120']], [['商業區'], ['80'], ['320']]]
        self.assertTrue(oe.plausible_table(grid))
        prose = [[['（1）計劃區內之開放空間應集中留設並融合當地地景，兼顧購物及觀光休閒娛樂氣氛'], ['（2）公共開放空間不得做其他使用，並應開放供公眾使用。']],
                 [['（3）購物中心用地臨介壽路口位置應留設至少一六○○平方公尺以上之開放空間'], ['了創造優美視覺環境，掌控都市環境品質，賦予當地新風格新氣象']]]
        self.assertFalse(oe.plausible_table(prose))
        self.assertFalse(oe.plausible_table([[['分區'], ['建蔽率']]]))
        compare = [[['原要點內容'], ['增(修)訂要點內容'], ['變更理由']],
                   [['（一）實施範圍內建築基地'], ['產業專用區者，得申請增額'], ['1. 修正文字。']],
                   [['區、產業專用區者，得申請'], ['分區為住宅區、商業區、工'], ['2. 配合本府公告實施']]]
        self.assertFalse(oe.plausible_table(compare))

    def test_without_overlaps_keeps_the_larger(self):
        t = lambda a, b: {'from': a, 'to': b, 'rows': [[['x']], [['y']]]}
        self.assertEqual(oe.without_overlaps([t(5, 9), t(0, 3), t(2, 6), t(9, 12)]), [t(0, 3), t(5, 9), t(9, 12)])


if __name__ == '__main__':
    unittest.main()
