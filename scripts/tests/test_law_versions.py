"""條文時點查詢: effective dates read from 沿革 and the per-article timeline (offline, synthetic and stored data)."""
import importlib.util, json, unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('law_versions', ROOT / 'scripts/sync-law-versions.py')
lv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lv)


def item(text):
    return lv.items_of('1.' + text)[0]


class EffectiveDates(unittest.TestCase):
    def test_promulgation_day_and_third_day(self):
        d, e, k = lv.effective_of(item('中華民國一百年一月五日總統華總一義字第 10000000000 號令修正公布第 3 條條文'))
        self.assertEqual((d, e, k), (date(2011, 1, 7), {}, True))
        d, e, k = lv.effective_of(item('中華民國一百年一月五日內政部令修正發布第 3 條條文；並自即日施行'))
        self.assertEqual(d, date(2011, 1, 5))

    def test_except_clause(self):
        d, e, k = lv.effective_of(item('中華民國九十八年五月二十七日總統令修正公布第 12 條條文；除第 12 條自九十八年十一月二十三日施行外，其餘自公布日施行'))
        self.assertEqual(d, date(2009, 5, 29))
        self.assertEqual(e, {'第 12 條': date(2009, 11, 23)})

    def test_unset_stays_unknown(self):
        d, e, k = lv.effective_of(item('中華民國九十六年五月三日內政部令增訂發布第 99-1 條條文；其施行日期另定之'))
        self.assertEqual((d, e, k), (None, {}, False))

    def test_later_notices(self):
        text = ('中華民國九十三年三月十日內政部令修正發布第 1、162 條條文；增訂第 298～301 條條文；施行日期另定之'
                '中華民國九十三年三月十日內政部令發布第 1、162 條、第 298 條第 1 款至第 3 款條文自九十四年一月一日施行'
                '中華民國九十七年七月十五日內政部令發布第 299、300 條條文，定自九十八年一月一日施行（第 301 條條文，施行日期另定）')
        d, e, k = lv.effective_of(item(text))
        self.assertIsNone(d)
        self.assertEqual(e['第 1 條'], date(2005, 1, 1))
        self.assertEqual(e['第 162 條'], date(2005, 1, 1))
        self.assertIsNone(e['第 298 條'])  # only some 款 took effect then
        self.assertEqual(e['第 299 條'], date(2009, 1, 1))
        self.assertIsNone(e['第 301 條'])

    def test_notice_date_written_with_roc_prefix(self):
        text = ('中華民國九十六年三月一日內政部令修正發布第 1、97 條條文；其中修正條文第 1 條自發布日施行；97 條條文，施行日期另定'
                '中華民國一百零三年六月十八日內政部令發布第 97 條條文，自中華民國一百零三年七月一日施行')
        d, e, k = lv.effective_of(item(text))
        self.assertEqual(e, {'第 1 條': date(2007, 3, 3), '第 97 條': date(2014, 7, 1)})


class Timeline(unittest.TestCase):
    def law(self, history, current):
        return {'history': history, 'modified': '2003-10-14', 'url': 'u',
                'articles': [{'no': '第 1 條', 'text': current}]}

    def test_superseded_before_taking_effect(self):
        history = ('1.中華民國九十年六月六日內政部令修正發布全文；並自九十年七月一日施行\n'
                   '2.中華民國九十二年八月十九日內政部令修正發布第 1 條條文；並自九十三年一月一日施行\n'
                   '3.中華民國九十二年十月十四日內政部令修正發布第 1 條條文；並自發布日施行')
        old = [{'promulgated': '2001-06-06', 'lser': '001', 'url': 'a', 'articles': [{'no': '第 1 條', 'text': 'A'}]},
               {'promulgated': '2003-08-19', 'lser': '001', 'url': 'b', 'articles': [{'no': '第 1 條', 'text': 'B'}]}]
        texts, versions, timeline = lv.build(self.law(history, 'C'), old)
        segs = timeline['第 1 條']
        self.assertEqual([(s['from'], s['to'], texts[s['text']]) for s in segs],
                         [('2001-07-01', '2003-10-15', 'A'), ('2003-10-16', None, 'C')])
        arts = lv.version_articles(versions)
        self.assertEqual([texts[a['第 1 條']] for a in arts], ['A', 'B', 'C'])

    def test_editorial_difference_does_not_split(self):
        history = ('1.中華民國九十年六月六日內政部令修正發布全文；並自九十年七月一日施行\n'
                   '2.中華民國九十二年十月十四日內政部令修正發布第 2 條條文；並自發布日施行')
        old = [{'promulgated': '2001-06-06', 'lser': '001', 'url': 'a',
                'articles': [{'no': '第 1 條', 'text': '本規則依建築法訂定之'}, {'no': '第 2 條', 'text': 'X'}]}]
        law = self.law(history, '本規則依建築法訂定之。')
        law['articles'].append({'no': '第 2 條', 'text': 'Y'})
        texts, versions, timeline = lv.build(law, old)
        self.assertEqual(len(timeline['第 1 條']), 1)
        self.assertEqual([(s['from'], s['to']) for s in timeline['第 2 條']],
                         [('2001-07-01', '2003-10-15'), ('2003-10-16', None)])


class StoredFiles(unittest.TestCase):
    def test_index_and_timelines_are_consistent(self):
        out = ROOT / 'public/data/law-versions'
        index = json.loads((out / 'index.json').read_text(encoding='utf-8'))
        self.assertGreater(len(index['laws']), 0)
        for code, entry in index['laws'].items():
            d = json.loads((out / f'{code}.json').read_text(encoding='utf-8'))
            self.assertEqual(len(d['versions']), entry['versions'], code)
            self.assertTrue(d['versions'][-1].get('current'), code)
            for v in d['versions']:
                if v['effectiveKnown']:
                    self.assertIsNotNone(v['effective'], code)
            for no, segs in d['articles'].items():
                for s in segs:
                    self.assertIn(s['text'], d['texts'], (code, no))
                    if not s['fromKnown']:
                        self.assertIsNone(s['from'], (code, no))
                    if s['from'] and s['to']:
                        self.assertLessEqual(s['from'], s['to'], (code, no))
                for a, b in zip(segs, segs[1:]):
                    if a['to'] and b['from']:
                        self.assertLess(a['to'], b['from'], (code, no))


if __name__ == '__main__':
    unittest.main()
