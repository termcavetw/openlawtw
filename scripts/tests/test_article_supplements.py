"""Source-backed mapping and offline integrity regression tests."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("article_supplements", ROOT / "scripts/import-article-supplements.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ArticleSupplementTests(unittest.TestCase):
    def setUp(self):
        self.attachments = json.loads((ROOT / "public/data/laws.json").read_text())["D0070115"]["attachments"]

    def test_exact_official_scope(self):
        mapped = MODULE.map_attachments(self.attachments)
        self.assertEqual(set(mapped), set(MODULE.ARTICLES))
        self.assertEqual(sum(map(len, mapped.values())), 43)
        self.assertNotIn("116-2", mapped)
        self.assertNotIn("167-6", mapped)
        self.assertEqual([x["format"] for x in mapped["1"]], ["PDF", "JPG"])

    def test_unknown_supplement_title_is_rejected(self):
        extra = {"title": "第 1-2 條補充圖例.PDF", "url": self.attachments[0]["url"]}
        with self.assertRaises(AssertionError):
            MODULE.map_attachments(self.attachments + [extra])

    def test_duplicate_canonical_is_rejected(self):
        with self.assertRaises(AssertionError):
            MODULE.map_attachments(self.attachments + [self.attachments[0]])

    def test_ambiguous_title_is_rejected(self):
        attachments = copy.deepcopy(self.attachments)
        attachments[0]["title"] = "第 1、2 條補充圖例.PDF"
        with self.assertRaises(AssertionError):
            MODULE.map_attachments(attachments)

    def test_offline_check_never_downloads(self):
        with patch.object(MODULE, "urlopen", side_effect=AssertionError("Network forbidden during check")):
            MODULE.check()

    def test_wrong_page_dimensions_are_rejected(self):
        original_read = MODULE.read
        def corrupt(path):
            value = original_read(path)
            if path == MODULE.DATA / "catalog.json":
                value["records"][0]["pages"][0]["width"] += 1
            return value
        with patch.object(MODULE, "read", side_effect=corrupt), self.assertRaises(AssertionError):
            MODULE.check()

    def test_removed_review_page_is_rejected(self):
        original_read = MODULE.read
        def corrupt(path):
            value = original_read(path)
            if path == MODULE.DATA / "visual-review.json":
                value["articles"]["1"]["reviewedPages"].pop()
            return value
        with patch.object(MODULE, "read", side_effect=corrupt), self.assertRaises(AssertionError):
            MODULE.check()

    def test_historical_caveats_do_not_infer_effective_dates(self):
        note = MODULE.version_note("144")
        self.assertIn("第117條", note)
        self.assertIn("兩頁實際圖說均為第 144 條", note)
        self.assertIn("未據此宣稱", note)
        self.assertIn("停止適用部分原圖例", MODULE.version_note("1"))
        self.assertIn("109 年 7 月 1 日", MODULE.version_note("39-1"))


if __name__ == "__main__":
    unittest.main()
