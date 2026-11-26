"""Import 內政部消防署 消防法令查詢系統「函釋（含執法疑義）及公告」 (法令解釋 + 執法疑義) from an export.

law.nfa.gov.tw does not answer this project's networks or hosted runners, and its detail pages
depend on the search session, so the export was collected in the user's own Chrome (search
everything, page through the result lists, read each letter from its list link) and is
preserved in data/sources/nfa-fint-export.json.gz. Each letter carries the system's own
「相關法條」: law name, article numbers and the law version (amendment date) they refer to.
Re-run with a newer export to update.
"""
from pathlib import Path
import argparse, gzip, hashlib, json, re, sys
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/nfa-rulings.json'
EXPORT = ROOT / 'data/sources/nfa-fint-export.json.gz'
SOURCE = '內政部消防署 消防法令查詢系統 函釋（含執法疑義）（law.nfa.gov.tw）'
SOURCE_URL = 'https://law.nfa.gov.tw/GNFA/FINT/index.aspx'
NOTE = ('內政部消防署「消防法令查詢系統」收錄的法令解釋與執法疑義（內政部、消防署及相關機關的函、令），含消防安全設備設置、檢修申報、'
        '公共危險物品、防火管理、消防安全檢查等。系統標示的「相關法條」是函釋當時的法規版本；之後的法規修正或較新的函釋可能改變見解，'
        '個案適用以主管機關認定為準。部分以令發布者系統只收要旨，全文請查行政院公報。')
# Search categories on the system (查詢類別); D01210 holds every 執法疑義.
CATEGORIES = {'D01200': '通用法令', 'D01201': '預防調查', 'D01202': '危險物品管理', 'D01203': '救災救護', 'D01204': '災害管理',
              'D01205': '整備應變', 'D01207': '訓練中心', 'D01209': '指揮中心', 'D01210': '執法疑義', 'D01211': '其他',
              'D01212': '綜合企劃', 'D01213': '資通中心', 'D01214': '秘書', 'D01215': '人事'}
FIELDS = ('id', 'kind', 'category', 'date', 'docNo', 'issuer', 'summary', 'body', 'refs', 'origin', 'abolished')
MIN_ITEMS = 1200
REF = re.compile(r'(?:\((\d{2,3})/(\d{1,2})/(\d{1,2})\))?([^()]+?)第([\d、\-]+)(條|點)\((\d{2,3})/(\d{1,2})/(\d{1,2})\)')


def roc(y, m, d):
    try:
        return date(int(y) + 1911, int(m), int(d)).isoformat()
    except ValueError:
        return ''


def refs(text):
    """「消防法第6、9條(113/11/29)各類場所…第12條(113/04/24)」 -> [{law, articles, version, historical}].
    A leading (date) marks a former version of the law, whose article numbers may no longer match."""
    out = []
    for m in REF.finditer(re.sub(r'\s+', '', text or '')):
        out.append({'law': m[4], 'articles': [f'第 {n} {m[6]}' for n in m[5].split('、') if n],
                    'version': roc(m[7], m[8], m[9]), 'historical': bool(m[1])})
    return out


def clean(text):
    return '\n'.join(line.rstrip() for line in (text or '').replace('\r', '').split('\n')).strip('\n')


def build(raw):
    data = json.loads(gzip.decompress(raw))
    items = []
    for x in data['items']:
        f = x['fields']
        code, word, number, ymd = x['eid'].split(',')
        m = re.fullmatch(r'(\d{2,3})/(\d{1,2})/(\d{1,2})', f.get('發文日期', '').strip())
        number = re.sub(r'\s+', '', f.get('發文文號', ''))
        items.append({'id': hashlib.sha256(x['eid'].encode()).hexdigest()[:12], 'kind': x['kind'], 'category': CATEGORIES.get(code, ''),
                      'date': roc(*m.groups()) if m else '', 'docNo': number.removeprefix('廢'), 'issuer': f.get('發文機關', '').strip(),
                      'summary': re.sub(r'\s*\n\s*', '', f.get('要旨', '')).strip(), 'body': clean(x.get('body', '')),
                      'refs': refs(f.get('相關法條', '')), 'origin': f.get('資料來源', '').strip(),
                      'abolished': number.startswith('廢')})  # the system marks letters it has withdrawn with 廢 before the number
    items.sort(key=lambda it: (it['date'], it['id']), reverse=True)
    if len(items) < MIN_ITEMS:
        raise SystemExit(f'only {len(items)} letters in the export')
    laws = {}
    for it in items:
        for r in it['refs']:
            laws[r['law']] = laws.get(r['law'], 0) + 1
    return {'source': SOURCE, 'sourceUrl': SOURCE_URL, 'note': NOTE, 'issuer': '內政部消防署',
            'export': {'file': EXPORT.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(raw).hexdigest(), 'collectedAt': data['fetchedAt']},
            'fetchedAt': data['fetchedAt'][:10],
            'stats': {'items': len(items), 'kinds': {k: sum(it['kind'] == k for it in items) for k in ('法令解釋', '執法疑義')},
                      'summaryOnly': sum(not it['body'] for it in items), 'abolished': sum(it['abolished'] for it in items),
                      'laws': [{'name': k, 'items': v} for k, v in sorted(laws.items(), key=lambda x: -x[1])]},
            'items': [{k: it[k] for k in FIELDS} for it in items]}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('export', nargs='?', help='a new export (.json.gz); default: re-parse the preserved one')
    a = p.parse_args(argv)
    if a.export:
        EXPORT.write_bytes(Path(a.export).read_bytes())
    archive = build(EXPORT.read_bytes())
    ARCHIVE.write_text(json.dumps(archive, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    s = archive['stats']
    print(f'{s["items"]} letters ({s["kinds"]}), {s["summaryOnly"]} summary-only, {len(s["laws"])} laws')


if __name__ == '__main__':
    sys.exit(main())
