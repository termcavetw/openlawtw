"""Import the 新北市政府工務局「建照業務工作手冊」(yearly edition) as structured cases.

The manual is one PDF on the 工務局 site: about 170 cases in 14 chapters, each a
bordered table of 編號 / 依據 / 案例 / 處理原則 / 附註 rows (a table can run onto the
next page). pdfplumber reads the tables from the PDF's text layer; no OCR.

The PDF is fetched each run and parsed only when its checksum changes. A new edition
has a new address, so EDITIONS lists them newest first: the first one that answers is
used. If none answers, or the parse looks wrong, the archive is kept and the run still
succeeds. publicwork.ntpc.gov.tw answers hosted runners but not every network.
"""
from pathlib import Path
import argparse, hashlib, json, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/ntpc-manual.json'
FILES = 'https://www.publicwork.ntpc.gov.tw/userfiles/1060400/files/'
EDITIONS = [('114年版', FILES + urllib.parse.quote('114年工作手冊(全-不含封面)_merged.pdf'))]
SOURCE = '新北市政府工務局 建照業務工作手冊（publicwork.ntpc.gov.tw）'
NOTE = ('新北市政府工務局編撰、新北市建築師公會等協辦的建照業務工作手冊：彙整建築法規研討會、建照科簽辦的共通性案例與處理原則。'
        '只適用新北市的案子；屬縣市主管建築機關的執行原則，與條文或內政部（國土署）函釋不一致時以條文與中央函釋為準。'
        '各案例依據的會議或函文日期不同，之後的法規修正可能改變結論，引用前請讀附註並對照原手冊。')
AGENT = 'OpenLawTW/official-source-snapshot'
MIN_CASES = 120
LABELS = {'編號': 'no', '依據': 'basis', '案例': 'question', '項目': 'question', '處理原則': 'rule', '注意事項': 'rule', '附註': 'note'}
FIELDS = ('no', 'prev', 'chapter', 'basis', 'question', 'rule', 'note', 'page', 'pdfPage')


class SourceProblem(Exception):
    pass


def get(url, timeout=180, tries=3):
    last = None
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': AGENT})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception as error:
            last = error
            time.sleep(3 + attempt * 5)
    raise SourceProblem(f'{url}: {last}')


def clean(value, dates=False):
    """Join a cell's wrapped lines: CJK text wraps without spaces; keep list items (一、 (一) 1.) on new lines."""
    lines = [l.strip() for l in (value or '').replace('\r', '').split('\n') if l.strip()]
    out = ''
    for line in lines:
        starts_item = re.match(r'^([一二三四五六七八九十]+、|[（(][一二三四五六七八九十\d]+[）)]|\d+[.、．]\s*\D)', line)
        if out and (starts_item or dates and re.match(r'^(\d{2,3}\s*[.年]\s*\d|本府|本局|內政部|新北市|臺北縣|財政部|經濟部|行政院|城鄉)', line) and re.search(r'[紀錄函號見示]$', out)):
            out += '\n' + line
        elif out and re.search(r'[A-Za-z0-9]$', out) and re.match(r'^[A-Za-z0-9]', line):
            out += ' ' + line
        else:
            out += line
    return re.sub(r'[ \t　]{2,}', ' ', out).strip()


def page_label(text):
    """The printed page number at the foot of a page: 「1-1」「附 1-2」."""
    tail = [l.strip() for l in (text or '').strip().split('\n')[-3:]]
    for line in reversed(tail):
        if re.fullmatch(r'(附\s*)?\d+-\d+', line):
            return re.sub(r'\s+', ' ', line)
    return ''


def parse(pdf_path):
    import pdfplumber
    cases, chapter, current, field = [], '', None, None
    with pdfplumber.open(str(pdf_path)) as pdf:
        for index, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ''
            m = re.search(r'第[一二三四五六七八九十]+章\s*(\S+?類)', text)
            label = page_label(text)
            heading = re.search(r'工作手冊-114 年版（(.+?)）', text)
            for table in page.find_tables():
                for row in table.extract():
                    if not row or len(row) < 2:
                        continue
                    key = re.sub(r'\s+', '', row[0] or '')
                    value = clean('\n'.join(c for c in row[1:] if c))
                    if key == '編號':
                        if m and (not chapter or m.group(1) != chapter):
                            chapter = m.group(1)
                        no = re.match(r'(\d{2}-\d{2})\s*[（(]\s*(\d+)\s*年版編號\s*([\w-]+?)\s*[）)]', value) or re.match(r'(\d{2}-\d{2})', value) or re.match(r'(\S+)', value)
                        current = {'no': no.group(1), 'prev': no.group(3) if no.lastindex and no.lastindex >= 3 else '',
                                   'chapter': chapter or (heading.group(1) if heading else ''), 'basis': '', 'question': '',
                                   'rule': '', 'note': '', 'page': label, 'pdfPage': index}
                        cases.append(current)
                        field = None
                    elif key in LABELS and current is not None:
                        field = LABELS[key]
                        if field == 'basis':
                            value = clean('\n'.join(c for c in row[1:] if c), dates=True)
                        current[field] = (current[field] + '\n' + value).strip() if current[field] else value
                    elif not key and current is not None and field and value:
                        current[field] = (current[field] + '\n' + value).strip()
    return cases


def validate(cases):
    nos = [c['no'] for c in cases]
    if len(cases) < MIN_CASES:
        raise SourceProblem(f'only {len(cases)} cases parsed')
    if len(set(nos)) != len(nos):
        raise SourceProblem('duplicate case numbers: ' + ', '.join(sorted({n for n in nos if nos.count(n) > 1})[:5]))
    empty = [c['no'] for c in cases if not c['question'] or not c['rule']]
    if len(empty) > len(cases) // 20:
        raise SourceProblem(f'{len(empty)} cases lack a question or rule: {empty[:5]}')
    return cases


def make_archive(edition, url, digest, cases, fetched_at):
    chapters = []
    for c in cases:
        if c['chapter'] and c['chapter'] not in chapters:
            chapters.append(c['chapter'])
    return {'source': SOURCE, 'sourceUrl': url, 'note': NOTE, 'region': '新北市', 'edition': edition, 'sha256': digest,
            'fetchedAt': fetched_at, 'stats': {'cases': len(cases), 'chapters': [{'name': n, 'cases': sum(c['chapter'] == n for c in cases)} for n in chapters]},
            'cases': [{k: c[k] for k in FIELDS} for c in cases]}


def append_review(text_):
    review = ROOT / 'sync-pr.md'
    if review.exists():
        review.write_text(review.read_text(encoding='utf-8').rstrip() + '\n\n## 新北市建照業務工作手冊\n\n' + text_ + '\n', encoding='utf-8')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache', default='.ntpc-cache', type=Path)
    p.add_argument('--pdf', type=Path, help='parse this saved copy of the current edition instead of downloading it')
    a = p.parse_args(argv)
    a.cache.mkdir(parents=True, exist_ok=True)
    archive = json.loads(ARCHIVE.read_text(encoding='utf-8')) if ARCHIVE.exists() else {}
    try:
        if a.pdf:
            edition, url = EDITIONS[0]
            raw = a.pdf.read_bytes()
        else:
            raw = None
            for edition, url in EDITIONS:
                try:
                    raw = get(url)
                    break
                except SourceProblem:
                    continue
            if raw is None or not raw.startswith(b'%PDF'):
                raise SourceProblem('no edition of the manual could be downloaded')
        digest = hashlib.sha256(raw).hexdigest()
        (a.cache / 'manual.json').write_text(json.dumps({'edition': edition, 'url': url, 'sha256': digest}), encoding='utf-8')
        if archive.get('sha256') == digest and archive.get('edition') == edition:
            message = f'- {edition}，原檔未變動（{archive["stats"]["cases"]} 個案例）。'
            print('新北市建照業務工作手冊' + message)
            append_review(message)
            return 0
        pdf = a.cache / 'manual.pdf'
        pdf.write_bytes(raw)
        cases = validate(parse(pdf))
    except SourceProblem as error:
        (a.cache / 'manual.json').unlink(missing_ok=True)
        message = f'- 無法取得或解析手冊，保留上次資料（{error}）。'
        print('新北市建照業務工作手冊' + message)
        append_review(message)
        return 0
    today = datetime.now(timezone.utc).date().isoformat()
    new = make_archive(edition, url, digest, cases, today)
    ARCHIVE.write_text(json.dumps(new, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    before = {c['no'] for c in archive.get('cases', [])}
    added = [c['no'] for c in cases if c['no'] not in before]
    lines = [f'- {edition}，{len(cases)} 個案例、{len(new["stats"]["chapters"])} 章。']
    if archive and archive.get('edition') != edition:
        lines.append(f'- 改版：{archive.get("edition")} → {edition}')
    if archive and added:
        lines.append('- 新增案例：' + '、'.join(added[:60]))
    print('\n'.join(lines))
    append_review('\n'.join(lines))
    return 0


if __name__ == '__main__':
    sys.exit(main())
