#!/usr/bin/env python3
"""Derive the accessible specification's web reader from the pinned official PDF.

No OCR, paraphrasing, diagrams, or dimensions are generated. Text comes from PDF
characters; illustrations are lossless crops rendered from their original PDF
rectangles. The source PDF is never modified. Run with --check to verify an
existing derivation, including every native text line and embedded illustration.

Requires pdfplumber, pypdfium2 and Pillow. Output files are committed source data,
so these Python packages are not required by the website's normal build.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "data/documents/accessibility.pdf"
OUT = ROOT / "data/documents/readers/accessibility"
EXPECTED_SHA = "1ff0c1cc4cb27c6f74219bfb0d264cac056f88fe9109e36031c53cd6358c0245"
CHAPTER = re.compile(r"^(第[一二三四五六七八九十]+章\s*.+|附錄\s*[1-4]\s*.+)$")
NUMBER = re.compile(r"^(A?\d{3,4}(?:\.\d+)*)(?![\d.])\s*(.*)$")
CAPTION = re.compile(r"^[圖表]\s*A?\d{3,4}(?:\.\d+)*(?:\s.*)?$")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compact(value: str) -> str:
    return re.sub(r"\s+", "", value)


def native_lines(page):
    # The printed page number is a distinct footer at y=766.404 throughout the
    # body. Do not use a broad y cutoff: some original figures extend to y=762.5.
    return [line for line in page.extract_text_lines()
            if not (line["top"] > 760 and 280 < line["x0"] < 310
                    and re.fullmatch(r"\d+", line["text"]))]


def rect(items):
    return [min(x["x0"] for x in items), min(x["top"] for x in items),
            max(x["x1"] for x in items), max(x["bottom"] for x in items)]


def image_groups(page):
    # Adjacent drawings on the same row must retain their side-by-side layout
    # (notably the two drawings in each of the three figures on PDF page 63).
    groups = []
    for number, source in enumerate(page.images):
        item = dict(source, sourceImage=number)
        overlapping = [group for group in groups
                       if min(rect(group)[3], item["bottom"])
                       - max(rect(group)[1], item["top"]) > 2]
        if overlapping:
            base = overlapping[0]
            base.append(item)
            for extra in overlapping[1:]:
                base.extend(extra)
                groups.remove(extra)
        else:
            groups.append([item])
    return groups


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def convert():
    assert sha(PDF) == EXPECTED_SHA, "The official PDF changed; review it before updating this importer."
    OUT.mkdir(parents=True, exist_ok=True)
    figures = OUT / "figures"
    figures.mkdir(exist_ok=True)
    provenance = read_json(ROOT / "data/documents/catalog.json")["內政部-GL000734"]
    document = {
        "schemaVersion": 1, "lawId": "內政部-GL000734",
        "title": "建築物無障礙設施設計規範", "sourceSha256": EXPECTED_SHA,
        "source": provenance["source"], "sourcePage": provenance["sourcePage"],
        "versionNote": provenance["versionNote"], "sourceRetrieved": provenance["retrieved"],
        "pages": 105, "defaultChapter": "chapter-1",
        "method": "PDF 原生文字依原段落重排；圖例與表格由原 PDF 範圍無損轉存，未重繪尺寸或圖說。頁碼為 PDF 實體頁碼。附錄依原文為設計參考。",
        "chapters": [],
    }
    source = pdfplumber.open(PDF)
    renderer = pdfium.PdfDocument(str(PDF))
    render_cache = {}
    image_serials = Counter()

    def make_image(page_number, bounds, source_images=(), original_page=False):
        image_serials[page_number] += 1
        filename = f"figures/page-{page_number:03d}-{image_serials[page_number]:02d}.webp"
        scale = 2.5
        if page_number not in render_cache:
            page = renderer[page_number - 1]
            bitmap = page.render(scale=scale)
            render_cache[page_number] = bitmap.to_pil().convert("RGB").copy()
            bitmap.close()
            page.close()
        im = render_cache[page_number]
        padding = 1.5
        pixel_rect = [max(0, math.floor((bounds[0] - padding) * scale)),
                      max(0, math.floor((bounds[1] - padding) * scale)),
                      min(im.width, math.ceil((bounds[2] + padding) * scale)),
                      min(im.height, math.ceil((bounds[3] + padding) * scale))]
        crop = im.crop(pixel_rect)
        crop.save(OUT / filename, "WEBP", lossless=True, method=6, exact=True)
        image = {"type": "image", "file": filename, "page": page_number,
                 "width": crop.width, "height": crop.height,
                 "sourceRect": [round(v, 4) for v in bounds],
                 "sourceImages": list(source_images), "sha256": sha(OUT / filename),
                 "alt": f"官方 PDF 第 {page_number} 頁原圖"}
        if original_page:
            image["originalPage"] = True
        crop.close()
        return image

    # Keep cover and all six TOC pages separate. Their original columns/dots and
    # version statements remain in the original image; text is also searchable.
    front = {"id": "front-matter", "title": "封面與目錄", "startPage": 1,
             "endPage": 7, "kind": "front-matter", "sections": []}
    for n in range(1, 8):
        page = source.pages[n - 1]
        lines = page.extract_text_lines()
        bounds = rect(lines)
        image = make_image(n, bounds, original_page=True)
        image["alt"] = "官方 PDF 封面" if n == 1 else f"官方 PDF 目錄，第 {n} 頁"
        front["sections"].append({"id": f"source-page-{n}",
                                  "title": "封面與版本記載" if n == 1 else f"目錄 · PDF 第 {n} 頁",
                                  "startPage": n, "endPage": n,
                                  "searchText": "\n".join(line["text"] for line in lines),
                                  "blocks": [image], "sourceLines": [line["text"] for line in lines]})
        render_cache.pop(n).close()
    document["chapters"].append(front)
    current_chapter = None
    current_section = None
    pending = None
    last_image = None
    last_number = ""
    native_body = []
    consumed_body = []
    chapter_count = 0
    appendix_count = 0

    def flush():
        nonlocal pending
        if pending:
            # Only remove physical wrapping between PDF lines. Preserve all
            # original characters, numerals, inequality signs and punctuation.
            pending["text"] = "".join(pending.pop("_lines"))
            current_section["blocks"].append(pending)
            pending = None

    for n in range(8, len(source.pages) + 1):
        page = source.pages[n - 1]
        lines = native_lines(page)
        native_body.extend(line["text"] for line in lines)
        events = []
        for line in lines:
            events.append({"kind": "text", "top": line["top"], "line": line})
        for group in image_groups(page):
            events.append({"kind": "image", "top": rect(group)[1], "rect": rect(group),
                           "sourceImages": [x["sourceImage"] for x in group]})

        # The only table drawn with native lines rather than a raster image.
        # Preserve its geometry and the exact header/column relationship.
        if page.rects:
            assert n == 25, f"Unexpected vector content on PDF page {n}; inspect before converting."
            table_bounds = rect(page.rects)
            table_lines = [line for line in lines if table_bounds[1] - 1 <= line["top"]
                           and line["bottom"] <= table_bounds[3] + 1]
            events = [event for event in events if event.get("line") not in table_lines]
            events.append({"kind": "table", "top": table_bounds[1], "rect": table_bounds,
                           "sourceLines": [line["text"] for line in table_lines]})

        for event in sorted(events, key=lambda value: value["top"]):
            if event["kind"] in ("image", "table"):
                flush()
                assert current_section is not None, f"Image without section on {n}"
                image = make_image(n, event["rect"], event.get("sourceImages", ()))
                image["alt"] = f"{last_number} 原圖（官方 PDF 第 {n} 頁）"
                if event["kind"] == "table":
                    image["sourceLines"] = event["sourceLines"]
                    image["alt"] = "表206.2.3 坡道高差與坡度對照表（官方原表）"
                    image["table"] = True
                    consumed_body.extend(event["sourceLines"])
                    current_section["sourceLines"].extend(event["sourceLines"])
                current_section["blocks"].append(image)
                current_section["endPage"] = n
                current_chapter["endPage"] = n
                last_image = image
                continue

            line = event["line"]
            value = line["text"]
            consumed_body.append(value)
            if CHAPTER.fullmatch(value) and line["x0"] < 100:
                flush()
                if value.startswith("第"):
                    chapter_count += 1
                    ident = f"chapter-{chapter_count}"
                else:
                    appendix_count += 1
                    ident = f"appendix-{appendix_count}"
                current_chapter = {"id": ident, "title": value,
                                   "startPage": n, "endPage": n, "sections": []}
                if ident.startswith("appendix"):
                    current_chapter["kind"] = "reference-appendix"
                document["chapters"].append(current_chapter)
                current_section = None
                last_image = None
                continue

            numbered = NUMBER.match(value) if line["x0"] < 100 else None
            if numbered and "." not in numbered[1]:
                flush()
                number, label = numbered.groups()
                current_section = {"id": number, "title": f"{number} {re.split('[：:]', label, maxsplit=1)[0]}",
                                   "startPage": n, "endPage": n, "blocks": [], "sourceLines": []}
                current_chapter["sections"].append(current_section)
            assert current_section is not None, f"Unassigned text on PDF page {n}: {value}"
            current_section["sourceLines"].append(value)
            current_section["endPage"] = n
            current_chapter["endPage"] = n

            if CAPTION.fullmatch(value):
                flush()
                if (last_image and last_image["page"] in (n, n - 1) and value.startswith("圖")
                        and current_section["blocks"][-1] is last_image):
                    last_image["caption"] = value
                    last_image["captionPage"] = n
                    last_image["alt"] = f"{value}（官方 PDF 第 {last_image['page']} 頁原圖）"
                else:
                    current_section["blocks"].append({"type": "text", "text": value,
                                                      "page": n, "caption": True})
                last_image = None
                continue

            if numbered:
                flush()
                last_number = numbered[1]
                last_image = None
                # A standalone section label is already rendered by the section
                # heading. Paragraph-bearing headings retain their complete text.
                if "." not in numbered[1] and not re.search("[：:]", numbered[2]):
                    current_section["headingText"] = value
                    continue
                pending = {"type": "text", "id": numbered[1], "page": n,
                           "endPage": n, "_lines": [value]}
            elif pending:
                pending["_lines"].append(value)
                pending["endPage"] = n
            else:
                pending = {"type": "text", "page": n, "endPage": n, "_lines": [value]}
        # Release rendered images promptly; a paragraph is allowed to continue
        # across the physical page break, so deliberately do not flush here.
        if n in render_cache:
            render_cache.pop(n).close()
    flush()
    assert chapter_count == 10 and appendix_count == 4
    # Table cells may be a separate event; validate coverage by an exact multiset
    # of native source lines, before comparing logical output text below.
    assert Counter(native_body) == Counter(consumed_body), "Missing or duplicated PDF source lines"
    for chapter in document["chapters"]:
        for section in chapter["sections"]:
            section["searchText"] = "\n".join(section["sourceLines"])
    (OUT / "reader.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    renderer.close()
    source.close()
    return validate()


def validate():
    document = read_json(OUT / "reader.json")
    assert sha(PDF) == document["sourceSha256"] == EXPECTED_SHA
    with pdfplumber.open(PDF) as source:
        assert len(source.pages) == document["pages"] == 105
        assert len(document["chapters"]) == 15
        assert [chapter["startPage"] for chapter in document["chapters"][1:]] == [8, 10, 32, 44, 51, 64, 73, 78, 82, 83, 85, 96, 97, 100]
        coverage = set()
        all_text = []
        expected_text = []
        actual_images = Counter()
        expected_images = Counter((n, i) for n, page in enumerate(source.pages, 1) for i in range(len(page.images)))
        sections = []
        paragraphs = []
        images = []
        for chapter in document["chapters"]:
            assert chapter["startPage"] <= chapter["endPage"]
            if chapter["id"] != "front-matter":
                all_text.append(chapter["title"])
            for section in chapter["sections"]:
                sections.append(section)
                assert chapter["startPage"] <= section["startPage"] <= section["endPage"] <= chapter["endPage"]
                coverage.update(range(section["startPage"], section["endPage"] + 1))
                if chapter["id"] == "front-matter":
                    assert compact(section["searchText"]) == compact(source.pages[section["startPage"]-1].extract_text())
                    assert len(section["blocks"]) == 1 and section["blocks"][0]["originalPage"]
                    block = section["blocks"][0]
                    path = (OUT / block["file"]).resolve()
                    assert path.is_relative_to(OUT.resolve()) and sha(path) == block["sha256"]
                    with Image.open(path) as image:
                        assert image.size == (block["width"], block["height"])
                    continue
                all_text.extend(section["sourceLines"])
                rendered = []
                if "headingText" in section:
                    rendered.append(section["headingText"])
                for block in section["blocks"]:
                    if block["type"] == "text":
                        rendered.append(block["text"])
                        paragraphs.append(block)
                    else:
                        images.append(block)
                        path = (OUT / block["file"]).resolve()
                        assert path.is_relative_to(OUT.resolve())
                        assert sha(path) == block["sha256"]
                        with Image.open(path) as image:
                            assert image.size == (block["width"], block["height"])
                        actual_images.update((block["page"], i) for i in block["sourceImages"])
                        if block.get("caption"):
                            rendered.append(block["caption"])
                        rendered.extend(block.get("sourceLines", []))
                assert compact("".join(rendered)) == compact("".join(section["sourceLines"])), f"Text was lost or reordered in section {section['id']}"
        for page in source.pages[7:]:
            expected_text.extend(line["text"] for line in native_lines(page))
        assert all_text == expected_text, "Native body line coverage or reading order differs"
        assert len(sections) - 7 == 70, "Top-level section coverage differs"
        assert coverage == set(range(1, 106)), "Physical PDF page coverage incomplete"
        assert actual_images == expected_images, "Original PDF illustration coverage differs"
        # Independent spot checks for important cross-page and numerical cases.
        p203 = next(block for block in paragraphs if block.get("id") == "203.2.6")
        assert p203["page"] == 12 and "200公分" in p203["text"] and "10公分" in p203["text"]
        assert next(block for block in paragraphs if block.get("id") == "104.10")["endPage"] == 9
        assert next(block for block in paragraphs if block.get("id") == "A405.10")["endPage"] == 105
        assert len([block for block in images if block["page"] in (21, 35)]) == 4
        assert next(block for block in images if block.get("caption") == "圖203.2.6")["page"] == 12
        report = {"sourceSha256": EXPECTED_SHA, "pages": 105,
                  "chapters": 10, "appendices": 4, "frontMatterPages": 7,
                  "sections": len(sections) - 7, "paragraphs": len(paragraphs),
                  "nativeTextLines": len(expected_text), "sourceImages": sum(expected_images.values()),
                  "webImages": len(images), "nativeTables": 1,
                  "allPagesCovered": True, "allNativeTextPreserved": True, "allSourceImagesPreserved": True,
                  "derivedBytes": sum(path.stat().st_size for path in OUT.rglob("*") if path.is_file())}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate committed output without regenerating it")
    args = parser.parse_args()
    validate() if args.check else convert()
