"""Fail closed on every source failure, missing document, or suspicious loss."""
import argparse
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILURE_FIELDS = ('localFailures', 'centralFailures', 'sourceFailures', 'fatalErrors', 'skippedSources')


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def compare(before, after):
    errors = []
    changes = []
    for law_id, old in before.items():
        new = after.get(law_id)
        if not new:
            errors.append(old['name'] + '：整部資料消失，須人工確認。')
            continue
        if old['coverage'] == 'full' and new['coverage'] != 'full':
            errors.append(old['name'] + '：全文降為連結。')
        if len(old['articles']) >= 5 and len(new['articles']) < len(old['articles']) * 0.8:
            errors.append(old['name'] + '：條文減少超過 20%。')
        old_text = {article['no']: article['text'] for article in old['articles']}
        new_text = {article['no']: article['text'] for article in new['articles']}
        changed = [no for no in dict.fromkeys([*old_text, *new_text]) if old_text.get(no) != new_text.get(no)]
        if changed:
            changes.append(old['name'] + '：' + '、'.join(changed))
    for law_id, new in after.items():
        if law_id not in before:
            changes.append('新增 ' + new['name'] + '（' + new['coverage'] + '）')
    return errors, changes


def source_errors(report, expected_run_id=None):
    errors = []
    if not isinstance(report, dict):
        return ['同步報告格式錯誤，阻擋此次 PR。']
    if expected_run_id and report.get('runId') != expected_run_id:
        errors.append('同步報告不屬於本次執行，阻擋此次 PR。')
    if report.get('status') != 'complete':
        errors.append('同步報告未完成，阻擋此次 PR。')
    for field in ('missingCentral', 'localFailures', 'checks'):
        if not isinstance(report.get(field), list):
            errors.append('同步報告缺少有效欄位 ' + field + '，阻擋此次 PR。')
    missing = report.get('missingCentral', [])
    if isinstance(missing, list):
        errors.extend(str(name) + '：缺少中央法規，阻擋此次 PR。' for name in missing)
    if 'fatalError' in report:
        errors.append('同步發生致命錯誤，阻擋此次 PR：' + str(report['fatalError']))
    for field in FAILURE_FIELDS:
        failures = report.get(field, [])
        if not isinstance(failures, list):
            errors.append('同步報告失敗欄位格式錯誤：' + field)
            continue
        for failure in failures:
            if isinstance(failure, dict):
                detail = str(failure.get('name') or failure.get('url') or field) + '：' + str(failure.get('reason', '來源失敗'))
            else:
                detail = str(failure)
            errors.append(detail + '；來源未成功重新取得，阻擋此次 PR。')
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('--after', type=Path, default=ROOT / 'public/data/laws.json')
    parser.add_argument('--report', type=Path, default=Path(os.environ.get('OPENLAW_SYNC_REPORT', ROOT / 'data/sync-report.json')))
    parser.add_argument('--review', type=Path, default=ROOT / 'sync-pr.md')
    args = parser.parse_args(argv)
    errors, changes = compare(read(args.before), read(args.after))
    try:
        report = read(args.report)
        errors.extend(source_errors(report, os.environ.get('OPENLAW_SYNC_RUN_ID')))
    except (OSError, ValueError) as error:
        report = {}
        errors.append('本次同步報告無法讀取：' + str(error))
    text = '本次同步只提出資料變更，合併前請核對官方原文。觀測日期不代表修法或生效日期。\n\n'
    text += '## 條文變動\n\n' + ('\n'.join('- ' + value for value in changes) or '- 未觀測到條文變動；可能僅更新來源與擷取資訊。')
    text += '\n\n## 未重新取得的來源／驗證\n\n'
    text += '\n'.join('- ' + error for error in errors) if errors else '- 所有申報來源皆已取得，未發現資料消失或大量條文減少；後續建置、全文與 PWA 驗證仍須全部通過。'
    args.review.write_text(text + '\n', encoding='utf-8')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Sync guard passed; ' + str(len(changes)) + ' changed/new laws; zero failed or missing sources.')


if __name__ == '__main__':
    main()
