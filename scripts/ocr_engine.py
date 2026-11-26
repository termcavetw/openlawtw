"""OCR for scanned pages (Taoyuan minutes and 土管要點).

PaddleOCR (PP-OCRv6 medium detection and recognition, traditional Chinese)
reads these scans far better than Tesseract: percentages, dates and document numbers that
Tesseract garbled (260% -> 26096, 99年 -> 9年) come out right. Its recognizer sometimes
emits a simplified form; only characters that do not exist in Big5 are mapped back to
traditional, so valid traditional characters (准, 台, 后) are never rewritten.

Text boxes on the same visual row are joined with " | " (table cells, side-by-side
columns); rows are separated by newlines. If PaddleOCR is not installed or fails on a
page, Tesseract (chi_tra, --psm 6) is used for that page so a sync never stops.
"""
from pathlib import Path
import subprocess, tempfile, threading

PADDLE = {'lang': 'chinese_cht', 'text_detection_model_name': 'PP-OCRv6_medium_det',
          'text_recognition_model_name': 'PP-OCRv6_medium_rec', 'use_doc_orientation_classify': False,
          'use_doc_unwarping': False, 'use_textline_orientation': False, 'enable_mkldnn': False}
_engine = None
_failed = False
_lock = threading.Lock()


def _paddle():
    global _engine, _failed
    if _engine is None and not _failed:
        try:
            from paddleocr import PaddleOCR
            _engine = PaddleOCR(**PADDLE)
        except Exception as error:  # not installed or models unavailable: Tesseract for this run
            _failed = True
            print(f'ocr: PaddleOCR unavailable, using Tesseract ({error})')
    return _engine


def _big5(ch):
    try:
        ch.encode('big5')
        return True
    except UnicodeEncodeError:
        return False


_s2t = None


def to_traditional(text):
    """Map characters missing from Big5 (simplified-only forms) to traditional; keep the rest."""
    global _s2t
    if _s2t is None:
        try:
            from opencc import OpenCC
            _s2t = OpenCC('s2t').convert
        except Exception:
            _s2t = False
    if not _s2t:
        return text
    out = []
    for ch in text:
        if ord(ch) > 0x2E7F and not _big5(ch):
            t = _s2t(ch)
            out.append(t if len(t) == 1 and _big5(t) else ch)
        else:
            out.append(ch)
    return ''.join(out)


def row_lines(texts, boxes):
    """Group recognised boxes [x0, y0, x1, y1] into visual rows, left to right: [(mid_y, text)]."""
    items = sorted(zip(texts, boxes), key=lambda tb: ((tb[1][1] + tb[1][3]) / 2, tb[1][0]))
    lines = []
    for text, box in items:
        mid = (box[1] + box[3]) / 2
        if lines and abs(mid - lines[-1]['mid']) <= 0.5 * min(box[3] - box[1], lines[-1]['h']):
            lines[-1]['cells'].append((box[0], text))
        else:
            lines.append({'mid': mid, 'h': box[3] - box[1], 'cells': [(box[0], text)]})
    return [(line['mid'], ' | '.join(t for _, t in sorted(line['cells']))) for line in lines]


def rows(texts, boxes):
    return '\n'.join(text for _, text in row_lines(texts, boxes))


def paddle_text(png):
    engine = _paddle()
    if engine is None:
        raise RuntimeError('PaddleOCR unavailable')
    with _lock:  # the predictor is not thread-safe
        result = engine.predict(str(png))[0]
    texts = list(result['rec_texts'])
    boxes = [list(map(float, b)) for b in result['rec_boxes']]
    return to_traditional(rows(texts, boxes))


def tesseract_text(png):
    result = subprocess.run(['tesseract', str(png), '-', '-l', 'chi_tra', '--psm', '6'],
                            capture_output=True, check=True, timeout=300)
    return result.stdout.decode('utf-8', 'ignore')


def render(pdf, page, out):
    subprocess.run(['pdftoppm', '-r', '200', '-f', str(page), '-l', str(page), '-png', '-singlefile',
                    str(pdf), str(out)], capture_output=True, check=True)
    return Path(str(out) + '.png')


def ocr_page(pdf, page):
    """(text, engine) for one PDF page."""
    with tempfile.TemporaryDirectory() as work:
        png = render(pdf, page, Path(work) / 'page')
        try:
            return paddle_text(png), 'paddle'
        except Exception as error:
            if not _failed:
                print(f'ocr: PaddleOCR failed on {Path(pdf).name} p{page}, using Tesseract ({error})')
            return tesseract_text(png), 'tesseract'


# --- Tables -------------------------------------------------------------------------------------------
# PaddleOCR's table pipeline (layout detection + table structure + cell OCR) rebuilds tables with merged
# cells. A page keeps its text; each table is stored with the range of text lines it covers so a reader
# can draw the table in their place (lines from..to-1), and search still sees the text.
_table = None
_table_failed = False


def _table_engine():
    global _table, _table_failed
    if _table is None and not _table_failed:
        try:
            from paddleocr import TableRecognitionPipelineV2
            _table = TableRecognitionPipelineV2(
                use_doc_orientation_classify=False, use_doc_unwarping=False, enable_mkldnn=False,
                text_detection_model_name=PADDLE['text_detection_model_name'],
                text_recognition_model_name=PADDLE['text_recognition_model_name'])
        except Exception as error:
            _table_failed = True
            print(f'ocr: table recognition unavailable ({error})')
    return _table


def parse_table_html(markup):
    """<table> HTML -> rows of cells; a cell is [text] or [text, colspan, rowspan] when merged."""
    from html.parser import HTMLParser
    import re as _re

    class P(HTMLParser):
        def __init__(self):
            super().__init__(); self.rows = []; self.cell = None
        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if tag == 'tr':
                self.rows.append([])
            elif tag in ('td', 'th') and self.rows:
                self.cell = [[], int(a.get('colspan') or 1), int(a.get('rowspan') or 1)]
        def handle_endtag(self, tag):
            if tag in ('td', 'th') and self.cell is not None:
                text = ''.join(self.cell[0])
                text = _re.sub(r'(?<=[\u2e80-\u9fff\uff00-\uffef])\s+(?=[\u2e80-\u9fff\uff00-\uffef])', '', text)
                text = to_traditional(_re.sub(r'\s+', ' ', text).strip())
                c, r = self.cell[1], self.cell[2]
                self.rows[-1].append([text] if c == 1 and r == 1 else [text, c, r])
                self.cell = None
        def handle_data(self, data):
            if self.cell is not None:
                self.cell[0].append(data)

    parser = P(); parser.feed(markup)
    return [r for r in parser.rows if r]


def _tokens(line):
    import re as _re
    return [t for t in _re.split(r'\s*\|\s*|\s{2,}', line.strip()) if t]


def _norm(s):
    import re as _re, unicodedata
    return _re.sub(r'[\s|]+', '', unicodedata.normalize('NFKC', s))  # text layers often use full-width ％ and digits


def lines_covered(lines, table_text):
    """Range of page lines (text-layer pages) that belong to a table: a line belongs when most of its character
    pairs occur in the table's OCR text; blank lines and single stray lines inside the run are absorbed."""
    pairs = {table_text[i:i + 2] for i in range(len(table_text) - 1)}

    def score(line):
        t = _norm(line)
        if len(t) < 2:
            return None  # blank or one character: neutral
        return sum(t[i:i + 2] in pairs for i in range(len(t) - 1)) / (len(t) - 1)
    marks = [score(l) for l in lines]
    best, i = (0, 0), 0
    while i < len(lines):
        if marks[i] is None or marks[i] < 0.6:
            i += 1
            continue
        j, last, misses = i, i, 0
        while j + 1 < len(lines):
            m = marks[j + 1]
            if m is None:
                j += 1
            elif m >= 0.6:
                j += 1; last = j; misses = 0
            elif misses == 0:
                j += 1; misses = 1
            else:
                break
        if last + 1 - i > best[1] - best[0]:
            best = (i, last + 1)
        i = last + 1
    return best


def table_page(pdf, page, text=None):
    """Tables on one page. With text=None the page text is rebuilt from the same OCR pass and returned, and each
    table covers the text lines inside its box; with text (a text-layer page) tables are matched to its lines.
    Returns (text, [{'from', 'to', 'rows'}]) or None when the table model is unavailable or fails."""
    engine = _table_engine()
    if engine is None:
        return None
    import re as _re
    with tempfile.TemporaryDirectory() as work:
        png = render(pdf, page, Path(work) / 'page')
        try:
            with _lock:
                result = engine.predict(str(png))[0].json['res']
        except Exception as error:
            print(f'ocr: table recognition failed on {Path(pdf).name} p{page} ({error})')
            return None
    found = []
    for table in result.get('table_res_list') or []:
        rows = parse_table_html(table.get('pred_html') or '')
        boxes = table.get('cell_box_list') or []
        if not boxes or not plausible_table(rows):
            continue
        found.append((min(b[1] for b in boxes), max(b[3] for b in boxes), rows))
    if text is None:
        ocr = result['overall_ocr_res']
        lines = row_lines(list(ocr['rec_texts']), [list(map(float, b)) for b in ocr['rec_boxes']])
        page_lines = [to_traditional(t) for _, t in lines]
        tables = []
        for y0, y1, rows in found:
            inside = [i for i, (mid, _) in enumerate(lines) if y0 - 4 <= mid <= y1 + 4]
            if inside:
                tables.append({'from': inside[0], 'to': inside[-1] + 1, 'rows': rows})
        return '\n'.join(page_lines), without_overlaps(tables)
    page_lines = text.split('\n')
    tables = []
    for _, _, rows in found:
        flat = _norm(''.join(c[0] for r in rows for c in r))
        a, b = lines_covered(page_lines, flat)
        if b - a >= 2:
            tables.append({'from': a, 'to': b, 'rows': rows})
    return text, without_overlaps(tables)


def plausible_table(rows):
    """A real table, not prose the model boxed: at least two rows of two or more filled cells, and short cells
    (zoning tables hold names, numbers and short rules; boxed paragraphs give one long sentence per cell)."""
    filled = [c[0] for r in rows for c in r if c[0].strip()]
    if sum(sum(1 for c in r if c[0].strip()) >= 2 for r in rows) < 2 or len(filled) < 4:
        return False
    sizes = sorted(len(t) for t in filled)
    if max(sum(1 for c in r if c[0].strip()) for r in rows) > 12:
        return False  # a column of vertical text boxed as one wide row
    import re as _re
    head = ''.join(c[0] for c in rows[0])
    if _re.search(r'條文|要點內容|理由|說明', head) and sizes[len(sizes) // 2] > 10:
        return False  # 條文對照表: wrapped prose in columns, which the model mixes between cells; the page text reads better
    return sizes[len(sizes) // 2] <= 24 and sum(n > 30 for n in sizes) <= 0.4 * len(sizes)


def without_overlaps(tables):
    """Keep tables whose line ranges do not overlap a larger one."""
    kept = []
    for t in sorted(tables, key=lambda t: t['to'] - t['from'], reverse=True):
        if all(t['to'] <= k['from'] or t['from'] >= k['to'] for k in kept):
            kept.append(t)
    return sorted(kept, key=lambda t: t['from'])
