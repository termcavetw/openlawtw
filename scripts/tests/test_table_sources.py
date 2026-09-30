"""Offline integrity checks for unmodified official table/formula evidence.

Fixtures are historical evidence, not a freeze on future lawful corpus updates.
Current corpus comparisons run only against the exact audited snapshot; fixture
hash, HTML extraction and text-pre preservation checks always run.
"""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlparse

from lxml import html

ROOT = Path(__file__).resolve().parents[2]
FIX = Path(__file__).parent / 'fixtures' / 'legal-tables'
EXPECTED = {'D0070114-3-3', 'D0070115-92', 'D0070115-261', 'D0070071-3',
            'D0060006-13', 'D0120013-8', 'O0030006-2'}


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def samples():
    return [(p, json.loads(p.read_text(encoding='utf-8')))
            for p in sorted(FIX.glob('*.source.json'))]


def article_body(raw):
    tree = html.fromstring(raw, parser=html.HTMLParser(encoding='utf-8'))
    nodes = tree.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," law-article ")]')
    if len(nodes) != 1:
        raise AssertionError('Expected exactly one official article body')
    return nodes[0]


class TableSourceTests(unittest.TestCase):
    def test_seven_official_sources_and_provenance(self):
        self.assertEqual({p.name.removesuffix('.source.json') for p, _ in samples()}, EXPECTED)
        for path, source in samples():
            with self.subTest(fixture=path.name):
                parsed = urlparse(source['url'])
                self.assertEqual(parsed.scheme, 'https')
                self.assertEqual(parsed.netloc, 'law.moj.gov.tw')
                self.assertEqual(parsed.path, '/LawClass/LawSingle.aspx')
                query = parse_qs(parsed.query)
                self.assertEqual(query['pcode'], [source['lawId']])
                self.assertEqual(source['articleNo'], '第 ' + query['flno'][0] + ' 條')
                self.assertIsNotNone(datetime.fromisoformat(source['retrievedAt']).tzinfo)
                self.assertEqual(sha256((FIX/source['file']).read_bytes()), source['sha256'])
                self.assertEqual(sha256((FIX/source['articleTextFile']).read_bytes()),
                                 source['articleTextSha256'])

    def test_exact_html_extraction_and_preserved_text_pre(self):
        for path, source in samples():
            with self.subTest(fixture=path.name):
                body = article_body((FIX/source['file']).read_bytes())
                text = (FIX/source['articleTextFile']).read_text(encoding='utf-8')
                self.assertEqual(text, '\n'.join(n.text_content() for n in body if n.tag == 'div'))
                blocks = body.xpath('.//div[contains(concat(" ",normalize-space(@class)," ")," text-pre ")]')
                self.assertEqual(len(blocks), source['textPreBlocks'])
                self.assertGreater(len(blocks), 0)
                for block in blocks:
                    self.assertIn(block.text_content(), text)  # Includes every space/newline.
                self.assertEqual(len(body.xpath('.//table')), source['nativeHtmlTables'])
                self.assertEqual(len(body.xpath('.//img')), source['inlineImages'])

    def test_audit_manifest_matches_fixture_metadata(self):
        audit = json.loads((ROOT/'data/table-source-audit.json').read_text(encoding='utf-8'))
        self.assertEqual(audit['officialSamples'], [source for _, source in samples()])

    def test_corpus_comparisons_for_original_audited_snapshot(self):
        audit = json.loads((ROOT/'data/table-source-audit.json').read_text(encoding='utf-8'))
        raw = (ROOT/'public/data/laws.json').read_bytes()
        if sha256(raw) != audit['corpusSha256']:
            self.skipTest('Corpus has advanced since this historical source audit; re-audit separately.')
        laws = json.loads(raw)
        for path, source in samples():
            with self.subTest(fixture=path.name):
                article = next(a for a in laws[source['lawId']]['articles'] if a['no'] == source['articleNo'])
                text = (FIX/source['articleTextFile']).read_text(encoding='utf-8')
                self.assertEqual(text == article['text'], source['matchesCorpusExactly'])
                strip_indent = lambda s: '\n'.join(line.lstrip() for line in s.splitlines())
                self.assertEqual(strip_indent(text) == strip_indent(article['text']),
                                 source['matchesCorpusIgnoringLineLeadingWhitespace'])
                body = article_body((FIX/source['file']).read_bytes())
                self.assertEqual(all(n.text_content() in article['text'] for n in body.xpath('.//div[@class="text-pre"]')),
                                 source['allTextPreBlocksVerbatimInCorpus'])


if __name__ == '__main__':
    unittest.main()
