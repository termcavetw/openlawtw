"""Run the official sync with fresh, bounded diagnostics and rollback on failure.

Only the dedicated run directory is an uploadable report. The committed historical
sync-report is never evidence for a new run. No environment dump or raw cache is
included. This module uses only the Python standard library so init can run before
package installation.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
DATA_PATHS = (
    'data/catalog.json', 'data/sync-report.json', 'data/provenance.json',
    'data/history.json', 'data/versions', 'public/data/laws.json',
    'public/data/catalog.json', 'public/data/rulings.json',
)
REQUIRED_STAGES = (
    'dependencies-node', 'dependencies-python', 'dependencies-system', 'unit-tests', 'baseline',
    'laws', 'rulings', 'guard', 'validate-laws', 'validate-rulings',
    'snapshot', 'build', 'typecheck', 'check',
)
MAX_LOG_BYTES = 1024 * 1024


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def redact(text, environ=None):
    """Artifact files do not receive GitHub's automatic console secret masking."""
    environ = os.environ if environ is None else environ
    secrets = [value for key, value in environ.items() if value and len(value) >= 4
               and re.search(r'TOKEN|PASSWORD|SECRET|CREDENTIAL|API_?KEY', key, re.I)]
    for value in sorted(secrets, key=len, reverse=True):
        text = text.replace(value, '[REDACTED]')
    text = re.sub(r'(?i)(authorization\s*[:=]\s*(?:bearer|basic)\s+)\S+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)([?&](?:token|access_token|api_key|key|sig|signature|password)=)[^&\s]+',
                  r'\1[REDACTED]', text)
    text = re.sub(r'(https?://)[^/@\s]+:[^/@\s]+@', r'\1[REDACTED]@', text)
    return text


class BoundedLog:
    """Keep the start on disk immediately, and the diagnostic tail on completion."""
    def __init__(self, path, limit=MAX_LOG_BYTES):
        self.path, self.limit = path, limit
        self.head_limit = limit // 2
        self.head = bytearray()
        self.tail = bytearray()
        self.size = 0
        self.file = path.open('wb')

    def append(self, text):
        data = redact(text).encode('utf-8', errors='replace')
        self.size += len(data)
        remaining = self.head_limit - len(self.head)
        if remaining > 0:
            part = data[:remaining]
            self.head.extend(part)
            self.file.write(part)
            self.file.flush()
            data = data[remaining:]
        self.tail.extend(data)
        del self.tail[:max(0, len(self.tail) - self.head_limit)]

    def close(self):
        marker = b'\n[log truncated; first and last sections retained]\n'
        content = self.head + (marker if self.size > self.limit - len(marker) else b'') + self.tail
        if len(content) > self.limit:
            content = self.head + marker + self.tail[-(self.limit - len(self.head) - len(marker)):]
        self.file.seek(0)
        self.file.write(content)
        self.file.truncate()
        self.file.close()


def stop_process_group(process):
    """Stop the whole stage session before restoring files, even if its leader exited.

    npm and shell steps can leave a child running after the immediate command has
    stopped. Always escalate against the original process group, not only the
    Popen leader, so an ignored SIGTERM cannot turn into a post-rollback write.
    """
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass
    finally:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.wait(timeout=10)


class SyncRun:
    def __init__(self, root=ROOT, run_dir=None):
        self.root = Path(root).resolve()
        self.run_dir = Path(run_dir or self.root / 'artifacts/sync-run').resolve()
        self.state_dir = self.run_dir.parent / (self.run_dir.name + '-state')
        self.report_path = self.run_dir / 'run-report.json'

    def save(self, report):
        write_json(self.report_path, report)

    def load(self):
        report = read_json(self.report_path)
        if report.get('root') != str(self.root):
            raise ValueError('Run belongs to a different checkout')
        return report

    def initialize(self):
        # A new invocation must not reuse old reports, logs, or candidate output.
        for path in (self.run_dir, self.state_dir):
            if path.exists():
                shutil.rmtree(path)
            path.mkdir(parents=True)
        (self.run_dir / 'logs').mkdir()
        report = {
            'schemaVersion': 1, 'runId': str(uuid.uuid4()), 'startedAt': now(),
            'status': 'initialized', 'root': str(self.root), 'verified': False,
            'commit': os.environ.get('GITHUB_SHA', ''), 'ref': os.environ.get('GITHUB_REF', ''),
            'event': os.environ.get('GITHUB_EVENT_NAME', ''),
            'githubRunId': os.environ.get('GITHUB_RUN_ID', ''),
            'githubRunAttempt': os.environ.get('GITHUB_RUN_ATTEMPT', ''),
            'stages': {name: {'status': 'not_started'} for name in REQUIRED_STAGES},
        }
        self.save(report)
        write_json(self.run_dir / 'laws-report.json', {
            'runId': report['runId'], 'status': 'not_started', 'startedAt': report['startedAt'],
            'missingCentral': [], 'localFailures': [], 'checks': [],
        })
        for name in REQUIRED_STAGES:
            (self.run_dir / 'logs' / (name + '.log')).write_text('', encoding='utf-8')
        manifest = []
        for relative in DATA_PATHS:
            path = self.root / relative
            if path.exists():
                destination = self.state_dir / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                if path.is_dir():
                    shutil.copytree(path, destination)
                else:
                    shutil.copy2(path, destination)
                manifest.append(relative)
        write_json(self.state_dir / 'manifest.json', manifest)
        # Canonical report is historical until this run produces a new one.
        (self.root / 'data/sync-report.json').unlink(missing_ok=True)
        (self.root / 'sync-pr.md').unlink(missing_ok=True)
        print('Initialized official sync run ' + report['runId'])
        return report

    def rollback(self, report):
        manifest = read_json(self.state_dir / 'manifest.json')
        for relative in DATA_PATHS:
            path = self.root / relative
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink(missing_ok=True)
            if relative in manifest:
                source = self.state_dir / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                if source.is_dir():
                    shutil.copytree(source, path)
                else:
                    shutil.copy2(source, path)
        report['canonicalDataRestored'] = True
        self.save(report)

    def run_step(self, name, command):
        if name not in REQUIRED_STAGES:
            raise ValueError('Unknown sync stage: ' + name)
        report = self.load()
        if report['status'] in ('failed', 'cancelled'):
            raise ValueError('A failed run cannot be resumed; initialize a fresh run')
        if report['stages'][name]['status'] != 'not_started':
            raise ValueError('Stage already attempted; initialize a fresh run for retries')
        step = {'status': 'running', 'startedAt': now(), 'log': 'logs/' + name + '.log'}
        report['status'] = 'running'
        report['stages'][name] = step
        self.save(report)
        log = BoundedLog(self.run_dir / step['log'])
        env = dict(os.environ, OPENLAW_SYNC_REPORT=str(self.run_dir / 'laws-report.json'),
                   OPENLAW_SYNC_RUN_ID=report['runId'], PYTHONUNBUFFERED='1')
        code = 1
        process = None
        try:
            process = subprocess.Popen(command, cwd=self.root, env=env, stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace',
                                       start_new_session=True)
            for line in process.stdout:
                log.append(line)
                # Prefix untrusted tool output so it cannot become an Actions command.
                visible = redact(line).rstrip('\r\n').replace('\r', r'\r')
                print('| ' + visible[:4000] + (' [console line truncated]' if len(visible) > 4000 else ''), flush=True)
            code = process.wait()
            if code == 0 and name == 'laws':
                self.require_source_report(report)
        except BaseException as error:
            log.append(type(error).__name__ + ': ' + str(error) + '\n')
            step['error'] = redact(type(error).__name__ + ': ' + str(error))
            code = 130 if isinstance(error, KeyboardInterrupt) else 1
        finally:
            if code and process is not None:
                stop_process_group(process)
            if process is not None and process.stdout is not None:
                process.stdout.close()
            log.close()
            step.update(status='succeeded' if code == 0 else 'failed', exitCode=code, finishedAt=now())
            if code:
                report['status'] = 'failed'
                report['failedStage'] = name
            self.save(report)
            if code:
                self.rollback(report)
        print(name + ': ' + step['status'] + ' (see ' + step['log'] + ')')
        return code

    def require_source_report(self, report):
        source = read_json(self.run_dir / 'laws-report.json')
        if source.get('runId') != report['runId'] or source.get('status') != 'complete':
            raise ValueError('Importer did not produce a complete report for this run')
        for field in ('missingCentral', 'localFailures', 'checks'):
            if not isinstance(source.get(field), list):
                raise ValueError('Missing or invalid source report field: ' + field)
        # Source failures are rejected by the guard, which also writes the review.
        canonical = self.root / 'data/sync-report.json'
        if not canonical.exists() or read_json(canonical) != source:
            raise ValueError('Canonical source report does not match the fresh run report')

    def verify(self):
        report = self.load()
        incomplete = [name for name in REQUIRED_STAGES if report['stages'][name]['status'] != 'succeeded']
        if incomplete:
            raise ValueError('Cannot mark incomplete run verified: ' + ', '.join(incomplete))
        self.require_source_report(report)
        # Diff all approved data paths, including newly created snapshot files.
        with (self.run_dir / 'verified-data.diff').open('wb') as output:
            for relative in DATA_PATHS:
                before, after = self.state_dir / relative, self.root / relative
                if not before.exists() and not after.exists():
                    continue
                empty = self.state_dir / 'empty-directory'
                empty.mkdir(exist_ok=True)
                before_arg = str(before) if before.exists() else str(empty) if after.is_dir() else '/dev/null'
                after_arg = str(after) if after.exists() else str(empty) if before.is_dir() else '/dev/null'
                result = subprocess.run(['git', 'diff', '--no-index', '--no-ext-diff', '--binary',
                                         before_arg, after_arg],
                                        stdout=output, stderr=subprocess.PIPE)
                if result.returncode not in (0, 1):
                    raise RuntimeError('Unable to preserve verified data diff')
        with tarfile.open(self.run_dir / 'verified-data.tar.gz', 'w:gz') as archive:
            for relative in DATA_PATHS:
                path = self.root / relative
                if path.exists():
                    archive.add(path, arcname=relative)
        review = self.root / 'sync-pr.md'
        if review.exists():
            shutil.copy2(review, self.run_dir / 'sync-pr.md')
        report.update(status='verified', verified=True, verifiedAt=now())
        report['verifiedArchiveSha256'] = hashlib.sha256((self.run_dir / 'verified-data.tar.gz').read_bytes()).hexdigest()
        self.save(report)
        print('All stages passed; verified data archive and diff saved for review.')

    def finalize(self, outcome):
        report = self.load()
        if outcome != 'success' or not report.get('verified'):
            report['status'] = 'cancelled' if outcome == 'cancelled' else 'failed'
            for stage in report['stages'].values():
                if stage['status'] in ('not_started', 'running'):
                    stage['status'] = 'not_completed'
                    stage['reason'] = 'Run ended before this stage completed; no success claimed.'
            self.rollback(report)
        report['finishedAt'] = now()
        self.save(report)
        review = self.root / 'sync-pr.md'
        if review.exists():
            (self.run_dir / 'sync-pr.md').write_text(redact(review.read_text(encoding='utf-8')), encoding='utf-8')
        print('Run finalized: ' + report['status'])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path)
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('init')
    step = sub.add_parser('step')
    step.add_argument('name', choices=REQUIRED_STAGES)
    step.add_argument('command', nargs=argparse.REMAINDER)
    sub.add_parser('verify')
    finish = sub.add_parser('finalize')
    finish.add_argument('--outcome', choices=('success', 'failure', 'cancelled'), required=True)
    args = parser.parse_args(argv)
    runner = SyncRun(run_dir=args.run_dir)
    if args.action == 'init':
        runner.initialize()
    elif args.action == 'step':
        command = args.command[1:] if args.command[:1] == ['--'] else args.command
        if not command:
            parser.error('step requires a command')
        return runner.run_step(args.name, command)
    elif args.action == 'verify':
        runner.verify()
    else:
        runner.finalize(args.outcome)
    return 0


if __name__ == '__main__':
    # SIGTERM still records the interrupted stage and restores canonical data.
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    raise SystemExit(main())
