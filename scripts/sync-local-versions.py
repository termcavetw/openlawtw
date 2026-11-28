#!/usr/bin/env python3
"""Earlier versions of local laws from the county law systems' 「歷史法規」, in the format of the central law versions.

The county systems (主管法規共用系統) list a law's earlier texts at LawContentHistoryList.aspx?id= and show each at
LawContentHistory.aspx?hid=&id=, with its 異動日期. The current text is the record in public/data/laws.json. Output goes
to public/data/law-versions/<law id>.json beside the central files (same schema; see SCHEMA.md), plus index.json.

Effective dates. 地方制度法第 32 條: 自治法規、委辦規則 take effect on the third day counted from promulgation unless a
date is set, so 自治條例 and rules named 規則／細則／辦法／綱要／標準／準則 whose text says 「自發布（公布）日施行」 or
nothing get the third day; a text that names a date (「自中華民國○年○月○日施行」) gets that date. 行政規則 (要點、原則、
規定、基準…) have no such rule: their effective date is unknown (null, effectiveKnown false) unless the text names a
date — never guessed. The 異動日期 is kept as promulgated either way.

Old history pages are one block of text: articles are split at 「第 N 條／點」 headings, or, in texts numbered 一、二、…
at the start of a line, at the next number in sequence. A version that cannot be split is kept whole (articles empty,
fullText set) and takes no part in the per-article timeline.

Several county sites refuse foreign connections: their pages are fetched by a browser in Taiwan and handed in with
--import (bundles {url: base64}); other sites can be fetched directly with --fetch.
"""
import argparse, base64, hashlib, html, json, re, sys, time, unicodedata, urllib.parse, urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/law-versions'
AGENT = 'Mozilla/5.0 (OpenLawTW official-source snapshot)'
CN = {'零': 0, '〇': 0, '○': 0, 'Ｏ': 0, 'O': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
      '十': 10, '百': 100, '兩': 2, 'ㄧ': 1}
NUM = r'[0-9０-９一二三四五六七八九十百零〇○Ｏ兩ㄧ]+'
sha = lambda text: hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]


def cn2int(s):
    s = unicodedata.normalize('NFKC', s).strip()
    if s.isdigit():
        return int(s)
    if all(c in '零〇○Ｏ一二三四五六七八九O' for c in s) and len(s) > 1:  # 一○ = 10, 二一 = 21
        return int(''.join(str(CN[c]) for c in s))
    total, cur = 0, 0
    for c in s:
        v = CN.get(c)
        if v is None:
            return None
        if v in (10, 100):
            total += (cur or 1) * v
            cur = 0
        else:
            cur = v
    return total + cur


def roc(text):
    m = re.search(r'(\d{2,3})[.\s年/-]*(\d{1,2})[.\s月/-]*(\d{1,2})', unicodedata.normalize('NFKC', text))
    if not m:
        return None
    try:
        return date(int(m.group(1)) + 1911, int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def roc_cn(text):
    """民國 107 年 07 月 26 日 / 中華民國一百零七年七月二十六日 -> date."""
    t = unicodedata.normalize('NFKC', text)
    m = re.search(r'(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', t)
    if m:
        return date(int(m.group(1)) + 1911, int(m.group(2)), int(m.group(3)))
    m = re.search(r'(' + NUM + r')\s*年\s*(' + NUM + r')\s*月\s*(' + NUM + r')\s*日', t)
    if m:
        y, mo, d = (cn2int(m.group(i)) for i in (1, 2, 3))
        if y and mo and d:
            try:
                return date(y + 1911, mo, d)
            except ValueError:
                return None
    return None


def page_text(fragment):
    t = re.sub(r'<br\s*/?>', '\n', fragment, flags=re.I)
    t = re.sub(r'</(div|p|tr|li)>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t).replace('\xa0', ' ').replace('\r', '')
    return '\n'.join(line.rstrip() for line in t.split('\n'))


def parse_list(raw):
    """[(hid, date)] from LawContentHistoryList."""
    s = raw.decode('utf-8', 'replace')
    out = []
    for m in re.finditer(r'<tr[^>]*>(.*?)</tr>', s, flags=re.S | re.I):
        row = m.group(1)
        h = re.search(r'LawContentHistory\.aspx\?hid=(\d+)', row)
        d = re.search(r'(\d{2,3})\.(\d{1,2})\.(\d{1,2})', re.sub(r'<[^>]+>', ' ', row))
        if h and d:
            out.append((h.group(1), roc(d.group(0))))
    return out


def parse_history(raw):
    s = raw.decode('utf-8', 'replace')
    m = re.search(r'id="[^"]*tdLawContent"[^>]*>(.*?)</div>\s*</div>\s*</div>', s, flags=re.S)
    if not m:
        m = re.search(r'id="[^"]*tdLawContent"[^>]*>(.*)', s, flags=re.S)
    body = page_text(m.group(1)) if m else ''
    body = re.sub(r'^\s*法規內容：\s*', '', body)
    body = body.split('::: ')[0]
    when = re.search(r'歷史法規：\s*</th>\s*<td[^>]*>(.*?)</td>', s, flags=re.S)
    name = re.search(r'id="[^"]*aLawName"[^>]*>(.*?)</a>', s, flags=re.S)
    return {'date': roc_cn(page_text(when.group(1))) if when else None,
            'name': html.unescape(re.sub(r'<[^>]+>', '', name.group(1))).strip() if name else '', 'text': body.strip()}


HEAD = re.compile(r'^\s*第\s*(' + NUM + r')\s*(?:條|點)(?:\s*之\s*(' + NUM + r'))?\s*(.*)$')
HEAD2 = re.compile(r'^\s*第\s*(' + NUM + r')(?:\s*之\s*(' + NUM + r'))?\s*(條|點)\s*(.*)$')
TOP = re.compile(r'^(' + r'[一二三四五六七八九十百零〇○Ｏㄧ]+' + r')(?:\s{2,}|、|\s*[．.])\s*(.*)$')


CHAPTER = re.compile(r'^\s*第\s*(' + NUM + r')\s*(章|節|編|款|目)(?![之條點])')
HEAD_INLINE = re.compile(r'(?<=\S)(?=第[\s\u3000]*' + NUM + r'[\s\u3000]*(?:之[\s\u3000]*' + NUM + r'[\s\u3000]*)?(?:條|點)[\s\u3000])')


def _lines(text):
    """Lines of a history page with chapter headings dropped. A chapter heading glued to the next article heading
    (「第二章　總則第　五　條　　(刪除)」) is split so the article heading starts its own line."""
    out = []
    for line in text.split('\n'):
        if CHAPTER.match(line):
            parts = HEAD_INLINE.split(line, maxsplit=1)
            if len(parts) == 2:
                out.append(parts[1])
            continue
        out.append(line)
    return out


def _heading_mode(lines):
    """Split on 「第 N 條／點」 headings. A strong heading starts at column 0 or 1 and is followed by whitespace or ends
    the line; it may skip numbers (an article dropped from the publication). Any other match counts only when it is
    the next number in sequence, so a wrapped line beginning 「第三條規定…」 does not split an article."""
    out, cur = [], None
    for line in lines:
        h = HEAD2.match(line)
        n = cn2int(h.group(1)) if h else None
        if h and n is not None:
            sub = cn2int(h.group(2)) if h.group(2) else None
            rest = h.group(4).strip()
            strong = len(line) - len(line.lstrip()) <= 1 and (not rest or re.match(r'^\s*第[^條點]*(條|點)[\s\u3000]', line) is not None)
            if out:
                ln, lsub = out[-1][0], out[-1][1]
                seq = (n == ln + 1 and not sub) or (n == ln and sub is not None and sub == (lsub or 0) + 1)
                ahead = (n > ln and not sub) or (n == ln and sub is not None and sub > (lsub or 0))
            else:
                seq, ahead = n == 1, True
            if seq or (strong and ahead):
                cur = [n, sub, [rest] if rest else []]
                out.append(cur)
                continue
        if cur is not None:
            cur[2].append(line)
    arts = [(n, sub, '\n'.join(body).strip()) for n, sub, body in out]
    return arts if arts and sum(1 for x in arts if x[2]) >= len(arts) * 0.8 else None


def _point_mode(lines):
    """Split on 「一、」／「一  」 numbering in sequence. 「N、」 may be indented (some pages indent every point with
    tabs) and may skip up to two numbers; 「N  」 must start at column 0 or 1 and be the next number."""
    out, cur, expected = [], None, 1
    for line in lines:
        indent = len(line) - len(line.lstrip())
        m = TOP.match(line.lstrip())
        n = cn2int(m.group(1)) if m else None
        if m and n is not None:
            comma = line.lstrip()[len(m.group(1)):][:1] == '、'
            ok = n == expected if not comma else expected <= n <= expected + 2
            if ok and (indent <= 1 or comma):
                cur = [n, None, [m.group(2)]]
                out.append(cur)
                expected = n + 1
                continue
        if cur is not None:
            cur[2].append(line)
    arts = [(n, sub, '\n'.join(body).strip()) for n, sub, body in out]
    return arts if len(arts) >= 2 else None


def split_articles(text, target=None):
    """[(n, sub, text)] or None. Tries heading mode and point mode and keeps the one whose article count is
    closest to ``target`` (the current version's count); without a target, the one with more articles."""
    lines = _lines(text)
    cands = [c for c in (_heading_mode(lines), _point_mode(lines)) if c]
    if not cands:
        return None
    if target:
        return min(cands, key=lambda c: (abs(len(c) - target), -len(c)))
    return max(cands, key=len)


def canon(no):
    """'第 3 條' / '第三點' / '第 五 條' / '第 7-1 條' -> (n, sub, unit) or None."""
    t = unicodedata.normalize('NFKC', no).replace(' ', '')
    m = re.match(r'^第(' + NUM + r')(?:[-之](' + NUM + r'))?(條|點)$', t) or re.match(r'^第(' + NUM + r')(條|點)之(' + NUM + r')$', t)
    if not m:
        return None
    if m.re.pattern.endswith('之(' + NUM + r')$'):
        return cn2int(m.group(1)), cn2int(m.group(3)), m.group(2)
    return cn2int(m.group(1)), cn2int(m.group(2)) if m.group(2) else None, m.group(3)


def same(a, b):
    f = lambda s: re.sub(r'\s+', '', unicodedata.normalize('NFKC', s or ''))
    return f(a) == f(b)


RULE_NAMES = re.compile(r'(自治條例|規則|細則|辦法|綱要|標準|準則)$')


def effective(name, text, promulgated):
    """(date or None, known, basis)."""
    t = unicodedata.normalize('NFKC', text or '')
    dates = [roc_cn(m.group(1)) for m in re.finditer(
        r'自\s*(?:中華民國)?\s*(' + NUM + r'\s*年\s*' + NUM + r'\s*月\s*' + NUM + r'\s*日)\s*(?:起)?\s*(?:施行|生效)', t)]
    dates = [d for d in dates if d]
    # A date before this version's promulgation belongs to an earlier version (the 施行 article keeps it), so it
    # says nothing about when this amendment took effect.
    later = [d for d in dates if promulgated is None or d >= promulgated]
    if later:
        return min(later), True, '條文明定施行日期'
    if promulgated is None:
        return None, False, '無發布日期'
    if RULE_NAMES.search(name or ''):
        if re.search(r'自即日(?:起)?(?:施行|生效)', t):
            return promulgated, True, '條文定自即日施行'
        if re.search(r'施行日期[，,]?\s*(?:由|另)', t):
            return None, False, '施行日期另定'
        return promulgated + timedelta(days=2), True, '地方制度法第 32 條：發布日起算第三日'
    return None, False, '行政規則未明定施行日期'


def build(law_id, law, versions):
    """versions: [{date, name, text, url}] oldest first (official history), then the current law."""
    current_canon = {}
    for a in law['articles']:
        c = canon(a['no'])
        if c:
            current_canon[c[:2]] = a['no']
    unit = '點' if any((canon(a['no']) or (0, 0, ''))[2] == '點' for a in law['articles']) else '條'
    key = lambda n, sub: current_canon.get((n, sub)) or (f'第 {n}' + (f'-{sub}' if sub else '') + f' {unit}')
    texts, out_versions, full = {}, [], []
    for v in versions:
        if v.get('current'):
            arts = {a['no']: a['text'] for a in law['articles']}
        elif v.get('arts') is not None:
            arts = v['arts']  # an earlier version kept in this law's file
        else:
            split = split_articles(v['text'], len(law['articles']))
            arts = {key(n, sub): t for n, sub, t in split} if split else None
        d = v['date']
        body = '\n'.join(a['text'] for a in law['articles']) if v.get('current') else (
            v['text'] if v.get('arts') is None else '\n'.join(v['arts'].values()))
        eff, known, basis = effective(v.get('name') or law['name'], body, d)
        entry = {'promulgated': d.isoformat() if d else None, 'url': v['url'], 'effective': eff.isoformat() if eff else None,
                 'effectiveKnown': known, 'effectiveBasis': basis, 'exceptions': {}}
        if v.get('current'):
            entry['current'] = True
        if v.get('observed'):
            entry['observed'] = True
        if v.get('name') and v['name'] != law['name']:
            entry['name'] = v['name']  # the law's name at that time
        if arts is None:
            entry['fullText'] = v['text']
            entry['articles'] = {}
            full.append(None)
        else:
            hashes = {}
            for no, t in arts.items():
                h = sha(t); texts[h] = t; hashes[no] = h
            entry['articles'] = hashes
            full.append(hashes)
        out_versions.append(entry)
    timeline = {}
    usable = [(i, v) for i, v in enumerate(out_versions) if full[i] is not None]
    for pos, (i, v) in enumerate(usable):
        for no, h in full[i].items():
            segs = timeline.setdefault(no, [])
            if segs and segs[-1]['_v'] == usable[pos - 1][0] and same(texts[segs[-1]['text']], texts[h]):
                segs[-1]['_v'] = i
                segs[-1]['text'] = h  # the later wording of the same text
                continue
            if segs and segs[-1]['to'] is None and segs[-1]['_v'] == usable[pos - 1][0]:
                close = date.fromisoformat(v['effective']) - timedelta(days=1) if v['effective'] else None
                segs[-1]['to'], segs[-1]['toKnown'] = (close.isoformat() if close else None), bool(close)
            segs.append({'from': v['effective'], 'fromKnown': v['effectiveKnown'], 'to': None, 'toKnown': True,
                         'text': h, 'version': v['promulgated'], 'promulgated': v['promulgated'], '_v': i})
        if pos:
            prev_i = usable[pos - 1][0]
            for no, segs in timeline.items():
                if no not in full[i] and segs[-1]['_v'] == prev_i and segs[-1]['to'] is None:
                    close = date.fromisoformat(v['effective']) - timedelta(days=1) if v['effective'] else None
                    segs[-1]['to'], segs[-1]['toKnown'] = (close.isoformat() if close else None), bool(close)
    last = usable[-1][0] if usable else None
    for segs in timeline.values():
        for s in segs:
            if s['to'] is None and s['_v'] != last and s['toKnown']:
                s['toKnown'] = False  # the article is gone from a version that could not be split
            s.pop('_v')
        # A version amended again before its effective date never took effect: like the central files, its segment
        # is left out (the text stays in versions).
        segs[:] = [s for s in segs if not (s['from'] and s['to'] and s['to'] < s['from'])]
    previous = {}
    for v in out_versions:
        articles = v.pop('articles')
        if 'fullText' in v:
            continue
        v['changed'] = {no: h for no, h in articles.items() if previous.get(no) != h}
        v['removed'] = [no for no in previous if no not in articles]
        v['articleOrder'] = list(articles)
        v['articleCount'] = len(articles)
        previous = articles
    return texts, out_versions, timeline


def current_hash(law):
    return hashlib.sha256(json.dumps([[a['no'], a['text']] for a in law['articles']], ensure_ascii=False).encode()).hexdigest()


def stored_versions(doc):
    """The versions kept in an earlier output file, as build() input: each with its articles (or its fullText)."""
    out, arts = [], {}
    for v in doc['versions']:
        d = date.fromisoformat(v['promulgated']) if v['promulgated'] else None
        if 'fullText' in v:
            out.append({'date': d, 'name': v.get('name', doc['name']), 'text': v['fullText'], 'url': v['url'],
                        'observed': v.get('observed', False)})
            continue
        arts = {no: doc['texts'][v['changed'][no]] if no in v['changed'] else arts[no] for no in v['articleOrder']}
        out.append({'date': d, 'name': v.get('name', doc['name']), 'text': '', 'arts': dict(arts), 'url': v['url'],
                    'observed': v.get('observed', False)})
    return out


def page_key(url):
    """host + page + query: some sites serve the same pages with or without a path prefix (/glrsout/)."""
    u = urllib.parse.urlparse(url)
    return u.netloc.lower(), u.path.rsplit('/', 1)[-1].lower(), u.query


def load_bundles(dirs):
    files = {}
    for d in dirs:
        for p in Path(d).glob('olw-hist-*.json'):
            for url, b64 in json.loads(p.read_text(encoding='utf-8')).items():
                raw = base64.b64decode(b64)
                if len(raw) > 2000:  # an error page from a timed-out request is not kept over a real one
                    files[page_key(url)] = raw
    return files


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': AGENT})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--import', dest='imports', nargs='*', default=[])
    ap.add_argument('--fetch', action='store_true', help='fetch the lists and pages not in the imports from the sites')
    ap.add_argument('--changed', action='store_true',
                    help='only laws whose current text differs from the one in their file (a new version can only appear then)')
    ap.add_argument('--only', nargs='*')
    a = ap.parse_args()
    laws = json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8'))
    files = load_bundles(a.imports)
    OUT.mkdir(parents=True, exist_ok=True)
    stats = {'laws': 0, 'withHistory': 0, 'versions': 0, 'unsplit': 0, 'missing': 0, 'unchanged': 0, 'fromFile': 0}
    host_failures = {}

    def get(url):
        raw = files.get(page_key(url))
        host = urllib.parse.urlparse(url).netloc
        if raw is None and a.fetch and host_failures.get(host, 0) < 3:
            try:
                raw = fetch(url); time.sleep(0.3)
                host_failures[host] = 0
            except Exception:  # noqa: BLE001 - blocked or down: counted, and the host is skipped after 3 in a row
                host_failures[host] = host_failures.get(host, 0) + 1
        return raw

    for law_id, law in sorted(laws.items()):
        u = urllib.parse.urlparse(law.get('url', ''))
        if not u.path.endswith('LawContent.aspx') or law['region'] == '中央' and '-' not in law_id or not law.get('articles'):
            continue
        if a.only and law_id not in a.only:
            continue
        path = OUT / f'{law_id}.json'
        prev = json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
        cur_hash = current_hash(law)
        if a.changed and prev and prev.get('currentHash') == cur_hash:
            stats['unchanged'] += 1
            continue
        code = urllib.parse.parse_qs(u.query).get('id', [None])[0]
        base = f'{u.scheme}://{u.netloc}{u.path[:-len("LawContent.aspx")]}'
        current_date = roc_cn(law.get('modified') or '')
        raw = get(f'{base}LawContentHistoryList.aspx?id={code}')
        olds = []
        if raw is not None:
            for hid, listed in parse_list(raw):
                page_url = f'{base}LawContentHistory.aspx?hid={hid}&id={code}'
                page = get(page_url)
                if page is None:
                    continue
                p = parse_history(page)
                olds.append({'date': p['date'] or listed, 'name': p['name'], 'text': p['text'], 'url': page_url})
        elif prev:
            # The site is out of reach: rebuild from the file, the text it had as current becoming an earlier version.
            olds = stored_versions(prev)
            if prev.get('currentHash') == cur_hash:
                olds = olds[:-1]
            else:
                olds[-1]['observed'] = True  # seen on the current page before this amendment, not on a history page
            stats['fromFile'] += 1
        else:
            stats['missing'] += 1
            continue
        stats['laws'] += 1
        olds.sort(key=lambda v: v['date'] or date.min)
        seen, uniq = set(), []
        for v in olds:  # some lists show the same publication twice
            k = (v['date'], v['text'].strip(), json.dumps(v.get('arts'), ensure_ascii=False, sort_keys=True))
            if k not in seen:
                seen.add(k); uniq.append(v)
        olds = [v for v in uniq if not (current_date and v['date'] == current_date)]
        versions = olds + [{'date': current_date, 'name': law['name'], 'text': '', 'url': law['url'], 'current': True}]
        texts, out_versions, timeline = build(law_id, law, versions)
        stats['withHistory'] += bool(olds)
        stats['versions'] += len(out_versions)
        stats['unsplit'] += sum(1 for v in out_versions if 'fullText' in v)
        doc = {'law': law_id, 'name': law['name'], 'region': law['region'], 'source': f'{base}LawContentHistoryList.aspx?id={code}',
               'note': '歷次版本取自該縣市法規系統「歷史法規」；promulgated 是異動（發布）日期。施行日：自治法規依地方制度法第 32 條為發布日起算第三日，'
                       '條文定有日期者依其日期；行政規則（要點、原則等）未明定者不推定（effectiveKnown=false）。無法切分條號的舊版只存 fullText。',
               'currentPromulgated': current_date.isoformat() if current_date else None, 'currentHash': cur_hash,
               'texts': texts, 'versions': out_versions, 'articles': timeline}
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    stats['unreachableHosts'] = sorted(h for h, n in host_failures.items() if n >= 3)
    import importlib.util  # the index covers central and local files alike; its writer lives with the central sync
    spec = importlib.util.spec_from_file_location('sync_law_versions', ROOT / 'scripts/sync-law-versions.py')
    central = importlib.util.module_from_spec(spec); spec.loader.exec_module(central)
    central.write_index(laws)
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == '__main__':
    main()
