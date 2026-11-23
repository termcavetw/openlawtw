"""Ruling headers that are not the leading 「機關＋字號」: found only in the official text, never guessed."""
import importlib.util, sys, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('sync_rulings', SCRIPTS / 'sync-rulings.py')
sr = importlib.util.module_from_spec(spec); spec.loader.exec_module(sr)


class FallbackHeaderTests(unittest.TestCase):
    def found(self, text):
        return sr.fallback_header(text)

    def test_header_line_after_summary(self):
        text = '所報台北市政府辦理景美幹線工程……應否將加徵之滯納金退還\n\n內政部69.11.17.台內營字第七○一八八號函\n\n台北市景美幹線工程受益費……'
        self.assertEqual(self.found(text), ('內政部69.11.17.台內營字第七○一八八號函', False))

    def test_cited_letter_in_first_sentence_is_not_the_header(self):
        text = ('請參照本部八十六年九月十八日台(86)內營字第八六○七一三二號函示，由國宅業務單位查報。復請查照。\n\n'
                '內政部87.12.1.台(87)內營字第八七○九九○二號函')
        header, prefix = self.found(text)
        self.assertEqual(header, '內政部87.12.1.台(87)內營字第八七○九九○二號函')
        self.assertFalse(prefix)
        self.assertEqual(sr.issued_date(header), '1998-12-01')

    def test_meeting_record_transmittal_letter(self):
        text = '討論案：七十五年五月第二次營建業務協調會（內政部75.7.24台內營字第四二三六三五號函）\n\n案　由：……'
        self.assertEqual(self.found(text), ('內政部75.7.24台內營字第四二三六三五號函', False))

    def test_other_agencies_and_stray_x(self):
        self.assertEqual(self.found('衛生福利部函 103.05.13.衛部照字第1031560859號\n\n說明：……'),
                         ('衛生福利部函 103.05.13.衛部照字第1031560859號', True))
        self.assertEqual(self.found('嘉義縣政府94.8.8府交管字第0940007602號公告依據：行政程序法第15條……'),
                         ('嘉義縣政府94.8.8府交管字第0940007602號公告', True))
        self.assertEqual(self.found('x內政部營建署93.4.19都字第０９３２９０５９１７號函\n\n一、查本署……'),
                         ('內政部營建署93.4.19都字第０９３２９０５９１７號函', False))

    def test_header_at_end_of_title_line(self):
        text = '釘樁工程測設疑義內政部77.2.4台內營字第五六九四三八號函\n\n辦理變更暨擴大西螺主要計畫釘樁工程……'
        self.assertEqual(self.found(text), ('內政部77.2.4台內營字第五六九四三八號函', False))

    def test_quoted_letter_in_body_is_ignored(self):
        text = ('一、查內政部94年4月20台內營字第0940082726號函：「按本部……」\n\n'
                '二、……得視為無自有住宅。')
        self.assertEqual(self.found(text), ('', False))

    def test_text_without_any_header(self):
        self.assertEqual(self.found('一、時間：99年6月14日(星期一)上午9時30分\n二、地點：……'), ('', False))


class FallbackDateTests(unittest.TestCase):
    def test_formats_the_main_pattern_misses(self):
        self.assertEqual(sr.fallback_date('內政部96. 11 .21 內授營鎮字第0960807441號函'), '2007-11-21')
        self.assertEqual(sr.fallback_date('內政部98.1013內授營宅字第0980810292號函'), '2009-10-13')
        self.assertEqual(sr.fallback_date('行政院四十五年四月二十五日台四十五內第二一一三號令'), '1956-04-25')
        self.assertEqual(sr.fallback_date('本部七五、六、十九台內營字第四○四一四四號函'), '1986-06-19')
        self.assertEqual(sr.fallback_date('中華民國102年12月20日營署宅字第1020083499號'), '2013-12-20')

    def test_malformed_or_missing_dates_stay_empty(self):
        self.assertEqual(sr.fallback_date('內政部國土管理署1113.09.10.國署建管字第1130086879號函'), '')
        self.assertEqual(sr.fallback_date('內政部 台內營字第八三○五二八○號函'), '')


if __name__ == '__main__':
    unittest.main()
