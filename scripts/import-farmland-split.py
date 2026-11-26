"""Add 耕地分割執行要點 (內政部, 105.05.06 修正全文 14 點) as a reviewed formal source.

The 內政部主管法規查詢系統 (glrs.moi.gov.tw) times out from this project's networks, and the
amendment was not found as a 行政院公報 PDF. The text comes from the 105年5月6日台內地字第
1051303449號令「耕地分割執行要點修正規定」as posted by 彰化縣政府地政處 (preserved byte for byte
in data/formal-sources/FL014320.odt): only the 修正規定 part, before the 總說明 and 對照表.
It was checked against glrs.moi.gov.tw (via a fetch service): 修正日期 105.05.06, 14 points,
each point's opening words the same. Idempotent: re-running replaces only this record.
"""
from pathlib import Path
import hashlib, html, json, re, zipfile

ROOT = Path(__file__).resolve().parents[1]
ID = '內政部-FL014320'
FILE = 'data/formal-sources/FL014320.odt'
SOURCE_URL = 'https://landoffice.chcg.gov.tw/files/%E4%BF%AE%E6%AD%A3%E3%80%8C%E8%80%95%E5%9C%B0%E5%88%86%E5%89%B2%E5%9F%B7%E8%A1%8C%E8%A6%81%E9%BB%9E%E3%80%8D_127_1080610.odt'
OFFICIAL = 'https://glrs.moi.gov.tw/LawContent.aspx?id=FL014320'
STAMP = '2026-11-26T17:45:00+00:00'
NUMS = '一二三四五六七八九十'


def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def write(path, value):
    compact = path in ('public/data/laws.json', 'data/catalog.json', 'public/data/catalog.json')
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) if compact else json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def cn(n):
    return NUMS[n - 1] if n <= 10 else '十' + (NUMS[n - 11] if n > 10 else '')


def points(raw):
    """The 修正規定 part of the ODT: one list item per point; following paragraphs belong to it."""
    xml = zipfile.ZipFile(raw).read('content.xml').decode('utf-8')
    xml = re.sub(r'<text:tab/>', '\t', xml)
    xml = re.sub(r'<text:s(?: text:c="(\d+)")?/>', lambda m: ' ' * int(m.group(1) or 1), xml)
    xml = re.sub(r'</text:p>|</text:h>', '\n', xml)
    xml = xml.replace('<text:list-item>', '\n\x00')
    text = html.unescape(re.sub(r'<[^>]+>', '', xml))
    head, rest = text.split('\x00', 1)
    assert '耕地分割執行要點修正規定' in head and '中華民國105年5月6日台內地字第1051303449號令' in head
    body = rest[:rest.index('耕地分割執行要點修正總說明')]
    items = []
    for chunk in body.split('\x00'):
        lines = [l.strip() for l in chunk.split('\n') if l.strip()]
        items.append('\n'.join(lines))
    return items


def build():
    raw = ROOT / FILE
    items = points(raw)
    assert len(items) == 14, len(items)
    articles = [{'no': f'第{cn(i + 1)}點', 'text': t, 'path': []} for i, t in enumerate(items)]
    assert articles[3]['text'].endswith('其分割後每人所有每宗耕地面積應在零點二五公頃以上。')
    assert articles[13]['text'].startswith('已辦竣農地重劃之耕地')
    sources = read('data/provenance.json')
    sources['sources'][ID] = {'url': SOURCE_URL, 'sourcePage': OFFICIAL, 'format': 'odt', 'file': FILE,
                              'sha256': hashlib.sha256(raw.read_bytes()).hexdigest(), 'hashScope': 'downloaded-odt-file', 'observedAt': STAMP,
                              'textMethod': 'ODT content.xml 原生文字；只取「修正規定」部分（總說明與對照表之前），保留每點文字與款次換行。',
                              'verification': '比對內政部主管法規查詢系統：修正日期105年5月6日、共14點、各點開頭文字相同；另與內政部地政司「地政法令彙編」匯出檔所附最新條文逐字比對第二、三、六至十三點一致（彙編將國字數字改為阿拉伯數字）。該站本專案網路連線逾時，未能下載原頁。'}
    law = dict(id=ID, name='耕地分割執行要點', region='中央', category='農業與山坡地', kind='行政規則', url=OFFICIAL,
               source='內政部（彰化縣政府地政處轉載之內政部令）', coverage='full', modified='2016-05-06', effective='2016-05-06',
               effectiveNote='105年5月6日修正全文14點（修正十一點、新增一點、刪除二點）。',
               snapshot='', retrieved=STAMP, status='已核對內政部主管法規查詢系統點次與內容；彙編頁本專案網路無法直接下載',
               articles=articles,
               history='89年7月19日內政部台(八九)內地字第8969684號函訂定；歷經五次修正，101年11月12日修正施行；105年5月6日台內地字第1051303449號令修正全文14點。',
               attachments=[{'title': '內政部主管法規查詢系統（官方）', 'url': OFFICIAL}, {'title': '105年修正規定、總說明及對照表（彰化縣政府地政處轉載）', 'url': SOURCE_URL}],
               keywords=['耕地分割', '農地分割', '零點二五公頃', '0.25公頃', '分割合併', '共有耕地分割', '繼承耕地分割', '農發條例第16條'],
               note='地政機關辦理農業發展條例第16條耕地分割的執行規定（行政規則）。正文依內政部105年5月6日令所附修正規定；已與內政部主管法規查詢系統比對點次與內容開頭。耕地以外的農業用地（如都市計畫農業區）不適用本要點。')
    formal = [r for r in read('data/formal-laws.json') if r['id'] != ID] + [law]
    write('data/formal-laws.json', formal)
    write('data/provenance.json', sources)
    laws = read('public/data/laws.json')
    laws[ID] = law
    write('public/data/laws.json', laws)
    entry = {**law, 'articleCount': len(articles), 'articles': [{'no': a['no'], 'text': '', 'path': a['path']} for a in articles], 'history': ''}
    for path in ('data/catalog.json', 'public/data/catalog.json'):
        catalog = read(path)
        catalog['laws'] = [l for l in catalog['laws'] if l['id'] != ID] + [entry]
        write(path, catalog)
    print('Imported', ID, len(articles), 'points')


if __name__ == '__main__':
    build()
