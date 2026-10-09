"""Verify each accepted law and exact retention, preserving global loss guards."""
import argparse
import json
import os
from partial_sync import fingerprint, source_for, SUCCESS, RETAINED, validate_candidate
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


def source_errors(report, expected_run_id=None, allow_partial=False):
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
    if isinstance(missing, list) and not allow_partial:
        errors.extend(str(name) + '：缺少中央法規，阻擋此次 PR。' for name in missing)
    if 'fatalError' in report:
        errors.append('同步發生致命錯誤，阻擋此次 PR：' + str(report['fatalError']))
    for field in FAILURE_FIELDS:
        failures = report.get(field, [])
        if not isinstance(failures, list):
            errors.append('同步報告失敗欄位格式錯誤：' + field)
            continue
        if allow_partial and field in ('localFailures','centralFailures'):continue
        for failure in failures:
            if isinstance(failure, dict):
                detail = str(failure.get('name') or failure.get('url') or field) + '：' + str(failure.get('reason', '來源失敗'))
            else:
                detail = str(failure)
            errors.append(detail + '；來源未成功重新取得，阻擋此次 PR。')
    return errors


def partial_errors(before, after, report, before_sources, after_sources):
    errors = []
    rows = report.get('outcomes')
    if not isinstance(rows, list):return ['Missing per-law outcomes']
    ids = [row.get('id') for row in rows if isinstance(row, dict)]
    if len(ids)!=len(rows) or len(set(ids))!=len(ids):return ['Invalid or duplicate per-law outcomes']
    if not set(before)|set(after) <= set(ids):errors.append('Incomplete per-law outcome coverage')
    for row in rows:
        law_id = row['id'];old = before.get(law_id);new = after.get(law_id)
        status = row.get('status')
        if status not in SUCCESS|RETAINED|{'unavailable'}:
            errors.append(law_id + ': invalid outcome');continue
        if row.get('beforeHash')!=fingerprint(old) or row.get('candidateHash')!=(fingerprint(new) if new else None):
            errors.append(law_id + ': outcome does not match baseline/candidate')
        old_source = source_for(old,before_sources);new_source = source_for(new,after_sources)
        if row.get('beforeSourceHash')!=fingerprint(old_source) or row.get('source')!=new_source:
            errors.append(law_id + ': provenance outcome mismatch')
        if row.get('lastSuccessfulFetch')!=(new.get('retrieved','') if new else ''):
            errors.append(law_id + ': invented successful fetch date')
        if status in RETAINED:
            if old is None or old!=new or old_source!=new_source:
                errors.append(law_id + ': retained law or provenance changed')
        elif status=='unavailable':
            if old is not None or new is not None:errors.append(law_id + ': unavailable law is not absent')
        else:
            try:
                validate_candidate(old,new,new_source)
                if not row.get('attemptedAt'):raise ValueError('Missing attempt time')
            except (ValueError,KeyError,TypeError) as error:
                errors.append(law_id + ': ' + str(error))
    return errors


def review_lines(values, budget=18000):
    result=[];size=0
    for index,value in enumerate(values):
        line='- '+str(value).replace('\n',' ').replace('\r',' ')
        if len(line)>800:line=line[:800]+'…（完整內容見同步報告）'
        if size+len(line)>budget:
            result.append('- 其餘 '+str(len(values)-index)+' 筆見提交的 data/sync-report.json 與本次執行診斷附件。')
            break
        result.append(line);size+=len(line)+1
    return '\n'.join(result)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('before', type=Path)
    parser.add_argument('--after', type=Path, default=ROOT / 'public/data/laws.json')
    parser.add_argument('--report', type=Path, default=Path(os.environ.get('OPENLAW_SYNC_REPORT', ROOT / 'data/sync-report.json')))
    parser.add_argument('--review', type=Path, default=ROOT / 'sync-pr.md')
    parser.add_argument('--before-provenance', type=Path)
    parser.add_argument('--provenance', type=Path, default=ROOT/'data/provenance.json')
    args = parser.parse_args(argv)
    errors, changes = compare(read(args.before), read(args.after))
    try:
        report = read(args.report)
        partial=report.get('policy')=='per-law-v1'
        errors.extend(source_errors(report, os.environ.get('OPENLAW_SYNC_RUN_ID'), allow_partial=partial))
        if partial:
            if not args.before_provenance:errors.append('Partial sync requires baseline provenance')
            else:errors.extend(partial_errors(read(args.before),read(args.after),report,read(args.before_provenance)['sources'],read(args.provenance)['sources']))
    except (OSError, ValueError) as error:
        report = {}
        errors.append('本次同步報告無法讀取：' + str(error))
    text = '本次同步只提出資料變更，合併前請核對官方原文。觀測日期不代表修法或生效日期。\n\n'
    text += '## 條文變動\n\n' + (review_lines(changes) or '- 未觀測到條文變動；可能僅更新來源與擷取資訊。')
    if report.get('policy')=='per-law-v1':
        outcomes=report.get('outcomes',[])
        counts={status:sum(row['status']==status for row in outcomes) for status in SUCCESS|RETAINED|{'unavailable'}}
        text += '\n\n## 各法規獨立同步\n\n' + '、'.join(status+'：'+str(count) for status,count in sorted(counts.items()))
        failed=[str(row['name'])+'：'+row['status']+'；最後成功擷取：'+(row.get('lastSuccessfulFetch') or '未知／未有成功紀錄')+'；'+row.get('reason','來源未成功') for row in outcomes if row['status'] in ('retained','unavailable')]
        text += '\n\n'+(review_lines(failed) or '- 本次沒有逐筆失敗。')
        text += '\n\n完整逐筆成功、保留、未嘗試紀錄與來源雜湊，均見本次提交的 data/sync-report.json；失敗來源沒有宣稱更新成功。'
        text += '\n\n缺少的中央標題（未建立新紀錄）：'+('、'.join(report.get('missingCentral',[])) or '無')
    text += '\n\n## 未重新取得的來源／驗證\n\n'
    text += review_lines(errors,4000) if errors else '- 已接受候選及保留紀錄通過一致性檢查。失敗來源見上方逐筆報告；後續建置、全文與 PWA 驗證仍須全部通過。'
    args.review.write_text(text + '\n', encoding='utf-8')
    if errors:
        raise SystemExit('\n'.join(errors))
    print('Sync guard passed; ' + str(len(changes)) + ' changed/new laws; retained failures are disclosed separately.')


if __name__ == '__main__':
    main()
