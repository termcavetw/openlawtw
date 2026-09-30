"""Strict, network-free parser for MOJ's official LawAll/LawHistory HTML.

Use downloaded bytes, not browser text: provenance hashes the exact response.
Caller supplies the actual retrieval time (cached file time or saved metadata).
Article lines retain their text, whitespace and order; DOM line boundaries become
newlines. No Unicode normalization, paraphrasing, or inferred effective date.
"""
from copy import deepcopy
from datetime import date, datetime
import hashlib
import re
from urllib.parse import parse_qs, urljoin, urlparse
from lxml import html

BASE = 'https://law.moj.gov.tw/LawClass/'


def _class(name):
    return "contains(concat(' ', normalize-space(@class), ' '), ' " + name + " ')"


def _compact(text):
    return re.sub(r'\s+', ' ', text).strip()


def _text(node, *, trim=True):
    """Preserve inline text and explicit line breaks, not markup indentation."""
    node = deepcopy(node)
    for br in node.xpath('.//br'):
        br.tail = '\n' + (br.tail or '')
    text = node.text_content()
    return text.strip('\r\n\t ') if trim else text


def _date(text):
    m = re.search(r'民國\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日', text)
    if not m:
        raise ValueError('Unrecognized official ROC date: ' + text)
    y, mth, d = map(int, m.groups())
    return date(y + 1911, mth, d).isoformat()


def _tree(raw, code, expected_name):
    if not isinstance(raw, bytes):
        raise TypeError('Raw HTML must be bytes for reproducible provenance')
    tree = html.fromstring(raw, parser=html.HTMLParser(encoding='utf-8'))
    names = tree.xpath('//*[@id="hlLawName"]')
    if len(names) != 1 or _compact(names[0].text_content()) != expected_name:
        raise ValueError('Official law name does not match ' + expected_name)
    linked_code = parse_qs(urlparse(names[0].get('href', '')).query).get('pcode', [])
    if linked_code != [code]:
        raise ValueError('Official law code does not match ' + code)
    return tree


def _provenance(raw, url, retrieved):
    if not retrieved or datetime.fromisoformat(retrieved.replace('Z', '+00:00')).tzinfo is None:
        raise ValueError('An actual timezone-aware retrieval timestamp is required')
    return dict(url=url, format='html', sha256=hashlib.sha256(raw).hexdigest(),
                hashScope='downloaded-html-file', observedAt=retrieved)


def parse_law_history(raw_html, code, expected_name):
    """Return source-order history text, excluding historical links and buttons."""
    tree = _tree(raw_html, code, expected_name)
    cells = tree.xpath('//*[' + _class('law-history') + ']//*[' + _class('text-pre') + ']')
    if not cells or any(not _text(cell) for cell in cells):
        raise ValueError('Official history text is missing')
    return '\n'.join(_text(cell) for cell in cells)


def parse_law_all(raw_html, code, expected_name, *, retrieved,
                  history_html=None, history_retrieved=None):
    """Return schema-compatible law fields plus ``provenance`` for the caller.

    category/kind remain caller-owned; the HTML does not reliably identify kind.
    History is empty unless its actual official HTML is supplied. ``effective``
    stays empty: a notice about the last effective date is not a single effective
    date for the entire law. The explicit 生效狀態 row is retained as effectiveNote.
    Optional history evidence is nested under provenance['history'].
    """
    if not re.fullmatch(r'[A-Z]\d{7}', code):
        raise ValueError('Invalid MOJ law code')
    tree = _tree(raw_html, code, expected_name)
    url = BASE + 'LawAll.aspx?pcode=' + code
    provenance = _provenance(raw_html, url, retrieved)
    table = tree.xpath('//*[@id="hlLawName"]/ancestor::table[1]')[0]
    metadata = {}
    for row in table.xpath('./tr|./tbody/tr'):
        keys, values = row.xpath('./th'), row.xpath('./td')
        if keys and values:
            metadata[_compact(keys[0].text_content()).rstrip('：:')] = values[0]
    if any(k in metadata for k in ('廢止日期', '停止適用日期')):
        raise ValueError('Inactive official law must not be imported as current')
    date_cell = metadata.get('修正日期')
    if date_cell is None:
        date_cell = metadata.get('公布日期')
    if date_cell is None:
        raise ValueError('Official modification/promulgation date is missing')
    modified = _date(date_cell.text_content())
    effective_note = ''
    if '生效狀態' in metadata:
        note = deepcopy(metadata['生效狀態'])
        for link in note.xpath('.//a'):
            link.drop_tree()  # Navigation labels are not part of the notice.
        blocks = note.xpath('./p|./div')
        effective_note = '\n'.join(_text(x) for x in blocks if _text(x)) if blocks else _text(note)
    containers = tree.xpath('//*[@id="pnLawFla"]/*[' + _class('law-reg-content') + ']')
    if len(containers) != 1:
        raise ValueError('Official full-law container is missing or ambiguous')
    articles, path, seen = [], [], set()
    for node in containers[0]:
        classes = node.get('class', '').split()
        if any(re.fullmatch(r'char-\d+', c) for c in classes):
            label = _compact(node.text_content())
            match = re.match(r'^第\s*[\d一二三四五六七八九十百千零〇兩\s]+([編章節款目])', label)
            if not match:
                raise ValueError('Unrecognized chapter heading: ' + label)
            level = '編章節款目'.index(match.group(1))
            path = [(n, s) for n, s in path if n < level] + [(level, label)]
            continue
        if 'row' not in classes:
            if _compact(node.text_content()):
                raise ValueError('Unrecognized content in full-law container')
            continue
        numbers = node.xpath('./*[' + _class('col-no') + ']/a[contains(@href,"LawSingle.aspx")]')
        bodies = node.xpath('./*[' + _class('col-data') + ']/*[' + _class('law-article') + ']')
        if len(numbers) != 1 or len(bodies) != 1:
            raise ValueError('Incomplete official article row')
        no = _compact(numbers[0].text_content())
        if not re.fullmatch(r'第\s*\d+(?:-\d+)?\s*條(?:之\s*\d+)?', no) or no in seen:
            raise ValueError('Invalid or duplicate official article number: ' + no)
        body = bodies[0]
        lines = list(body)
        # MOJ emits a decorative trailing <br> on some long articles.
        while lines and lines[-1].tag == 'br' and not (lines[-1].tail or '').strip():
            lines.pop()
        if not lines or (body.text or '').strip() or any(
            n.tag != 'div' or not any(re.fullmatch(r'line-\d+', c) for c in n.get('class', '').split())
            or (n.tail or '').strip() for n in lines
        ):
            raise ValueError('Unrecognized official article line structure: ' + no)
        text = '\n'.join(_text(line, trim=False) for line in lines)
        if not text.strip():
            raise ValueError('Empty official article: ' + no)
        seen.add(no)
        articles.append(dict(no=no, text=text, path=[s for _, s in path]))
    if not articles:
        raise ValueError('No official articles found')
    attachments = []
    for link in table.xpath('.//a[contains(@href,"LawGetFile.ashx")]'):
        attachment = dict(title=_compact(link.text_content()) or '附件', url=urljoin(url, link.get('href')))
        if attachment not in attachments:
            attachments.append(attachment)
    snapshot = ''
    cutoff = tree.xpath('//li[contains(.,"法規整編資料截止日")]')
    if cutoff:
        snapshot = _date(cutoff[0].text_content())
    history = ''
    if history_html is not None:
        history = parse_law_history(history_html, code, expected_name)
        provenance['history'] = _provenance(history_html, BASE + 'LawHistory.aspx?pcode=' + code,
                                             history_retrieved or retrieved)
    return dict(id=code, name=expected_name, region='中央', url=url, source='全國法規資料庫',
                coverage='full', modified=modified, effective='', effectiveNote=effective_note,
                snapshot=snapshot, retrieved=retrieved, status='來源未標廢止', articles=articles,
                history=history, attachments=attachments, keywords=[], provenance=provenance)
