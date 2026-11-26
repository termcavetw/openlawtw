#!/usr/bin/env python3
"""經濟部中部辦公室《工廠管理輔導法暨相關函釋彙編》102.07, 106.10 and 112.05 editions -> public/data/moea-factory-rulings.json.

The compilations were supplied as PDFs (the 中部辦公室 site is behind Cloudflare); their text layers are preserved as
data/sources/moea-factory-{102,106,112}.txt.gz (pdftotext -layout). The same letter appears in several editions: it is
kept once, keyed by its document number, with the newest edition's text and every edition's filing.

Filing:
  106 edition: the compiler files each letter under the article it follows (工廠管理輔導法, 施行細則 「細則第 N 條」,
               非都市土地使用管制規則, 申請農業用地作農業設施容許使用審查辦法) -> filed[] with cited=False.
  112 edition: by topic (工廠登記、產品分類、納管特登、用地變更).
  all:         「<law>第 N 條」 named in the text -> filed[] with cited=True (prepare-data links those only when the letter
               is not older than the law's last full-text revision).
"""
import gzip, hashlib, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data/sources'
OUT = ROOT / 'public/data/moea-factory-rulings.json'
EDITIONS = {
    '112': {'label': '112 年 5 月', 'pdfSha256': 'c3cb188558622fa8a8b5579144c14a85d1101ed05d2a16e7503036874482031f', 'pages': 130},
    '106': {'label': '106 年 10 月', 'pdfSha256': '3d70d5c98834abc05c6b12cf9be93781190db7d2d2e7e1b804fcac433cbd0dda', 'pages': 352},
    '102': {'label': '102 年 7 月', 'pdfSha256': 'd9b3ed5b3fcc62109ab6c8af62c4ba05cb5501eb1ce58344684e1843e162fc8c', 'pages': 161},
}
FACTORY = '工廠管理輔導法'
RULES = '工廠管理輔導法施行細則'
NONURBAN = '非都市土地使用管制規則'
AGRIFAC = '申請農業用地作農業設施容許使用審查辦法'
CITED_LAWS = [RULES, FACTORY, NONURBAN, AGRIFAC, '特定工廠登記辦法', '特定工廠申請變更編定為特定目的事業用地審查辦法',
              '工廠從事物品製造加工範圍及面積電力容量熱能規模認定標準', '未登記工廠補辦臨時工廠登記辦法', '產業創新條例',
              '都市計畫法臺灣省施行細則', '農業發展條例', '建築法', '消防法']
ALIASES = {'工輔法': FACTORY, '工管法': FACTORY}
CN = {c: i for i, c in enumerate('零一二三四五六七八九')} | {'〇': 0}


def cn2int(s):
    s = s.replace(' ', '')
    if s.isdigit():
        return int(s)
    total, num = 0, 0
    for ch in s:
        if ch in CN:
            num = CN[ch]
        elif ch == '十':
            total += (num or 1) * 10; num = 0
        elif ch == '百':
            total += (num or 1) * 100; num = 0
        else:
            raise ValueError(s)
    return total + num


def roc_digits(s):
    """九十三 -> 93 ; also plain digit runs like 〇九三."""
    s = s.strip()
    if s.isdigit():
        return int(s)
    if '十' in s or '百' in s:
        return cn2int(s)
    return int(''.join(str(CN[c]) for c in s))


DATE = re.compile(r'(\d{2,3}|[〇零一二三四五六七八九十百]{1,5})\s*年\s*(\d{1,2}|[〇零一二三四五六七八九十]{1,3})\s*月\s*(\d{1,2}|[〇零一二三四五六七八九十]{1,3})\s*日?')


def iso(m):
    try:
        y, mo, d = (roc_digits(x) for x in m.groups())
        return f'{y + 1911:04d}-{mo:02d}-{d:02d}' if 1 <= mo <= 12 and 1 <= d <= 31 and 30 <= y <= 130 else ''
    except (ValueError, KeyError):
        return ''


def number_key(doc):
    t = unicodedata.normalize('NFKC', doc).replace(' ', '')
    m = re.search(r'第([0-9A-Za-z]{5,13})號', t) or re.search(r'字第?([0-9A-Za-z]{5,13})', t)
    return m.group(1) if m else ''


NOISE = re.compile(r'^\s*(\d{1,3}|[IVXL]+|\d{8}/[A-Z]/[\w-]+/\w+|函釋彙整)\s*$')


def clean(lines):
    out = []
    for l in lines:
        l = l.replace('\f', '').rstrip()
        if NOISE.match(l):
            continue
        out.append(l.strip())
    text = '\n'.join(out)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return re.sub(r'[ 　]{3,}', ' ', text)


def summary_of(body):
    flat = body.replace('\n', '')
    m = re.search(r'主\s*旨\s*[:：]\s*(.+?)(?:說\s*明\s*[:：]|$)', flat)
    s = (m.group(1) if m else flat).strip()
    s = re.sub(r'\s+', ' ', s)
    return s[:300]


def header_of(line, nxt):
    """Returns (inner, tail, consumed_lines) for a 【…】 header line."""
    s = line.replace('\f', '').strip()
    if not s.startswith('【'):
        return None
    used = 1
    while '】' not in s and used <= 2 and nxt[used - 1:used]:
        s += nxt[used - 1].strip(); used += 1
    if '】' not in s:
        return None
    inner, tail = s[1:].split('】', 1)
    return inner, tail.strip(), used


ART = re.compile(r'^第\s*([一二三四五六七八九十百](?:\s*[一二三四五六七八九十百])*)\s*條(?:\s*之\s*([一二三四五六七八九十]+))?\s')
RULE_ART = re.compile(r'^細則第\s*(\d+)(?:\s*-\s*(\d+))?\s*條')


def art_label(n, sub=None):
    return f'第 {n}{"-" + str(sub) if sub else ""} 條'


def parse_header(inner, tail):
    m = DATE.search(inner)
    if not m:
        return None
    date = iso(m)
    issuer = inner[:m.start()].strip()
    doc = re.sub(r'\s+', '', inner[m.end():])
    doc = doc.replace('號號', '號')
    kind = next((k for k in ('會議紀錄', '書函', '公告', '令', '函') if doc.endswith(k)), '函')
    return {'issuer': issuer, 'date': date, 'docNo': doc, 'kind': kind, 'crossRef': '詳見' in tail, 'tail': tail}


def letters(lines, start, end, context):
    """Walk lines[start:end]; context(i, line) returns a new filing context or None. Yields letters with their context."""
    cur, ctx, i = None, None, start
    while i < end:
        line = lines[i]
        new = context(i, line)
        if new is not None:
            if cur: yield cur
            cur = None; ctx = new; i += 1; continue
        h = header_of(line, lines[i + 1:i + 3])
        if h:
            meta = parse_header(h[0], h[1])
            if meta:
                if cur: yield cur
                cur = {**meta, 'ctx': ctx, 'lines': [], 'header': h[0]}
                i += h[2]; continue
            if '會議' in h[0] and cur is not None:  # a meeting record attached to the letter it follows
                cur['lines'].append('【' + h[0] + '】'); i += h[2]; continue
        if cur is not None:
            cur['lines'].append(line)
        i += 1
    if cur: yield cur


def read(ed):
    return gzip.open(SRC / f'moea-factory-{ed}.txt.gz', 'rt', encoding='utf-8').read().split('\n')


def parse_106():
    L = read('106')
    find = lambda pat, after=0: next(i for i, l in enumerate(L) if i >= after and '....' not in l and re.match(pat, l.replace('\f', '').strip()))
    s1 = find(r'^一、工廠管理輔導法及施行細則暨相關函釋')
    s2 = find(r'^二、工廠及特定工廠登記申請書', s1)
    s21 = find(r'^二十一、相關公告及令', s2)
    s22 = find(r'^二十二、其他法規', s21)
    s_ag = find(r'^【申請農業用地作農業設施容許使用審查辦法】', s22)
    out = []

    def law_ctx(law):
        # A 施行細則 article printed right after a law article (no letter in between) shares that article's letters.
        state = {'ctx': [], 'fresh': False}

        def ctx(i, line):
            t = line.replace('\f', '')
            if t.strip().startswith('【'):
                state['fresh'] = False
                return None
            m = RULE_ART.match(t)
            if m and law == FACTORY:
                f = (RULES, art_label(m.group(1), m.group(2)))
                state['ctx'] = state['ctx'] + [f] if state['fresh'] else [f]
                state['fresh'] = True
                return list(state['ctx'])
            m = ART.match(t)
            if m:
                state['ctx'] = [(law, art_label(cn2int(m.group(1)), cn2int(m.group(2)) if m.group(2) else None))]
                state['fresh'] = True
                return list(state['ctx'])
            return None
        return ctx
    for a, b, ctx, base in ((s1, s2, law_ctx(FACTORY), None), (s21, s22, lambda i, l: None, [(FACTORY, '')]),
                            (s22, s_ag, law_ctx(NONURBAN), [(NONURBAN, '')]), (s_ag, len(L), law_ctx(AGRIFAC), [(AGRIFAC, '')])):
        for x in letters(L, a, b, ctx):
            x['ctx'] = x['ctx'] or base
            out.append(x)
    return out


def parse_112():
    L = read('112')
    start = next(i for i, l in enumerate(L) if l.strip() == '函釋彙整')
    topics = {'工廠登記', '產品分類', '納管特登', '用地變更'}
    state = {'topic': None}

    def ctx(i, line):
        if line.strip() in topics and not line.startswith(' ' * 20):
            state['topic'] = line.strip(); return [('topic', line.strip())]
        return None
    return list(letters(L, start, len(L), ctx))


HEAD102 = re.compile(r'^\s*(\S.{1,24}?)\s+(函|書函|令|公告)\s*$')


def parse_102():
    """102 edition: 「機關 書函」 then a line with date and number (or 發文日期／發文字號 lines)."""
    L = read('102')
    start = max(i for i, l in enumerate(L) if l.strip().startswith('二十三、相關函釋'))
    out, cur, i = [], None, start + 1
    while i < len(L):
        m = HEAD102.match(L[i].replace('\f', ''))
        nxt = ' '.join(x.strip() for x in L[i + 1:i + 4])
        if m and re.search(r'部|署|局|辦公室|院|府|會', m.group(1)) and DATE.search(nxt):
            if cur: out.append(cur)
            dm = DATE.search(nxt)
            num = re.search(r'([\w（）()]{0,12}字第?\s*[0-9A-Za-z]{5,13}\s*號)', nxt)
            used = 1 + next(k for k in range(1, 4) if re.search(r'號', L[i + k]) or k == 3)
            cur = {'issuer': m.group(1).strip(), 'date': iso(dm), 'docNo': re.sub(r'\s+|發文字號[:：]', '', num.group(1)) + m.group(2) if num else '',
                   'kind': m.group(2), 'crossRef': False, 'ctx': None, 'lines': [], 'header': L[i].strip()}
            i += used; continue
        if cur is not None:
            cur['lines'].append(L[i])
        i += 1
    if cur: out.append(cur)
    return out


CITE = re.compile('(' + '|'.join(sorted(map(re.escape, CITED_LAWS + list(ALIASES)), key=len, reverse=True)) +
                  r')(?:（[^）]{0,20}）)?\s*第\s*(\d+)\s*條(?:\s*之\s*(\d+))?')


def citations(text):
    t = unicodedata.normalize('NFKC', text).replace('\n', '')
    t = re.sub(r'(?<=\d)\s+(?=\d)', '', t)
    found = []
    for law, n, sub in CITE.findall(t.replace('（', '(').replace('）', ')').replace('(', '（').replace(')', '）')):
        f = {'law': ALIASES.get(law, law), 'article': art_label(int(n), int(sub) if sub else None), 'cited': True}
        if f not in found:
            found.append(f)
    return found


def main():
    merged, order = {}, []
    stats = {'parsed': {}, 'crossRefs': 0, 'noNumber': 0}
    for ed, parsed in (('112', parse_112()), ('106', parse_106()), ('102', parse_102())):
        stats['parsed'][ed] = len(parsed)
        for x in parsed:
            key = number_key(x['docNo'])
            body = clean(x['lines'])
            if not key:
                stats['noNumber'] += 1
                key = 'h' + hashlib.sha1((x['issuer'] + x['date'] + body[:200]).encode()).hexdigest()[:10]
            filing = []
            ctx = x['ctx']
            topic = ''
            for c in ctx or []:
                if c[0] == 'topic':
                    topic = c[1]
                else:
                    filing.append({'law': c[0], 'article': c[1], 'cited': False})
            if x['crossRef']:
                stats['crossRefs'] += 1
            item = merged.get(key)
            if not item:
                if x['crossRef'] or not body:
                    # a 「詳見 P.n」 pointer before the letter itself: keep the filing for when the letter turns up
                    item = merged.setdefault(key, {'pending': True, 'filed': [], 'editions': [], 'topics': []})
                else:
                    item = merged.setdefault(key, {'filed': [], 'editions': [], 'topics': []})
                order.append(key)
            if item.get('pending') and body and not x['crossRef']:
                item.pop('pending')
            if 'body' not in item and body and not x['crossRef']:
                item.update({'issuer': x['issuer'], 'date': x['date'], 'docNo': x['docNo'], 'kind': x['kind'], 'body': body,
                             'summary': summary_of(body), 'note': x.get('tail', '') if not x['crossRef'] else ''})
            for f in filing:
                if f not in item['filed']:
                    item['filed'].append(f)
            if topic and topic not in item['topics']:
                item['topics'].append(topic)
            if ed not in item['editions'] and not x['crossRef']:
                item['editions'].append(ed)
    items = []
    for key in order:
        it = merged[key]
        if it.get('pending') or 'body' not in it or not it['date']:
            continue
        cited = [c for c in citations(it['body']) if not any(f['law'] == c['law'] and f['article'] == c['article'] for f in it['filed'])]
        filed = it['filed'] + cited
        if not filed or (not any(f['law'] in (FACTORY, RULES) for f in filed) and re.search(FACTORY + '|工輔法|工管法|工廠登記', it['body'])):
            filed.append({'law': FACTORY, 'article': '', 'cited': True})
        issuer = re.sub(r'\s+', '', it['issuer'])
        items.append({'id': 'M' + key, 'date': it['date'], 'docNo': it['docNo'], 'issuer': issuer,
                      'kind': it['kind'], 'summary': it['summary'], 'body': it['body'], 'filed': filed, 'topics': it['topics'],
                      'editions': sorted(it['editions'], reverse=True), 'note': it.get('note', '')})
    items.sort(key=lambda x: (x['date'], x['id']), reverse=True)
    ids = [x['id'] for x in items]
    assert len(ids) == len(set(ids)), 'duplicate ids'
    doc = {
        'source': '經濟部中部辦公室《工廠管理輔導法暨相關函釋彙編》',
        'editions': EDITIONS,
        'note': '經濟部中部辦公室編印的函釋彙編（102 年 7 月、106 年 10 月、112 年 5 月三版）所收的經濟部、中部辦公室、工業局及相關機關函釋；同一函在多版出現只收一次，內文取最新版。106 年版依條文歸類，112 年版依主題歸類。彙編不是全部函釋，112 年 5 月以後的函釋未收；個案適用以主管機關認定為準。',
        'fetchedAt': '2026-11-27',
        'stats': {'items': len(items), **stats,
                  'topics': {t: sum(t in x['topics'] for x in items) for t in ('工廠登記', '產品分類', '納管特登', '用地變更')},
                  'byEdition': {ed: sum(ed in x['editions'] for x in items) for ed in EDITIONS}},
        'items': items,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps(doc['stats'], ensure_ascii=False))


if __name__ == '__main__':
    main()
