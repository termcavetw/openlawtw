"""新北市建照業務工作手冊: cell cleaning, page labels, validation and the committed archive. PDF-free."""
import importlib.util, json, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_ntpc', SCRIPTS / 'sync-ntpc-manual.py')
sn = importlib.util.module_from_spec(spec); spec.loader.exec_module(sn)
cspec = importlib.util.spec_from_file_location('check_ntpc', SCRIPTS / 'check-ntpc-manual.py')
cn = importlib.util.module_from_spec(cspec); cspec.loader.exec_module(cn)


class NtpcManualTests(unittest.TestCase):
    def test_clean_joins_wrapped_lines_and_keeps_items(self):
        cell = '有關山坡地範圍涉及開發許可案件坡度坵塊檢討方式如下：\n1、 原始坡度分析以原開發許可核定之容許開\n發範圍為主。\n2、 日後單獨申請建築時，應以建照\n掛號日期為準。'
        self.assertEqual(sn.clean(cell), '有關山坡地範圍涉及開發許可案件坡度坵塊檢討方式如下：\n1、 原始坡度分析以原開發許可核定之容許開發範圍為主。\n2、 日後單獨申請建築時，應以建照掛號日期為準。')
        self.assertEqual(sn.clean('依建築技術規則 262\n條規定'), '依建築技術規則 262條規定')

    def test_page_label(self):
        self.assertEqual(sn.page_label('……內容\n\n 1-1 \n'), '1-1')
        self.assertEqual(sn.page_label('內容\n附 1-2'), '附 1-2')

    def test_validate_rejects_thin_or_duplicate_parses(self):
        case = lambda n: {'no': n, 'question': '問', 'rule': '答'}
        with self.assertRaises(sn.SourceProblem):
            sn.validate([case('01-01')] * 3)
        with self.assertRaises(sn.SourceProblem):
            sn.validate([case(f'{i // 20 + 1:02}-{i % 20 + 1:02}') for i in range(sn.MIN_CASES)] + [case('01-01')])

    def test_committed_archive(self):
        archive = json.loads(sn.ARCHIVE.read_text(encoding='utf-8'))
        self.assertGreaterEqual(cn.check(archive), sn.MIN_CASES)


if __name__ == '__main__':
    unittest.main()
