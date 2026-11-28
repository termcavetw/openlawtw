"""地方法規歷次版本: article splitting of history pages, effective dates, and rebuilding from a stored file (offline)."""
import importlib.util, unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('local_versions', ROOT / 'scripts/sync-local-versions.py')
lv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lv)


def nos(arts):
    return [(n, sub) for n, sub, _ in arts]


class Split(unittest.TestCase):
    def test_headings_with_chapter_glued_and_gap(self):
        text = '\n'.join(['第　一　章　　總則', '第　一　條　　甲。', '第　四　條　　乙。',
                          '第　二　章　　程序第　五　條　　(刪除)', '第　七　條　　丙。'])
        arts = lv.split_articles(text)
        self.assertEqual(nos(arts), [(1, None), (4, None), (5, None), (7, None)])
        self.assertEqual(arts[2][2], '(刪除)')

    def test_wrapped_reference_does_not_split(self):
        text = '第 1 條　　本辦法依\n第三條規定訂定。\n第 2 條　　乙。'
        self.assertEqual(nos(lv.split_articles(text)), [(1, None), (2, None)])

    def test_points_with_indented_reference_line(self):
        text = '一、目的。\n二、依下列規定：\n　　第二十九條及第二十九條之一規定辦理。\n三、附則。'
        self.assertEqual(nos(lv.split_articles(text, target=3)), [(1, None), (2, None), (3, None)])

    def test_points_indented_with_tabs_and_bopomofo_one(self):
        text = 'ㄧ、甲。\n\t\t二、乙。\n\t\t三、丙。'
        self.assertEqual(len(lv.split_articles(text)), 3)

    def test_points_skip_a_number(self):
        text = '\n'.join(f'{c}、內容。' for c in ['一', '二', '三', '五', '六'])
        self.assertEqual([n for n, _, _ in lv.split_articles(text)], [1, 2, 3, 5, 6])

    def test_leading_single_space_headings(self):
        text = ' 第  一  條    甲。\n               一、細目\n 第  二  條    乙。'
        self.assertEqual(nos(lv.split_articles(text, target=2)), [(1, None), (2, None)])


class Effective(unittest.TestCase):
    def test_third_day_for_self_governing_rules(self):
        d, known, _ = lv.effective('臺中市建築管理自治條例', '本自治條例自公布日施行。', date(2020, 1, 1))
        self.assertEqual((d, known), (date(2020, 1, 3), True))

    def test_administrative_rule_unknown(self):
        self.assertEqual(lv.effective('某某作業要點', '一、目的。', date(2020, 1, 1))[:2], (None, False))

    def test_explicit_date_before_promulgation_belongs_to_an_earlier_version(self):
        text = '本細則自中華民國一百零二年七月一日施行。'
        self.assertEqual(lv.effective('都市計畫法高雄市施行細則', text, date(2013, 1, 14))[0], date(2013, 7, 1))
        self.assertEqual(lv.effective('都市計畫法高雄市施行細則', text, date(2014, 10, 23))[0], date(2014, 10, 25))


class Rebuild(unittest.TestCase):
    law = {'name': '某縣建築管理自治條例', 'articles': [{'no': '第 1 條', 'text': '甲二。'}, {'no': '第 2 條', 'text': '乙。'}]}

    def doc(self, law, versions):
        texts, out, timeline = lv.build('某縣-GL1', law, versions)
        return {'name': law['name'], 'texts': texts, 'versions': out, 'articles': timeline}

    def test_stored_versions_round_trip_and_amendment(self):
        old = {'date': date(2010, 1, 1), 'name': self.law['name'], 'text': '第 1 條　　甲。\n第 2 條　　乙。', 'url': 'h'}
        cur = {'date': date(2020, 1, 1), 'name': self.law['name'], 'text': '', 'url': 'c', 'current': True}
        doc = self.doc(self.law, [old, cur])
        again = self.doc(self.law, lv.stored_versions(doc)[:-1] + [cur])
        self.assertEqual(again['versions'], doc['versions'])
        self.assertEqual(again['articles'], doc['articles'])
        # The site is out of reach when the law is amended: the text that was current becomes an observed version.
        amended = {'name': self.law['name'], 'articles': [{'no': '第 1 條', 'text': '甲三。'}, {'no': '第 2 條', 'text': '乙。'}]}
        olds = lv.stored_versions(doc)
        olds[-1]['observed'] = True
        new = self.doc(amended, olds + [{'date': date(2024, 1, 1), 'name': amended['name'], 'text': '', 'url': 'c', 'current': True}])
        self.assertEqual([v['promulgated'] for v in new['versions']], ['2010-01-01', '2020-01-01', '2024-01-01'])
        self.assertTrue(new['versions'][1]['observed'])
        segs = new['articles']['第 1 條']
        self.assertEqual([new['texts'][s['text']] for s in segs], ['甲。', '甲二。', '甲三。'])
        self.assertEqual(segs[1]['to'], '2024-01-02')

    def test_amended_before_effective_is_left_out(self):
        law = {'name': '某縣施行細則', 'articles': [{'no': '第 1 條', 'text': '丙。本細則自中華民國一百零四年七月一日施行。'}]}
        a = {'date': date(2014, 2, 6), 'name': law['name'], 'text': '第 1 條　　甲。本細則自中華民國一百零四年七月一日施行。', 'url': 'a'}
        b = {'date': date(2015, 5, 7), 'name': law['name'], 'text': '第 1 條　　乙。本細則自中華民國一百零四年七月一日施行。', 'url': 'b'}
        cur = {'date': date(2020, 1, 1), 'name': law['name'], 'text': '', 'url': 'c', 'current': True}
        doc = self.doc(law, [a, b, cur])
        segs = doc['articles']['第 1 條']
        self.assertEqual([doc['texts'][s['text']][:1] for s in segs], ['乙', '丙'])
        self.assertEqual(segs[0]['from'], '2015-07-01')


if __name__ == '__main__':
    unittest.main()
