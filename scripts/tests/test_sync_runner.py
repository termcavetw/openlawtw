"""Network-free run lifecycle, logging, rollback, and artifact regression tests."""
import importlib.util
from contextlib import redirect_stdout
import io
import json
import os
import shutil
import signal
import subprocess
from pathlib import Path
import sys
import tarfile
import tempfile
import time
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sync_runner', SCRIPTS / 'run-sync.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for path in ('data/sync-report.json', 'data/catalog.json', 'public/data/laws.json'):
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('{"old":true}', encoding='utf-8')
        self.run = runner.SyncRun(self.root)
        self.initial = self.run.initialize()

    def command(self, code):
        return [sys.executable, '-c', code]

    def test_initialization_precedes_fetch_and_replaces_old_evidence(self):
        self.assertFalse((self.root / 'data/sync-report.json').exists())
        source = runner.read_json(self.run.run_dir / 'laws-report.json')
        self.assertEqual(source['runId'], self.initial['runId'])
        self.assertEqual(source['status'], 'not_started')
        self.assertEqual(len(list((self.run.run_dir / 'logs').glob('*.log'))), len(runner.REQUIRED_STAGES))
        (self.run.run_dir / 'stale.log').write_text('old run', encoding='utf-8')
        second = self.run.initialize()
        self.assertNotEqual(second['runId'], self.initial['runId'])
        self.assertFalse((self.run.run_dir / 'stale.log').exists())

    def test_early_import_failure_records_log_and_restores_original_data(self):
        code = self.run.run_step('laws', self.command(
            'from pathlib import Path; Path("public/data/laws.json").write_text("changed"); '
            'raise RuntimeError("fetch failed before report completion")'))
        report = self.run.load()
        self.assertNotEqual(code, 0)
        self.assertEqual(report['failedStage'], 'laws')
        self.assertEqual(report['stages']['laws']['status'], 'failed')
        self.assertTrue(report['canonicalDataRestored'])
        self.assertIn('fetch failed before report completion', (self.run.run_dir / 'logs/laws.log').read_text())
        self.assertEqual((self.root / 'public/data/laws.json').read_text(), '{"old":true}')
        self.assertEqual((self.root / 'data/sync-report.json').read_text(), '{"old":true}')
        self.assertEqual(runner.read_json(self.run.run_dir / 'laws-report.json')['status'], 'not_started')

    def test_success_exit_cannot_reuse_absent_or_incomplete_source_report(self):
        self.assertNotEqual(self.run.run_step('laws', self.command('pass')), 0)
        self.assertIn('complete report for this run', (self.run.run_dir / 'logs/laws.log').read_text())

    def test_success_exit_cannot_reuse_another_run_report(self):
        source = {'status': 'complete', 'runId': 'old', 'missingCentral': [], 'localFailures': [], 'checks': []}
        runner.write_json(self.run.run_dir / 'laws-report.json', source)
        runner.write_json(self.root / 'data/sync-report.json', source)
        self.assertNotEqual(self.run.run_step('laws', self.command('pass')), 0)

    def complete_source(self):
        source = {'status': 'complete', 'runId': self.initial['runId'], 'missingCentral': [], 'localFailures': [], 'checks': []}
        runner.write_json(self.run.run_dir / 'laws-report.json', source)
        runner.write_json(self.root / 'data/sync-report.json', source)
        return source

    def test_complete_matching_report_is_accepted(self):
        self.complete_source()
        self.assertEqual(self.run.run_step('laws', self.command('print("law import done")')), 0)
        self.assertEqual(self.run.load()['stages']['laws']['status'], 'succeeded')

    def test_command_receives_current_run_identity(self):
        code = 'import os; print(os.environ["OPENLAW_SYNC_RUN_ID"]); print(os.environ["OPENLAW_SYNC_REPORT"])'
        self.assertEqual(self.run.run_step('unit-tests', self.command(code)), 0)
        log = (self.run.run_dir / 'logs/unit-tests.log').read_text()
        self.assertIn(self.initial['runId'], log)
        self.assertIn(str(self.run.run_dir / 'laws-report.json'), log)

    def test_spawn_failure_is_reported(self):
        self.assertNotEqual(self.run.run_step('laws', ['/this-command-does-not-exist']), 0)
        self.assertIn('FileNotFoundError', (self.run.run_dir / 'logs/laws.log').read_text())

    def test_failed_run_cannot_be_silently_resumed(self):
        self.run.run_step('unit-tests', self.command('raise SystemExit(1)'))
        with self.assertRaisesRegex(ValueError, 'fresh run'):
            self.run.run_step('rulings', self.command('pass'))

    def test_setup_failure_finalization_marks_unrun_sources_and_rolls_back(self):
        self.run.finalize('failure')
        report = self.run.load()
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['stages']['laws']['status'], 'not_completed')
        self.assertFalse(report['verified'])
        self.assertTrue(report['canonicalDataRestored'])

    def test_guard_failure_removes_new_snapshot_files(self):
        self.complete_source()
        new = self.root / 'data/versions/new-version.json'
        new.parent.mkdir(parents=True)
        new.write_text('new', encoding='utf-8')
        self.run.run_step('guard', self.command('raise SystemExit(1)'))
        self.assertFalse(new.exists())

    def test_verify_requires_every_original_gate(self):
        with self.assertRaisesRegex(ValueError, 'validate-laws.*validate-rulings.*build.*typecheck.*check'):
            self.run.verify()
        self.assertFalse((self.run.run_dir / 'verified-data.tar.gz').exists())

    def test_verified_artifact_contains_new_versions_and_no_cache_or_environment(self):
        self.complete_source()
        new = self.root / 'data/versions/new-version.json'
        new.parent.mkdir(parents=True)
        new.write_text('{"version":"new"}', encoding='utf-8')
        (self.root / '.env').write_text('SECRET=private', encoding='utf-8')
        report = self.run.load()
        for stage in report['stages'].values():
            stage['status'] = 'succeeded'
        self.run.save(report)
        self.run.verify()
        self.assertTrue(self.run.load()['verified'])
        with tarfile.open(self.run.run_dir / 'verified-data.tar.gz') as archive:
            names = archive.getnames()
        self.assertIn('data/versions/new-version.json', names)
        self.assertNotIn('.env', names)
        self.assertIn('new-version.json', (self.run.run_dir / 'verified-data.diff').read_text())
        self.run.finalize('success')
        self.assertEqual(self.run.load()['status'], 'verified')
        self.assertTrue(new.exists())

    def test_logs_are_bounded_keep_traceback_tail_and_redact_secrets(self):
        console = io.StringIO()
        with patch.dict(os.environ, {'EXAMPLE_API_TOKEN': 'example-private-token'}), redirect_stdout(console):
            code = 'print("x" * (2 * 1024 * 1024)); print("example-private-token"); raise RuntimeError("tail error")'
            self.run.run_step('unit-tests', self.command(code))
        data = (self.run.run_dir / 'logs/unit-tests.log').read_bytes()
        self.assertLessEqual(len(data), runner.MAX_LOG_BYTES)
        self.assertIn(b'log truncated', data)
        self.assertIn(b'tail error', data)
        self.assertNotIn(b'example-private-token', data)
        self.assertIn(b'[REDACTED]', data)
        self.assertNotIn('example-private-token', console.getvalue())
        self.assertIn('| [REDACTED]', console.getvalue())
        self.assertIn('console line truncated', console.getvalue())

    @unittest.skipUnless(os.name == 'posix', 'GitHub sync runner uses POSIX process groups')
    def test_cancellation_kills_delayed_descendants_before_rollback(self):
        script = self.root / 'scripts/run-sync.py'
        script.parent.mkdir()
        shutil.copy2(SCRIPTS / 'run-sync.py', script)
        for leader_exits_early in (False, True):
            with self.subTest(leader_exits_early=leader_exits_early):
                self.run.initialize()
                ready = self.root / 'descendant-ready.json'
                ready.unlink(missing_ok=True)
                child_code = (
                    'import json, os, signal, time; from pathlib import Path; '
                    'signal.signal(signal.SIGTERM, signal.SIG_IGN); '
                    'Path("descendant-ready.json").write_text(json.dumps({"group": os.getpgrp()})); '
                    'time.sleep(2); Path("public/data/laws.json").write_text("late descendant write")'
                )
                parent_code = (
                    'import subprocess, sys, time; '
                    'subprocess.Popen([sys.executable, "-c", ' + repr(child_code) + ']); '
                    + ('sys.exit(0)' if leader_exits_early else 'time.sleep(30)')
                )
                process = subprocess.Popen(
                    [sys.executable, str(script), 'step', 'laws', '--', sys.executable, '-c', parent_code],
                    cwd=self.root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                group = None
                try:
                    deadline = time.monotonic() + 5
                    while not ready.exists() and process.poll() is None and time.monotonic() < deadline:
                        time.sleep(0.01)
                    self.assertTrue(ready.exists(), 'Descendant never reached the write-ready point')
                    group = json.loads(ready.read_text())['group']
                    self.assertNotEqual(group, os.getpgrp(), 'Stage must have an isolated process group')
                    process.send_signal(signal.SIGTERM)
                    output, _ = process.communicate(timeout=8)
                    self.assertEqual(process.returncode, 130, output)
                    self.assertTrue(self.run.load()['canonicalDataRestored'])
                    self.assertEqual((self.root / 'public/data/laws.json').read_text(), '{"old":true}')
                    # Outlast the child's delayed write, including SIGTERM-ignoring
                    # descendants and a leader that exited before cancellation.
                    time.sleep(2.2)
                    self.assertEqual((self.root / 'public/data/laws.json').read_text(), '{"old":true}')
                finally:
                    if process.poll() is None:
                        process.kill()
                    process.communicate(timeout=5)
                    if group is not None and group != os.getpgrp():
                        try:
                            os.killpg(group, signal.SIGKILL)
                        except ProcessLookupError:
                            pass

    @unittest.skipUnless(os.name == 'posix', 'GitHub sync runner uses POSIX process groups')
    def test_nonzero_exit_stops_background_writer_before_rollback(self):
        child_code = (
            'import os, signal, time; from pathlib import Path; '
            'signal.signal(signal.SIGTERM, signal.SIG_IGN); '
            'Path("descendant-ready").write_text(str(os.getpgrp())); '
            'time.sleep(2); Path("public/data/laws.json").write_text("late failure write")'
        )
        parent_code = (
            'import subprocess, sys, time; from pathlib import Path\n'
            'subprocess.Popen([sys.executable, "-c", ' + repr(child_code) + '], '
            'stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)\n'
            'while not Path("descendant-ready").exists(): time.sleep(0.01)\n'
            'raise SystemExit(7)'
        )
        code = self.run.run_step('laws', self.command(parent_code))
        self.assertEqual(code, 7)
        self.assertTrue(self.run.load()['canonicalDataRestored'])
        time.sleep(2.2)
        self.assertEqual((self.root / 'public/data/laws.json').read_text(), '{"old":true}')

    def test_redacts_urls_and_authorization_headers(self):
        value = runner.redact('https://user:pass@example.org/?token=secret&x=1 Authorization: Bearer abcdef', {})
        self.assertNotIn('secret', value)
        self.assertNotIn('abcdef', value)
        self.assertNotIn('user:pass', value)


class WorkflowContractTests(unittest.TestCase):
    def test_no_temporary_push_trigger_and_default_branch_only_draft_pr(self):
        workflow = (SCRIPTS.parent / '.github/workflows/sync.yml').read_text()
        self.assertNotIn("fix/official-sync-recovery", workflow)
        self.assertNotIn("  push:", workflow)
        self.assertIn("cron: '23 20 * * 0'", workflow)
        self.assertIn("vars.ENABLE_LAW_SYNC == 'true'", workflow)
        pr_step = workflow.split('name: Propose verified data updates', 1)[1].split('- name:', 1)[0]
        self.assertIn('github.event.repository.default_branch', pr_step)
        self.assertIn("github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'", pr_step)
        self.assertIn('draft: true', pr_step)
        self.assertIn('timeout-minutes: 30', workflow)
        self.assertIn('sudo apt-get install -y poppler-utils', workflow)
        self.assertNotIn("github.event_name == 'push'", pr_step)

    def test_always_uploads_only_fresh_run_artifacts_with_bounded_retention(self):
        workflow = (SCRIPTS.parent / '.github/workflows/sync.yml').read_text()
        upload = workflow.split("name: Preserve this run's diagnostics", 1)[1]
        self.assertIn('if: always()', upload)
        self.assertIn('path: artifacts/sync-run/', upload)
        self.assertNotIn('data/sync-report.json', upload)
        self.assertIn('retention-days: 14', upload)
        self.assertLess(workflow.index('scripts/run-sync.py init'), workflow.index('actions/setup-node'))


if __name__ == '__main__':
    unittest.main()
