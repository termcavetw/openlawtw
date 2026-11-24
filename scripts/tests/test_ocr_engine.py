"""OCR post-processing: row grouping and simplified-to-traditional repair. No OCR engine needed."""
import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ocr_engine as oe


class OcrEngineTests(unittest.TestCase):
    def test_boxes_on_one_row_join_left_to_right(self):
        texts = ['200%', '第一', '60%', '一般住宅區']
        boxes = [[380, 560, 460, 590], [250, 562, 290, 592], [310, 558, 360, 588], [480, 561, 600, 591]]
        self.assertEqual(oe.rows(texts + ['第二'], boxes + [[250, 650, 290, 680]]), '第一 | 60% | 200% | 一般住宅區\n第二')

    def test_only_characters_outside_big5_are_converted(self):
        try:
            import opencc  # noqa: F401
        except ImportError:
            self.skipTest('opencc not installed')
        self.assertEqual(oe.to_traditional('檢讨後條文、核准、台灣、容积率、细部计畫'), '檢討後條文、核准、台灣、容積率、細部計畫')


if __name__ == '__main__':
    unittest.main()
