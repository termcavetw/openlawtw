#!/usr/bin/env python3
"""Every historical version of each central law (全國法規資料庫「歷史法規」) and, per article, which text was in force
when -> public/data/law-versions/<pcode>.json and public/data/law-versions/index.json.

Sources: LawOldVerList.aspx?pcode= lists the earlier versions (by 公布／發布日 lnndate); LawOldVer.aspx?pcode=&lnndate=&lser=
has each one's full text (the site says complete old texts are kept for amendments since 民國 90 年 4 月). The current
version is the record already in public/data/laws.json.

When a version took effect comes from the law's 沿革 (law.history): 「自公布／發布日施行」 and no clause mean the third
day counted from promulgation (中央法規標準法第 13 條); 「自即日施行／生效」 the same day; 「自○年○月○日施行」 that date;
「除第 X 條自…外，其餘…自…」 and later notices 「令發布第 X 條條文施行日期，自…施行」 per article; 「施行日期由行政院定之／另定」
with no later notice, 「自公布後六個月施行」 and articles put in force only in part (第 X 條第 N 項, …部分): unknown
(null, Known false). Unknown is never guessed.

Incremental: a version already stored is not fetched again; --changed only revisits laws whose current version
(modified or text) differs from the stored one or that have no file yet; --offline rebuilds from stored versions.
"""
import argparse, hashlib, html, json, re, sys, time, unicodedata, urllib.request
from lxml import html as lxml_html
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/law-versions'
BASE = 'https://law.moj.gov.tw/LawClass/'
AGENT = 'OpenLawTW/official-source-snapshot'
CN = {c: i for i, c in enumerate('零一二三四五六七八九')} | {'〇': 0, '○': 0}


def fetch(url, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': AGENT})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))


def cn2int(s):
    s = re.sub(r'\s+', '', s)
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


NUM = r'[0-9〇○零一二三四五六七八九十百]+'
ROC = re.compile(r'(?:中華民國)?\s*(' + NUM + r')\s*年\s*(' + NUM + r')\s*月\s*(' + NUM + r')\s*日')


def roc(m):
    try:
        y, mo, d = (cn2int(x) for x in m.groups())
        return date(y + 1911, mo, d)
    except ValueError:
        return None


def expand(chunk):
    out = []
    for part in [p for p in re.split(r'[、，,及]', re.sub(r'\s+|第', '', chunk)) if p]:
        ends = re.split(r'[～~]', part)
        if len(ends) != 2:
            out.append(part); continue
        a, b = (e.split('-') for e in ends)
        try:
            a, b = [int(x) for x in a], [int(x) for x in b]
        except ValueError:
            out.extend(ends); continue
        if len(a) == 1 and len(b) == 1:
            out += [str(i) for i in range(a[0], b[0] + 1)]
        elif len(a) == 2 and len(b) == 2 and a[0] == b[0]:
            out += [f'{a[0]}-{i}' for i in range(a[1], b[1] + 1)]
        elif len(a) == 1 and len(b) == 2:
            out += [str(a[0])] + [f'{b[0]}-{i}' for i in range(1, b[1] + 1)]
        else:
            out += ends
    return out


ARTS = re.compile(r'第\s*([0-9][0-9\-、～~，,及\s第]*?)\s*條')


def key(no):
    return '第 ' + no + ' 條'


def named_in(text, partial=False):
    """Articles named in text; with partial, (article, True if only some 款／項 of it are meant)."""
    out = []
    text = re.sub(r'條\s*(?:至|到)\s*第', '～', text)
    # 「第 81-3 條第 1 項、81-4 條」: the list goes on after a 項／款 without repeating 第
    text = re.sub(r'([項款])\s*[、，,及]\s*(?=[0-9][0-9\-、～~\s]*條)', r'\1、第', text)
    for m in ARTS.finditer(text):
        nos = expand(m.group(1))
        tail = re.match(r'\s*第\s*[0-9、～~，,至第\s]*(款|項)', text[m.end():])
        for i, no in enumerate(nos):
            out.append((key(no), bool(tail) and i == len(nos) - 1))
    return out if partial else [k for k, _ in out]


def items_of(history):
    """沿革 → [{date, text}] (one per numbered item; continuation notices stay inside their item's text)."""
    out = []
    for raw in re.split(r'\n\s*(?=\d+\.\s*中華民國)', '\n' + (history or '')):
        text = re.sub(r'\s*\n\s*', '', raw).strip()
        text = re.sub(r'^\d+\.\s*', '', text)
        m = ROC.search(text)
        if m and roc(m):
            out.append({'date': roc(m), 'text': text})
    return out


UNSET = r'施行日期[，,]?\s*(?:由行政院|由[^，,；;]{0,15}以命令|以命令|另定|另以命令)'


def effective_of(item):
    """(default effective date or None, {article: date or None}, known) for one 沿革 item.

    The head (the amendment itself) gives a general date and per-article dates; 「施行日期由行政院定之／另定」
    leaves them unset. Later sentences of the item are the orders that set them. Nothing unset is guessed:
    it stays None. An article only partly put in force (第 X 條第 N 項, …中…部分) is None as well."""
    text, promulgated = item['text'], item['date']
    third = promulgated + timedelta(days=2)
    sentences = re.split(r'(?<![自於至依])(?=中華民國' + NUM + r'年' + NUM + r'月' + NUM + r'日)', text)
    head, notices = sentences[0] if sentences[0] else sentences[1], sentences[1:] if sentences[0] else sentences[2:]
    date_re = r'(?:中華民國)?\s*(' + NUM + r'\s*年\s*' + NUM + r'\s*月\s*' + NUM + r'\s*日)'

    def when(s):
        if re.search(r'自(公布|發布)(之)?日(起)?施行', s):
            return third
        if re.search(r'自即日(起)?(施行|生效)', s):
            return promulgated
        m = re.search(r'自\s*' + date_re + r'\s*(起)?(施行|生效)', s)
        if m:
            return roc(ROC.search(m.group(1)))
        return 'unset'

    default, exceptions, partial = None, {}, set()
    general_unset, explicit = False, False
    pending = []  # 「定自…施行」 tacked onto the head without the order's own heading

    def put(names, d, whole=True):
        for k, part in names:
            if part or not whole:
                exceptions[k] = None; partial.add(k)
            else:
                exceptions[k] = d

    def except_clause(t):
        """「除第 X 條自…施行（、第 Y 條施行日期另定）外，其餘…自…施行」 → (match, date for the rest or 'unset')."""
        m = re.search(r'(?<!刪)除(.+?)外[，,]?(?:其餘[^；;。自]*?)?(定?自[^；;。]*?(施行|生效))', t)
        if not m:
            return None, None
        for piece in re.split(r'(?<=施行)[，,及、]|(?<=定之)[，,及、]|(?<=另定)[，,及、]', m.group(1)):
            if re.search(UNSET, piece):
                put(named_in(piece.split('施行日期')[0], partial=True), None)
            else:
                d = when(piece)
                put(named_in(re.split(r'定?自', piece)[0], partial=True), None if d == 'unset' else d,
                    whole='部分' not in piece and '規定' not in piece.split('自')[0][-8:])
        return m, when(m.group(2))

    m, d = except_clause(head)
    if m:
        default, explicit = (d if d != 'unset' else None), d != 'unset'
        head_rest = head[m.end():]
        for d in re.findall(r'定自\s*' + date_re + r'\s*(?:起)?施行', head_rest):
            pending.append(roc(ROC.search(d)))
    else:
        for part in re.split(r'[；;]|[，,](?=其餘)', head):
            part = re.sub(r'依第[^條]*條規定[：:]', '', part)
            for d in re.findall(r'定自\s*' + date_re + r'\s*(?:起)?施行', part):
                pending.append(roc(ROC.search(d)))
            part = re.sub(r'定自\s*' + date_re + r'\s*(?:起)?施行', '', part)
            listing = bool(re.search(r'修正(公布|發布)|增訂|刪除|制定', part))
            if re.search(UNSET, part):
                names = [] if listing else named_in(part.split('施行日期')[0], partial=True)
                if names:
                    put(names, None)
                else:
                    general_unset = True
                continue
            d = when(part)
            if d == 'unset':
                continue
            names = [] if listing else named_in(part.split('自')[0], partial=True)
            if names:
                put(names, d, whole='部分' not in part.split('自')[0])
            else:
                default, explicit = d, True
    if default is None and not general_unset and not explicit:
        default = third  # no general clause: 中央法規標準法第 13 條

    def fill(d):
        """An order that names no article: it sets what the amendment left unset."""
        nonlocal default, general_unset
        waiting = [k for k, v in exceptions.items() if v is None and k not in partial]
        if general_unset or default is None:
            default, general_unset = d, False
            for k in waiting:
                exceptions[k] = d
        elif waiting:
            for k in waiting:
                exceptions[k] = d
        else:
            default = d

    for d in pending:
        fill(d)
    for n in notices:
        for paren in re.findall(r'[（(]([^）)]*?施行日期另定[^）)]*)[）)]', n):
            for k in named_in(paren):
                exceptions.setdefault(k, None)
        n = re.sub(r'[（(][^）)]*[）)]', '', n)
        if when(n) == 'unset' and not re.search(r'定自\s*' + date_re, n):
            continue
        listed = re.search(r'(修正|增訂|刪除)(公布|發布)?(第.+?條)', n)
        if listed and not re.search(r'令發布(第.+?條)?(條文)?(之)?(施行日期|[，,]?\s*定?自)', n):
            # another amendment promulgated the same day (its own 「並自…施行」), not an order for this one
            d = when(n)
            if d != 'unset':
                put(named_in(n.split('；')[0].split('並自')[0], partial=True), d)
            continue
        m, d = except_clause(n)
        if m:
            if d != 'unset':
                fill(d)
            continue
        for clause in re.split(r'[；;]', n):
            d = when(clause)
            if d == 'unset':
                mm = re.search(r'定自\s*' + date_re, clause)
                if not mm:
                    continue
                d = roc(ROC.search(mm.group(1)))
            lead = clause.split('施行日期')[0] if '施行日期' in clause else re.split(r'定?自', clause)[0]
            names = named_in(lead, partial=True)
            if not names:
                fill(d)
                continue
            put(names, d, whole='部分' not in lead)
    known = default is not None and not general_unset
    if general_unset:
        default = None
    return default, exceptions, known


def parse_version(raw):
    """Both page layouts: older versions print fixed-width text (col-data text-pre), newer ones one div per line."""
    tree = lxml_html.fromstring(raw, parser=lxml_html.HTMLParser(encoding='utf-8'))
    name = tree.xpath('//th[contains(.,"法規名稱")]/following-sibling::td[1]')
    modified = tree.xpath('//th[contains(.,"修正日期") or contains(.,"公布日期") or contains(.,"發布日期") or contains(.,"制定日期")]/following-sibling::td[1]')
    body = tree.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," law-content ")]')
    if not (name and len(body) == 1):
        raise ValueError('unrecognised old-version page')
    articles, path = [], []
    for node in body[0]:
        cls = node.get('class', '')
        m = re.search(r'char-(\d)', cls)
        if m:
            label = re.sub(r'\s+', ' ', node.text_content()).strip()
            level = int(m.group(1))
            path = path[:max(0, level - 2)] + [label]
            continue
        no = node.xpath('./div[contains(@class,"col-no")]')
        data = node.xpath('./div[contains(@class,"col-data")]')
        if not (no and data):
            continue
        lines = data[0].xpath('.//div[starts-with(@class,"line-")]')
        if lines:
            text = '\n'.join(l.text_content().strip() for l in lines)
        else:
            text = '\n'.join(l.rstrip() for l in data[0].text_content().replace('\r', '').split('\n')).strip()
        articles.append({'no': re.sub(r'\s+', ' ', no[0].text_content()).strip(), 'text': text, 'path': list(path)})
    if not articles:
        raise ValueError('old-version page has no articles')
    return re.sub(r'\s+', '', name[0].text_content()), (roc(ROC.search(modified[0].text_content())) if modified else None), articles


def listing(code):
    s = fetch(BASE + 'LawOldVerList.aspx?pcode=' + code).decode('utf-8')
    return sorted({(m.group(1), m.group(2)) for m in re.finditer(r'LawOldVer\.aspx\?pcode=' + code + r'&amp;lnndate=(\d{8})&amp;lser=(\d+)', s)})


def same(a, b):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', a)) == re.sub(r'\s+', '', unicodedata.normalize('NFKC', b))


sha = lambda text: hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]


def build(law, old):
    """Versions (old + current) → texts, versions, per-article timelines."""
    items = items_of(law.get('history', ''))
    by_date = {}
    for it in items:
        by_date.setdefault(it['date'].isoformat(), it)
    versions = [dict(v) for v in sorted(old, key=lambda v: (v['promulgated'], v['lser']))]
    versions.append({'promulgated': law['modified'], 'lser': 'current', 'url': law['url'], 'current': True,
                     'articles': [{'no': a['no'], 'text': a['text'], 'path': a.get('path', [])} for a in law['articles']]})
    texts, out_versions, timeline, amended = {}, [], {}, {}
    for v in versions:
        it = by_date.get(v['promulgated'])
        default, exceptions, known = effective_of(it) if it else (None, {}, False)
        entry = {k: v[k] for k in ('promulgated', 'lser', 'url', 'name', 'sha256', 'current') if k in v}
        entry.update(effective=default.isoformat() if default else None, effectiveKnown=known and default is not None,
                     effectiveBasis=it['text'] if it else '沿革查無此日期的紀錄',
                     exceptions={k: (d.isoformat() if d else None) for k, d in exceptions.items()},
                     articles={})
        for a in v['articles']:
            h = sha(a['text']); texts[h] = a['text']; entry['articles'][a['no']] = h
        # the articles this version amended, added or deleted (None: all, e.g. a full revision or no 沿革 entry)
        sentences = [x for x in re.split(r'(?<![自於至依])(?=中華民國' + NUM + r'年' + NUM + r'月' + NUM + r'日)', it['text']) if x] if it else []
        listings = [x for x in sentences[:1] + [x for x in sentences[1:] if re.search(r'(修正|增訂|刪除)(公布|發布)?第', x)]]
        named = {k for x in listings for k in named_in(x)}
        # no article named (「修正公布」 alone, as the 沿革 of some full revisions reads): treat as all
        amended[len(out_versions)] = None if (not it or '全文' in sentences[0] or not named) else named
        out_versions.append(entry)
    # per article: a new segment whenever the text differs from the version before
    full = [v['articles'] for v in out_versions]
    for i, v in enumerate(out_versions):
        for no, h in full[i].items():
            segs = timeline.setdefault(no, [])
            if segs and segs[-1]['_v'] == i - 1 and (same(texts[segs[-1]['text']], texts[h]) or
                                                    (amended[i] is not None and no not in amended[i])):
                # unchanged, or only an editorial difference in an article this version did not amend: same segment,
                # with the later (corrected) text
                segs[-1]['_v'] = i; segs[-1]['text'] = h; continue
            frm = v['exceptions'][no] if no in v['exceptions'] else v['effective']
            known = (v['exceptions'].get(no) is not None) if no in v['exceptions'] else v['effectiveKnown']
            if segs and segs[-1]['_v'] == i - 1 and segs[-1]['to'] is None:
                segs[-1]['to'] = (date.fromisoformat(frm) - timedelta(days=1)).isoformat() if frm else None
                segs[-1]['toKnown'] = bool(frm)
            segs.append({'from': frm, 'fromKnown': bool(known and frm), 'to': None, 'toKnown': True, 'text': h,
                         'version': v['promulgated'], '_v': i})
        # an article missing from this version ended when this version took effect
        for no, segs in timeline.items():
            if no not in full[i] and segs[-1]['_v'] == i - 1 and segs[-1]['to'] is None and i > 0:
                frm = v['exceptions'][no] if no in v['exceptions'] else v['effective']
                segs[-1]['to'] = (date.fromisoformat(frm) - timedelta(days=1)).isoformat() if frm else None
                segs[-1]['toKnown'] = bool(frm); segs[-1]['_v'] = -1
    # A version whose text was replaced by a later amendment before it took effect (the later one took effect
    # first) never applied: drop that segment; its text stays in versions[].articles.
    for no, segs in timeline.items():
        kept = []
        for seg in segs:
            while kept and seg['fromKnown'] and kept[-1]['fromKnown'] and seg['from'] <= kept[-1]['from']:
                kept.pop()
                if kept and kept[-1]['to'] and kept[-1]['toKnown']:
                    end = (date.fromisoformat(seg['from']) - timedelta(days=1)).isoformat()
                    kept[-1]['to'] = min(kept[-1]['to'], end)
            kept.append(seg)
        for seg in kept:
            seg.pop('_v', None)
        timeline[no] = kept
    # store each version as its difference from the one before (the first one whole): article order is kept
    # by articleOrder, which lists every article of that version only when the order or the set changed
    previous = {}
    for v, articles in zip(out_versions, full):
        v['changed'] = {no: h for no, h in articles.items() if previous.get(no) != h}
        v['removed'] = [no for no in previous if no not in articles]
        if list(articles) != [no for no in previous if no in articles] + [no for no in articles if no not in previous]:
            v['articleOrder'] = list(articles)
        v['articleCount'] = len(articles)
        del v['articles']
        previous = articles
    return texts, out_versions, timeline


def version_articles(versions):
    """Inverse of the stored differences: [{no: hash}] for every version."""
    out, current = [], {}
    for v in versions:
        if 'articles' in v:  # files written before the difference format
            current = dict(v['articles']); out.append(current); continue
        merged = {no: h for no, h in current.items() if no not in v['removed']}
        merged.update(v['changed'])
        order = v.get('articleOrder') or ([no for no in current if no in merged] + [no for no in v['changed'] if no not in current])
        current = {no: merged[no] for no in order}
        out.append(current)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--changed', action='store_true', help='only laws whose current version changed or that have no file')
    ap.add_argument('--only', nargs='*', default=[])
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--delay', type=float, default=0.5)
    ap.add_argument('--offline', action='store_true', help='rebuild from the versions already stored (after a parser change)')
    a = ap.parse_args()
    laws = json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8'))
    codes = sorted(c for c, l in laws.items() if l.get('region') == '中央' and re.fullmatch(r'[A-Z]\d{7}', c) and l.get('source') == '全國法規資料庫')
    if a.only:
        codes = [c for c in codes if c in a.only]
    OUT.mkdir(parents=True, exist_ok=True)
    done, failures = 0, []
    for code in codes:
        law, path = laws[code], OUT / f'{code}.json'
        prev = json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
        current_hash = sha(json.dumps([[x['no'], x['text']] for x in law['articles']], ensure_ascii=False))
        if a.changed and prev and prev.get('currentPromulgated') == law['modified'] and prev.get('currentHash') == current_hash:
            continue
        if a.limit and done >= a.limit:
            break
        try:
            stored = {}
            if prev:
                for v, arts in zip(prev['versions'], version_articles(prev['versions'])):
                    if not v.get('current'):
                        stored[(v['promulgated'].replace('-', ''), v['lser'])] = {
                            **{k: v[k] for k in ('promulgated', 'lser', 'url', 'name', 'sha256') if k in v},
                            'articles': [{'no': no, 'text': prev['texts'][h]} for no, h in arts.items()]}
            old = []
            if a.offline and not prev:
                continue
            for lnndate, lser in (sorted(stored) if a.offline else listing(code)):
                v = stored.get((lnndate, lser))
                if not v or not v.get('articles'):
                    url = f'{BASE}LawOldVer.aspx?pcode={code}&lnndate={lnndate}&lser={lser}'
                    for attempt in range(3):
                        raw = fetch(url)
                        try:
                            name, modified, arts = parse_version(raw)
                            break
                        except ValueError as error:
                            if attempt == 2:
                                Path('/tmp/law-version-failed.html').write_bytes(raw)
                                raise ValueError(f'{error}: {url}')
                            time.sleep(5 * (attempt + 1))
                    v = {'promulgated': f'{lnndate[:4]}-{lnndate[4:6]}-{lnndate[6:]}', 'lser': lser, 'url': url, 'name': name,
                         'sha256': hashlib.sha256(raw).hexdigest(), 'articles': arts}
                    time.sleep(a.delay)
                old.append(v)
            texts, versions, timeline = build(law, old)
            doc = {'law': code, 'name': law['name'], 'source': BASE + 'LawOldVerList.aspx?pcode=' + code,
                   'note': '歷次版本取自全國法規資料庫「歷史法規」（網站表示提供民國 90 年 4 月以後修正的完整舊條文）；施行日依沿革判斷，判斷不出的標 effectiveKnown／fromKnown false，不推測。條號是各版本當時的條號。',
                   'currentPromulgated': law['modified'], 'currentHash': current_hash, 'texts': texts, 'versions': versions, 'articles': timeline}
            path.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
            done += 1
            print(code, law['name'], len(versions), 'versions', flush=True)
        except Exception as error:
            failures.append({'law': code, 'reason': str(error)})
            print('FAILED', code, error, file=sys.stderr, flush=True)
    write_index(laws)
    print(json.dumps({'updated': done, 'failures': failures}, ensure_ascii=False))
    if failures and len(failures) > max(3, done // 10):
        sys.exit(1)


def write_index(laws):
    entries = {}
    for path in sorted(OUT.glob('[A-Z]*.json')):
        d = json.loads(path.read_text(encoding='utf-8'))
        unknown = sum(1 for v in d['versions'] if not v['effectiveKnown'])
        entries[d['law']] = {'name': d['name'], 'versions': len(d['versions']), 'oldest': d['versions'][0]['promulgated'],
                             'current': d['currentPromulgated'], 'unknownEffective': unknown, 'bytes': path.stat().st_size}
    (OUT / 'index.json').write_text(json.dumps({'schemaVersion': 1, 'laws': entries}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
