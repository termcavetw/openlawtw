"""Import 內政部地政司 interpretations (地政法令彙編 解釋函) from an export of
https://www.land.moi.gov.tw/law/Explainqry/99 saved as a .doc (HTML inside).

www.land.moi.gov.tw does not answer this project's networks, so the export is downloaded by
hand and preserved gzip-compressed in data/sources/. Each law-article section carries the
article's latest text and the letters filed under it; a letter filed under several articles
becomes one record with several refs. Re-run with a newer export to update.
"""
from pathlib import Path
import argparse, gzip, hashlib, html, json, re, sys
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'public/data/land-rulings.json'
EXPORT = ROOT / 'data/sources/land-moi-explain-export.html.gz'
SOURCE = '內政部地政司 地政法令彙編 解釋函（www.land.moi.gov.tw）'
SOURCE_URL = 'https://www.land.moi.gov.tw/law/Explainqry/99'
NOTE = ('內政部地政司「地政法令彙編」依法規條文歸類的解釋函（含行政院、法務部等機關與地政有關的函），涵蓋土地法、土地登記規則、平均地權條例、'
        '地籍測量實施規則、非都市土地使用管制規則、耕地分割執行要點等。彙編是地政司整理的版本，部分內容有刪節或附註；個案適用以主管機關認定為準，'
        '之後的法規修正或較新的函釋可能改變見解，引用前請確認。')
FIELDS = ('id', 'date', 'docNo', 'issuer', 'summary', 'body', 'refs')
MIN_ITEMS = 3000


def text(fragment):
    fragment = re.sub(r'<br\s*/?>', '\n', fragment, flags=re.I)
    value = html.unescape(re.sub(r'<[^>]+>', '', fragment)).replace('\r', '').replace('\xa0', ' ')
    lines = [l.strip() for l in value.split('\n')]
    return re.sub(r'\n{2,}', '\n', '\n'.join(lines)).strip()


CN = '〇一二三四五六七八九'
NUM = r'[\d〇○零一二三四五六七八九十百廿]+'
ROC = re.compile(r'^(.*?)(?:中華民國)?\s*(' + NUM + r')\s*年\s*(' + NUM + r')\s*月\s*(' + NUM + r')\s*日?\s*(.*)$')


def number(value):
    """76, 七十六, 一○七, 八 -> int."""
    value = value.replace('○', '〇').replace('零', '〇').replace('廿', '二十')
    if value.isdigit():
        return int(value)
    if '十' in value or '百' in value:
        n = cur = 0
        for ch in value:
            if ch in CN:
                cur = CN.index(ch)
            elif ch == '十':
                n += (cur or 1) * 10; cur = 0
            elif ch == '百':
                n += (cur or 1) * 100; cur = 0
        return n + cur
    return int(''.join(str(CN.index(ch)) for ch in value))


def head_line(line):
    """「內政部88年12月2日台內中地字第8823288號函」「內政部七十六年十月二十一日台（七六）內地字第…號函」 -> issuer, ISO date, number."""
    import unicodedata
    line = unicodedata.normalize('NFKC', line).replace('曰', '日')
    m = ROC.match(line.strip())
    if not m:
        return line.strip(), '', ''
    try:
        day = date(number(m[2]) + 1911, number(m[3]), number(m[4])).isoformat()
    except ValueError:
        day = ''
    return re.sub(r'中華民國$', '', m[1].strip()).strip(), day, re.sub(r'\s+', '', m[5])


def article_no(raw):
    """《第3.1條》 -> 第 3-1 條 (the site writes 之 as a decimal point)."""
    m = re.fullmatch(r'第(\d+)(?:\.(\d+))?([條點])', raw)
    return f'第 {m[1]}{"-" + m[2] if m[2] else ""} {m[3]}' if m else raw


def parse(page):
    items, sections = {}, []
    for box in page.split("<div class='main3box'>")[1:]:
        title = re.search(r"<div class='main_title'><a href='([^']*)'[^>]*>(.*?)</a>", box, re.S)
        if not title:
            continue
        m = re.fullmatch(r'(.+?) 《(.+?)》', text(title[2]))
        if not m:
            continue
        law, no = m[1].strip(), article_no(m[2])
        latest = re.search(r'最新法規條文</STRONG></td></tr><tr><td></td><td>(.*?)</td>', box, re.S)
        sections.append({'law': law, 'article': no, 'text': text(latest[1]) if latest else '', 'url': html.unescape(title[1])})
        for letter in box.split("<STRONG class='icon_t'>")[1:]:
            fields = dict((text(k), v) for k, v in re.findall(r"<div class='main_span'><span>(.*?)</span>(.*?)</div>", letter, re.S))
            if '公布日期文號' not in fields:
                continue
            head = text(fields['公布日期文號'])
            issuer, day, number = head_line(head)
            summary, body = text(fields.get('要旨', '')), text(fields.get('內容', ''))
            key = hashlib.sha256((head + '\n' + summary + '\n' + body).encode()).hexdigest()[:12]
            item = items.setdefault(key, {'id': key, 'date': day, 'docNo': number, 'issuer': issuer, 'summary': summary, 'body': body, 'refs': []})
            ref = {'law': law, 'article': no}
            if ref not in item['refs']:
                item['refs'].append(ref)
    return sorted(items.values(), key=lambda it: (it['date'], it['id']), reverse=True), sections


def build(path):
    raw = Path(path).read_bytes()
    page = raw.decode('utf-8')
    items, sections = parse(page)
    if len(items) < MIN_ITEMS:
        raise SystemExit(f'only {len(items)} letters parsed')
    undated = [it['id'] for it in items if not it['date']]
    laws = {}
    for it in items:
        for r in it['refs']:
            laws[r['law']] = laws.get(r['law'], 0) + 1
    return {'source': SOURCE, 'sourceUrl': SOURCE_URL, 'note': NOTE, 'issuer': '內政部地政司',
            'export': {'file': EXPORT.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)},
            'fetchedAt': '', 'stats': {'items': len(items), 'sections': len(sections), 'undated': len(undated),
                                       'laws': [{'name': k, 'items': v} for k, v in sorted(laws.items(), key=lambda x: -x[1])]},
            'items': [{k: it[k] for k in FIELDS} for it in items]}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('export', nargs='?', help='a new export (.doc); default: re-parse the preserved one')
    p.add_argument('--date', required=True, help='the day the export was downloaded (YYYY-MM-DD)')
    a = p.parse_args(argv)
    if a.export:
        EXPORT.write_bytes(gzip.compress(Path(a.export).read_bytes(), 9, mtime=0))
    tmp = ROOT / '.land-export.html'
    tmp.write_bytes(gzip.decompress(EXPORT.read_bytes()))
    try:
        archive = build(tmp)
    finally:
        tmp.unlink()
    archive['fetchedAt'] = a.date
    ARCHIVE.write_text(json.dumps(archive, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    s = archive['stats']
    print(f'{s["items"]} letters in {s["sections"]} law-article sections, {len(s["laws"])} laws, {s["undated"]} undated')


if __name__ == '__main__':
    sys.exit(main())
