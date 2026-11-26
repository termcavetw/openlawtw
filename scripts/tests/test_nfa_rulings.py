"""內政部消防署 法令解釋／執法疑義: 相關法條 parsing and the committed archive (a fresh parse of the preserved export)."""
import importlib.util, json, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('nfa', SCRIPTS / 'import-nfa-rulings.py')
nfa = importlib.util.module_from_spec(spec); spec.loader.exec_module(nfa)


class NfaTests(unittest.TestCase):
    def test_refs(self):
        self.assertEqual(nfa.refs('消防法第6、9條(113/11/29)各級消防主管機關辦理消防安全檢查違法案件處理注意事項第4、6、7條(115/06/26)'), [
            {'law': '消防法', 'articles': ['第 6 條', '第 9 條'], 'version': '2024-11-29', 'historical': False},
            {'law': '各級消防主管機關辦理消防安全檢查違法案件處理注意事項', 'articles': ['第 4 條', '第 6 條', '第 7 條'], 'version': '2026-06-26', 'historical': False}])
        self.assertTrue(nfa.refs('(89/07/05)各類場所消防安全設備設置標準第12條(88/09/01)')[0]['historical'])
        self.assertEqual(nfa.refs('消防法第42-1條(113/11/29)')[0]['articles'], ['第 42-1 條'])

    def test_committed_archive_is_a_fresh_parse(self):
        archive = json.loads(nfa.ARCHIVE.read_text(encoding='utf-8'))
        self.assertEqual(archive, nfa.build(nfa.EXPORT.read_bytes()))
        self.assertGreaterEqual(archive['stats']['items'], nfa.MIN_ITEMS)
        ids = [it['id'] for it in archive['items']]
        self.assertEqual(len(ids), len(set(ids)))
        for it in archive['items']:
            self.assertTrue(it['date'] and it['docNo'] and it['issuer'], it['id'])
            self.assertFalse(it['docNo'].startswith('廢'), it['id'])
            self.assertNotIn('<', it['body'] + it['summary'])
        # The system has no text at all for a couple of old letters; keep them (number and date still cite).
        self.assertLessEqual(sum(not it['summary'] and not it['body'] and not it['abolished'] for it in archive['items']), 3)


if __name__ == '__main__':
    unittest.main()
