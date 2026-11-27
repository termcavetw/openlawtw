#!/usr/bin/env python3
"""經濟部主管法規查詢系統 (law.moea.gov.tw) administrative rules on factories, land-use change and building ->
data/moea-rules-laws.json, merged into public/data/laws.json and both catalogs (sync-laws.py keeps them on every sync).

law.moea.gov.tw answers browsers but not this project's servers, so the 34 rules were read in the user's Chrome
(LawContent.aspx and LawContentSource.aspx for each id) on 2026-11-27 and preserved as data/formal-sources/moea-rules.json.
Idempotent: re-running rebuilds the same records.
"""
import hashlib, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = 'data/formal-sources/moea-rules.json'
OUT = 'data/moea-rules-laws.json'
LETTERS = 'public/data/moea-interpretations.json'
STAMP = '2026-11-27T08:04:00+00:00'
NUMS = '一二三四五六七八九十'
CATEGORY = {
    **dict.fromkeys(['GL001050', 'GL001011', 'GL000980', 'FL025856', 'FL051581', 'GL000273', 'GL000276'], '目的事業與設立標準'),
    **dict.fromkeys(['FL079471', 'FL080663', 'FL077779', 'FL077780', 'FL011116', 'FL011136', 'FL060265', 'FL003211', 'FL042614',
                     'FL064608', 'GL000274', 'FL037803', 'FL069159', 'FL038794'], '都市計畫與土地'),
    **dict.fromkeys(['GL001318', 'GL001869', 'GL001039', 'GL000837', 'GL000812', 'FL022698', 'FL028877', 'GL000292', 'GL000293'], '環境與其他規範'),
    **dict.fromkeys(['GL001214', 'GL001226', 'GL001940', 'GL001941'], '建築與設計'),
}
KEYWORDS = {
    'GL001050': ['未登記工廠', '轉型遷廠', '關廠', '輔導期限', '非屬低污染'],
    'GL001011': ['臨時登記工廠', '臨登', '輔導期間屆滿'],
    'GL000980': ['未登記工廠', '停止供電', '停止供水', '斷水斷電'],
    'FL051581': ['觀光工廠', '其他工業設施', '容許使用'],
    'FL079471': ['擴廠', '都市計畫工業區毗鄰土地', '一點五倍', '五公頃'],
    'FL080663': ['產業相容性', '毗鄰工業用地', '工業區毗鄰'],
    'FL077779': ['丁種建築用地', '整體變更編定', '興辦事業計畫', '特定地區'],
    'FL077780': ['丁種建築用地', '個別變更編定', '興辦事業計畫', '特定地區'],
    'FL064608': ['產業園區用地變更', '產業用地'],
    'GL001318': ['農業設施', '透水保水', '滯洪設施', '農舍'],
    'GL000812': ['滯洪量', '透水保水', '滯洪設施'],
    'GL001214': ['特種建築物', '建築法第98條'],
    'GL001226': ['特種建築物'],
    'GL001940': ['受光條件不足', '太陽光電'],
    'GL001941': ['受光條件不足', '太陽光電'],
}
ITEM = re.compile(r'^(\(([一二三四五六七八九十]+|\d{1,2})\)|（[一二三四五六七八九十]+）|\d{1,2}\.|[一二三四五六七八九十]+、)')
POINT = re.compile(r'^([一二三四五六七八九十百]+)、')
CHAPTER = re.compile(r'^第[一二三四五六七八九十]+[章節]')


def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def write(path, value):
    compact = path in ('public/data/laws.json', 'data/catalog.json', 'public/data/catalog.json')
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) if compact else json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def cn(n):
    if n <= 10:
        return NUMS[n - 1]
    tens, ones = divmod(n, 10)
    return (NUMS[tens - 1] if tens > 1 else '') + '十' + (NUMS[ones - 1] if ones else '')


def cn2int(s):
    total, num = 0, 0
    for ch in s:
        if ch in NUMS[:9]:
            num = NUMS.index(ch) + 1
        elif ch == '十':
            total += (num or 1) * 10; num = 0
        elif ch == '百':
            total += (num or 1) * 100; num = 0
    return total + num


def iso(roc):
    m = re.search(r'(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日', roc or '')
    return f'{int(m.group(1)) + 1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}' if m else ''


def join(lines):
    """Fixed-width lines back into paragraphs: a new line only where an item (（一）、1.) starts."""
    out = []
    for raw in lines:
        s = raw.strip().replace('　', '')
        if not s:
            continue
        if out and not ITEM.match(s):
            out[-1] += s
        else:
            out.append(s)
    return '\n'.join(out)


def points(text):
    lines = [l.rstrip() for l in text.replace('　', ' ').split('\n') if l.strip()]
    if lines:
        lines[0] = lines[0].lstrip()
    articles, cur, path = [], None, []
    for line in lines:
        s = line.strip()
        if CHAPTER.match(s) and len(s) < 30:
            path = [re.sub(r'\s+', ' ', s)]
            continue
        m = POINT.match(line)  # a point starts at the left margin; its own items are indented
        if m:
            cur = {'no': f'第{cn(cn2int(m.group(1)))}點', 'lines': [s], 'path': list(path)}
            articles.append(cur)
        elif cur is not None:
            cur['lines'].append(s)
        else:
            cur = {'no': '全文', 'lines': [s], 'path': list(path)}
            articles.append(cur)
    if articles and articles[0]['no'] == '全文' and len(articles) > 1:
        # an interpretation whose lead sentence lists cases 「一、…二、…」: one text, not points
        return [{'no': '全文', 'text': join([l for a in articles for l in a['lines']]), 'path': []}]
    out = [{'no': a['no'], 'text': join(a['lines']), 'path': a['path']} for a in articles]
    if len(out) > 1:
        nums = [cn2int(a['no'][1:-1]) for a in out]
        assert nums == list(range(1, len(out) + 1)), nums
    return out


OUTFLOW = '出流管制計畫書與規劃書審核監督及免辦認定辦法'
LID = '建築物設置透水保水或滯洪設施適用範圍及容量標準'
# The articles each interpretation construes, as its title and text name them.
FILED = {
    'GL001869': [(OUTFLOW, 2)], 'GL001039': [(OUTFLOW, 18), (OUTFLOW, 21)], 'GL000837': [(OUTFLOW, 4), ('水利法', '83-10')],
    'GL001318': [(LID, '')], 'GL000812': [(LID, '')], 'GL000292': [('地質法', 3), ('地質法', 8)], 'GL000293': [('地質法', 11)],
    'GL000276': [('工廠管理輔導法', 21)], 'GL000273': [('工廠管理輔導法', 15)], 'GL000274': [('產業創新條例', 55)],
}


def cites(id_):
    return [{'law': law, 'article': f'第 {n} 條' if n else ''} for law, n in FILED[id_]]


def history(raw):
    lines = raw.split('\n')
    start = next((i for i, l in enumerate(lines) if re.match(r'^1\.', l)), None)
    if start is None:
        return []
    entries = []
    for l in lines[start:]:
        if re.match(r'^\d+\.', l):
            entries.append(re.sub(r'^\d+\.', '', l).strip())
        elif entries:
            entries[-1] += l.strip()
    return [re.sub(r'\s+', ' ', e).replace(' ', '') for e in entries]


def build():
    raw = ROOT / RAW
    data = json.loads(raw.read_text(encoding='utf-8'))
    sha = hashlib.sha256(raw.read_bytes()).hexdigest()
    assert len(data) == 34 and all(not x.get('error') for x in data)
    records, letters, sources = [], [], read('data/provenance.json')
    for x in data:
        h, id_ = x['head'], x['id']
        name = re.sub(r'英$', '', h['法規名稱']).strip()
        modified = iso(h.get('修正日期')) or iso(h.get('公發布日'))
        hist = history(x['history'])
        try:
            arts = points(x['text'])
        except AssertionError as e:
            raise AssertionError(id_ + ' ' + str(e))
        assert arts and all(a['text'] for a in arts), id_
        official = f'https://law.moea.gov.tw/LawContent.aspx?id={id_}'
        lid = '經濟部-' + id_
        if [a['no'] for a in arts] == ['全文']:
            # A 解釋令 (or a form) published as a one-paragraph 行政規則: it is a letter, not a rule with points.
            doc = re.sub(r'\s+', '', h.get('發文字號', '')).replace('令', '號令') if h.get('發文字號', '').strip().endswith('令') else re.sub(r'\s+', '', h.get('發文字號', ''))
            doc = re.sub(r'號號', '號', doc)
            issuer = {'經濟部水利署': '經濟部', '經濟部產業發展署': '經濟部', '經濟部產業園區管理局': '經濟部', '經濟部地質調查及礦業管理中心': '經濟部'}.get(h.get('法規體系', ''), '經濟部')
            letters.append({'id': 'R' + id_, 'date': modified, 'docNo': doc, 'issuer': issuer, 'summary': name, 'body': arts[0]['text'],
                            'filed': cites(id_), 'refs': [], 'url': official, 'topics': [],
                            'origin': f'經濟部主管法規查詢系統（{h.get("法規體系", "")}）'})
            continue
        body = h.get('法規體系', '').split('/')[-1]
        files = [{'title': f['title'], 'url': f'https://law.moea.gov.tw/Download.ashx?FileID={f["fileId"]}&id={id_}&type=LAW'} for f in x['files'] if f.get('fileId')]
        records.append(dict(
            id=lid, name=name, region='中央', category=CATEGORY[id_], kind='行政規則', url=official,
            source=f'經濟部（{body}）', coverage='full', modified=modified, effective=modified,
            effectiveNote=(hist[-1] if hist else f'發文字號：{h.get("發文字號", "")}'), snapshot='', retrieved=STAMP,
            status='全文取自經濟部主管法規查詢系統（以使用者瀏覽器擷取，本專案伺服器無法直接連線）',
            articles=arts, history='\n'.join(f'{i + 1}. {e}' for i, e in enumerate(hist)),
            attachments=[{'title': '經濟部主管法規查詢系統（官方）', 'url': official}] + files,
            keywords=KEYWORDS.get(id_, []),
            note=f'經濟部行政規則（{body}）。發文字號：{h.get("發文字號", "").strip()}。'))
        sources['sources'][lid] = {'url': official, 'sourcePage': f'https://law.moea.gov.tw/LawContentSource.aspx?id={id_}', 'format': 'html',
                                   'file': RAW, 'sha256': sha, 'hashScope': 'browser-extracted-json (all 34 rules)', 'observedAt': STAMP,
                                   'textMethod': 'LawContent.aspx 的內容區文字（textContent，<br> 轉換行）；點次以左緣「一、」切分，換行接回段落、保留款目換行；沿革取 LawContentSource.aspx。',
                                   'verification': '名稱、修正日期、發文字號取自同頁表頭；點次須從一連續編號。'}
    write(OUT, records)
    letters.sort(key=lambda x: x['date'], reverse=True)
    (ROOT / LETTERS).write_text(json.dumps({'source': '經濟部主管法規查詢系統（law.moea.gov.tw）', 'fetchedAt': STAMP[:10], 'items': letters},
                                           ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    write('data/provenance.json', sources)
    laws = read('public/data/laws.json')
    for r in records:
        laws[r['id']] = r
    write('public/data/laws.json', laws)
    ids = {r['id'] for r in records}
    for path in ('data/catalog.json', 'public/data/catalog.json'):
        catalog = read(path)
        catalog['laws'] = [l for l in catalog['laws'] if l['id'] not in ids] + [
            {**r, 'articleCount': len(r['articles']), 'articles': [{'no': a['no'], 'text': '', 'path': a['path']} for a in r['articles']], 'history': ''} for r in records]
        write(path, catalog)
    print('Imported', len(records), 'rules,', sum(len(r['articles']) for r in records), 'points;', len(letters), 'interpretations')


if __name__ == '__main__':
    build()
