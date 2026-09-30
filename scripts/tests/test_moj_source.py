"""Offline regression checks against captured, unmodified official HTML."""
from copy import deepcopy
from pathlib import Path
import hashlib
import sys
import unittest
from lxml import html
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from moj_source import parse_law_all, parse_law_history

FIX = Path(__file__).parent / 'fixtures' / 'moj'
STAMP = '2026-09-30T07:55:00+00:00'
NAME = '興辦工業人使用毗連非都市土地擴展計畫申請審查辦法'


class MojSourceTests(unittest.TestCase):
    def parse(self, code='J0030099', name=NAME, raw=None, **kwargs):
        return parse_law_all(raw or (FIX / (code + '.html')).read_bytes(), code, name,
                             retrieved=STAMP, **kwargs)

    def test_attachment_metadata_and_provenance(self):
        doc = self.parse()
        self.assertEqual(len(doc['articles']), 22)
        self.assertEqual(doc['modified'], '2024-04-09')
        self.assertEqual(doc['snapshot'], '2026-09-18')
        self.assertEqual(doc['effective'], '')
        self.assertEqual(doc['effectiveNote'], '')  # Never infer from final article.
        self.assertEqual(doc['history'], '')
        self.assertEqual(doc['attachments'], [{'title': '附表.PDF', 'url':
            'https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000365522&lan=C'}])
        self.assertEqual(doc['provenance']['sha256'], hashlib.sha256((FIX/'J0030099.html').read_bytes()).hexdigest())
        self.assertEqual(doc['provenance']['observedAt'], STAMP)
        self.assertNotIn('本條文有附件', doc['articles'][4]['no'])

    def test_every_original_line_and_paragraph(self):
        for code, name in [('J0030099', NAME), ('J0040051', '產業創新條例')]:
            raw = (FIX / (code + '.html')).read_bytes()
            doc = self.parse(code, name)
            tree = html.fromstring(raw)
            rows = tree.xpath('//*[@id="pnLawFla"]//div[@class="law-article"]')
            self.assertEqual(len(doc['articles']), len(rows))
            for article, row in zip(doc['articles'], rows):
                # Independent extraction: each source line must survive intact.
                lines = row.xpath('./div[starts-with(@class,"line-")]')
                self.assertEqual(article['text'], '\n'.join(x.text_content() for x in lines))
        self.assertEqual(len(self.parse()['articles'][4]['text'].splitlines()), 17)

    def test_chapters_inserted_articles_and_effective_notice(self):
        doc = self.parse('J0040051', '產業創新條例')
        self.assertEqual(len(doc['articles']), 87)
        by_no = {a['no']: a for a in doc['articles']}
        self.assertEqual(by_no['第 65 條']['path'], ['第 十一 章 擴廠之輔導'])
        self.assertEqual(by_no['第 10-2 條']['path'], ['第 三 章 創新活動之補助或輔導'])
        self.assertEqual(doc['effective'], '')
        self.assertEqual(doc['effectiveNote'], '※本法規部分或全部條文尚未生效，最後生效日期：未定\n一百十四年五月七日修正之第\xa022、67-3\xa0條施行日期，由行政院定之。')
        self.assertNotIn('連結舊法規內容', doc['effectiveNote'])

    def test_history_preserves_order_spacing_and_evidence(self):
        raw = (FIX/'J0030099-history.html').read_bytes()
        doc = self.parse(history_html=raw, history_retrieved='2026-09-30T07:56:00Z')
        self.assertTrue(doc['history'].startswith('5.中華民國'))
        self.assertIn('11355700200  號令修正\n  發布第 5  條', doc['history'])
        self.assertTrue(doc['history'].endswith('布全文 22 條；並自發布日施行'))
        self.assertNotIn('立法總說明', doc['history'])
        self.assertEqual(doc['provenance']['history']['sha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(doc['provenance']['history']['observedAt'], '2026-09-30T07:56:00Z')

    def test_wrong_law_identity_and_incomplete_structure_fail_closed(self):
        raw = (FIX/'J0030099.html').read_bytes()
        for code, name, data in [
            ('J0030098', NAME, raw), ('J0030099', '錯誤名稱', raw),
            ('J0030099', NAME, raw.replace(b'id="pnLawFla"', b'id="missing"')),
            ('J0030099', NAME, raw.replace(b'class="law-article"', b'class="missing"', 1)),
            ('J0030099', NAME, raw.replace('第 2 條'.encode(), '第 1 條'.encode(), 1)),
            ('J0030099', NAME, raw.replace(b'class="line-0000"', b'class="unknown"', 1)),
            ('J0030099', NAME, raw.replace('修正日期'.encode(), '廢止日期'.encode(), 1)),
        ]:
            with self.subTest(code=code, name=name, data_hash=hashlib.sha256(data).hexdigest()):
                with self.assertRaises(ValueError): self.parse(code, name, data)
        with self.assertRaises(ValueError): parse_law_history(raw, 'J0030099', NAME)
        with self.assertRaises(ValueError): self.parse(history_html=(FIX/'J0040051.html').read_bytes())

    def test_inline_text_breaks_and_nested_heading_path(self):
        tree = html.fromstring((FIX/'J0030099.html').read_bytes())
        container = tree.xpath('//*[@id="pnLawFla"]/div')[0]
        for node in list(container): container.remove(node)
        for markup in ['<div class="h3 char-1">第 一 編 總則</div>',
                       '<div class="h3 char-2">第 一 章 通則</div>',
                       '<div class="h3 char-3">第 一 節 範圍</div>']:
            container.append(html.fromstring(markup))
        row = html.fromstring('<div class="row"><div class="col-no"><a href="LawSingle.aspx?pcode=J0030099&amp;flno=1">第 1 條</a></div><div class="col-data"><div class="law-article"><div class="line-0000">原文 <a>連結</a>、數字  12<br>換行　保留</div><div class="line-0004">一、分款</div></div></div></div>')
        container.append(row)
        container.append(html.fromstring('<div class="h3 char-2">第 二 章 其他</div>'))
        row = deepcopy(row)
        row.xpath('.//a')[0].text = '第 2 條'
        container.append(row)
        doc = self.parse(raw=html.tostring(tree, encoding='utf-8'))
        self.assertEqual(doc['articles'][0]['text'], '原文 連結、數字  12\n換行　保留\n一、分款')
        self.assertEqual(doc['articles'][0]['path'], ['第 一 編 總則', '第 一 章 通則', '第 一 節 範圍'])
        self.assertEqual(doc['articles'][1]['path'], ['第 一 編 總則', '第 二 章 其他'])

    def test_retrieval_time_required_and_raw_bytes_only(self):
        raw = (FIX/'J0030099.html').read_bytes()
        with self.assertRaises(ValueError): parse_law_all(raw, 'J0030099', NAME, retrieved='2026-09-30')
        with self.assertRaises(TypeError): parse_law_all(raw.decode(), 'J0030099', NAME, retrieved=STAMP)


if __name__ == '__main__': unittest.main()
