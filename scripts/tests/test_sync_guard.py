"""Every reported source failure blocks publication; existing loss guards remain."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sync_guard', Path(__file__).resolve().parents[1] / 'sync-guard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class SyncGuardTests(unittest.TestCase):
    def report(self, **values):
        return {'status': 'complete', 'runId': 'current', 'missingCentral': [], 'localFailures': [], 'checks': [], **values}

    def test_clean_report_passes(self):
        self.assertEqual(guard.source_errors(self.report(), 'current'), [])

    def test_all_local_failure_reasons_block_even_when_old_content_was_retained(self):
        for reason in ('HTTP Error 503', 'timeout', 'TLS failure', 'Unknown host', '保留舊資料', '已核對前言與官方來源不符'):
            with self.subTest(reason=reason):
                errors = guard.source_errors(self.report(localFailures=[{'name': '法規', 'reason': reason}]))
                self.assertEqual(len(errors), 1)
                self.assertIn(reason, errors[0])

    def test_missing_central_blocks_even_without_article_loss(self):
        self.assertIn('缺少中央法規', guard.source_errors(self.report(missingCentral=['缺少法規']))[0])

    def test_all_additional_failure_lists_block(self):
        for field in guard.FAILURE_FIELDS:
            with self.subTest(field=field):
                self.assertTrue(guard.source_errors(self.report(**{field: [{'reason': 'failed'}]})))

    def test_singular_fatal_error_blocks_even_if_status_claims_complete(self):
        self.assertTrue(guard.source_errors(self.report(fatalError={'type': 'ValueError', 'reason': 'invalid XML'})))

    def test_malformed_or_absent_required_fields_block(self):
        for field in ('missingCentral', 'localFailures', 'checks'):
            report = self.report()
            del report[field]
            self.assertTrue(guard.source_errors(report))
            self.assertTrue(guard.source_errors(self.report(**{field: {}})))
        self.assertTrue(guard.source_errors([]))

    def test_incomplete_and_stale_reports_block(self):
        self.assertTrue(guard.source_errors(self.report(status='running')))
        self.assertTrue(guard.source_errors(self.report(runId='old'), 'current'))
        report = self.report()
        del report['status']
        self.assertTrue(guard.source_errors(report))

    def law(self, count=10, coverage='full'):
        return {'name': '法規', 'coverage': coverage,
                'articles': [{'no': str(i), 'text': '本文'} for i in range(count)]}

    def test_existing_baseline_guards_remain(self):
        before = {'law': self.law()}
        for after in ({}, {'law': self.law(10, 'link')}, {'law': self.law(7)}):
            self.assertTrue(guard.compare(before, after)[0])
        self.assertFalse(guard.compare(before, {'law': self.law(8)})[0])
        self.assertFalse(guard.compare(before, before)[0])

    def test_reviewed_inactive_exclusion_does_not_bypass_disappearance_guard(self):
        report = self.report(excludedInactive=[{'name': '法規', 'reason': '廢止'}])
        self.assertFalse(guard.source_errors(report))
        self.assertTrue(guard.compare({'law': self.law()}, {})[0])


if __name__ == '__main__':
    unittest.main()
