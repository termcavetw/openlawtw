#!/usr/bin/env python3
"""Letters that other letters or 桃園 minutes cite but no collected source carries, added one by one from their
official pages -> public/data/supplement-rulings.json (merged into the 部會函釋 archive by prepare-data).

Each letter's official page is preserved under data/sources/supplement/<site>/ and parsed here:
  moj/      法務部主管法規查詢系統 (mojlaw.moj.gov.tw) LawContentExShow.aspx: 法規諮詢意見／行政函釋
  gazette/  行政院公報資訊網 (gazette.nat.gov.tw) detail.do: 令 published in the 公報
  gcis/     商工行政法規檢索系統 (gcis.nat.gov.tw/elaw) constructionDetail: 經濟部商業發展署 行政函釋
Articles a letter names (「<law>第N條」, Chinese or Arabic numerals) are filed with cited=True, so prepare-data links
them only when the letter is not older than the law's last full-text revision.
"""
import hashlib, html, json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'data/sources/supplement'
OUT = ROOT / 'public/data/supplement-rulings.json'
NUMS = '零一二三四五六七八九'


def cn2int(s):
    s = s.strip()
    if s.isdigit():
        return int(s)
    total, num = 0, 0
    for ch in s:
        if ch in NUMS or ch == '〇':
            num = 0 if ch in '零〇' else NUMS.index(ch)
        elif ch == '十':
            total += (num or 1) * 10; num = 0
        elif ch == '百':
            total += (num or 1) * 100; num = 0
    return total + num


def text_of(fragment):
    t = re.sub(r'<br\s*/?>', '\n', fragment)
    t = html.unescape(re.sub(r'<[^>]+>', '', t))
    return '\n'.join(l.rstrip() for l in t.replace('\r', '').split('\n')).strip()


def iso(roc):
    m = re.search(r'(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', roc)
    return f'{int(m.group(1)) + 1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}' if m else ''


LAW_NAMES = sorted({l['name'] for l in json.loads((ROOT / 'public/data/laws.json').read_text(encoding='utf-8')).values() if l.get('region') == '中央'},
                   key=len, reverse=True)
CITE = re.compile('(' + '|'.join(map(re.escape, LAW_NAMES)) + r')」?(?:（[^）]{0,20}）)?\s*第\s*([0-9一二三四五六七八九十百〇零]+)\s*條(?:\s*之\s*([0-9一二三四五六七八九十]+))?')


def cites(text):
    t = unicodedata.normalize('NFKC', re.sub(r'\s+', '', text)).replace('(', '（').replace(')', '）')
    out = []
    for law, n, sub in CITE.findall(t):
        no = cn2int(n)
        f = {'law': law, 'article': f'第 {no}{"-" + str(cn2int(sub)) if sub else ""} 條', 'cited': True}
        if no and f not in out:
            out.append(f)
    # laws named without an article: filed under the law itself
    for law in LAW_NAMES:
        if len(law) >= 3 and re.search(re.escape(law) + '(?![規令施細])', t) and not any(law in f['law'] for f in out):
            out.append({'law': law, 'article': '', 'cited': True})
    return out


def moj(path):
    s = path.read_text(encoding='utf-8')
    field = lambda name: text_of(re.search(r'<div class="col-th">' + name + r'：</div>\s*<div class="col-td[^"]*">([\s\S]*?)</div>', s).group(1))
    gist = re.search(r'<div id="cp_content_EDATAtr"[\s\S]*?<pre[^>]*>([\s\S]*?)</pre>', s)
    full = re.search(r'<div id="cp_content_EFULLtr"[\s\S]*?<pre[^>]*>([\s\S]*?)</pre>', s)
    kind = '法規諮詢意見' if '法規諮詢意見</h2>' in s or '<li>法規諮詢意見</li>' in s else '行政函釋'
    id_ = path.stem
    etype = 'etype3' if kind == '法規諮詢意見' else 'etype5'
    doc = re.sub(r'\s+', '', field('發文字號'))
    body = text_of(full.group(1)) if full else ''
    summary = re.sub(r'\s+', '', text_of(gist.group(1))) if gist else ''
    return {'id': 'S' + id_, 'date': iso(field('發文日期')), 'docNo': doc, 'issuer': re.sub(r'\s+', '', field('發文單位')),
            'summary': summary, 'body': body or summary, 'filed': cites(summary + body), 'refs': [], 'topics': [],
            'url': f'https://mojlaw.moj.gov.tw/LawContentExShow.aspx?id={id_}&type=E&etype={etype}',
            'origin': f'法務部主管法規查詢系統（{kind}；資料來源：{re.sub(chr(10), "；", field("資料來源"))}）'}


# 行政院公報 issue file -> its detail page (metaid), recorded when the letter was looked up
GAZETTE = {'eg019124-gov10-num1.htm': ('61977', 'https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg019124/ch02/type2/gov10/num1/Eg.htm')}
ROC = re.compile(r'中華民國\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日')


def gazette(path):
    raw = path.read_bytes()
    s = raw.decode('big5', errors='strict') if b'charset=big5' in raw.lower() or not raw.startswith(b'\xef\xbb\xbf') else raw.decode('utf-8')
    t = text_of(re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>', '', s))
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    start = next(i for i, l in enumerate(lines) if re.fullmatch(r'\S{2,10}令', l))
    issuer = lines[start][:-1]
    date = ROC.search(lines[start + 1])
    doc = re.sub(r'\s+', '', lines[start + 2]) + '令'
    body_lines = lines[start + 3:]
    end = next((i for i, l in enumerate(body_lines) if l.startswith('行政院公報') or l.startswith('對於本網站')), len(body_lines))
    body_lines = body_lines[:end]
    # numbered items printed on their own line ("(一)", "１、") join the text that follows
    merged = []
    for l in body_lines:
        if merged and re.fullmatch(r'[\(（][一二三四五六七八九十]+[\)）]|[０-９0-9]+、', merged[-1]):
            merged[-1] += l
        else:
            merged.append(l)
    metaid, url = GAZETTE[path.name]
    body = '\n'.join(merged)
    return {'id': 'G' + metaid, 'date': f'{int(date.group(1)) + 1911:04d}-{int(date.group(2)):02d}-{int(date.group(3)):02d}', 'docNo': doc,
            'issuer': issuer, 'summary': merged[0], 'body': body, 'filed': cites(body), 'refs': [], 'topics': [],
            'url': f'https://gazette.nat.gov.tw/egFront/detail.do?metaid={metaid}&log=detailLog',
            'origin': f'行政院公報資訊網（{url}）'}


def build():
    items, files = [], []
    for site, parse in (('moj', moj), ('gazette', gazette)):
        for path in sorted([*(SRC / site).glob('*.html'), *(SRC / site).glob('*.htm')]):
            x = parse(path)
            assert x['date'] and x['docNo'] and x['body'], path
            items.append(x)
            files.append({'file': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    items.sort(key=lambda x: (x['date'], x['id']), reverse=True)
    assert len({x['id'] for x in items}) == len(items)
    doc = {'source': '被其他函釋引用、原本未收的函：各機關官方網站逐則補收', 'fetchedAt': '2026-11-27',
           'note': '這些函是 openlawtw 其他函釋或桃園市會議紀錄引用、但各來源未收全文者，從發文機關或其主管法規系統的官方頁面逐則補收；不是該機關的完整收錄。',
           'files': files, 'items': items}
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(len(items), 'letters')


if __name__ == '__main__':
    build()
