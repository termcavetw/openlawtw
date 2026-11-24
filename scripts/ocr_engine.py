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


def rows(texts, boxes):
    """Group recognised boxes [x0, y0, x1, y1] into visual rows, left to right."""
    items = sorted(zip(texts, boxes), key=lambda tb: ((tb[1][1] + tb[1][3]) / 2, tb[1][0]))
    lines = []
    for text, box in items:
        mid = (box[1] + box[3]) / 2
        if lines and abs(mid - lines[-1]['mid']) <= 0.5 * min(box[3] - box[1], lines[-1]['h']):
            lines[-1]['cells'].append((box[0], text))
        else:
            lines.append({'mid': mid, 'h': box[3] - box[1], 'cells': [(box[0], text)]})
    return '\n'.join(' | '.join(t for _, t in sorted(line['cells'])) for line in lines)


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
