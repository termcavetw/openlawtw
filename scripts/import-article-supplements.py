#!/usr/bin/env python3
"""Import only the 43 exact D0070115 supplementary-illustration attachments.

--download fetches official PDF/JPG originals; DOC alternatives remain links.
--render makes complete, uncropped, lossless WebP pages from pinned originals.
--check verifies the catalog, exact title mapping, sources, audit and every byte
without network access. --check-render also compares decoded rendered pixels.
No OCR, legal interpretation, effective-date inference or redrawing is used.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

import pypdfium2 as pdfium
from PIL import Image
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/documents/article-supplements"
PUBLIC = ROOT / "public/documents/article-supplements"
LAW_ID = "D0070115"
TITLE = re.compile(r"第 ([0-9]+(?:-[0-9]+)?) 條補充圖例(圖1-3-\(8\))?\.(PDF|DOC|JPG)")
ARTICLES = ("1", "2", "3-1", "8", "14", "16", "19", "23", "24", "26", "28", "33", "39-1", "42", "45", "60", "89", "90", "107", "110", "117", "118", "121", "144")
HISTORY = "https://law.moj.gov.tw/LawClass/LawHistory.aspx?pcode=D0070115"
SCALE = 2.0


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_info(path):
    raw = path.read_bytes()
    return {"bytes": len(raw), "sha256": digest(raw)}


def map_attachments(attachments):
    """Exact titles only; deliberately do not map 完整條文 or inferred content."""
    result = {}
    for item in attachments:
        if "補充圖例" not in item["title"]:
            continue
        match = TITLE.fullmatch(item["title"])
        assert match, f"Unknown supplementary attachment title: {item['title']}"
        article, extra, fmt = match.groups()
        assert not extra or (article == "1" and fmt == "JPG"), item
        assert fmt != "JPG" or extra, item
        assert item["url"].startswith("https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId="), item
        row = {"title": item["title"], "url": item["url"], "format": fmt}
        assert row not in result.setdefault(article, []), f"Duplicate: {item}"
        result[article].append(row)
    assert set(result) == set(ARTICLES), "Reviewed 24-article scope changed; review before import"
    assert sum(map(len, result.values())) == 43, "Reviewed attachment count changed"
    for article, items in result.items():
        assert sum(i["format"] == "PDF" for i in items) == 1, f"Need one canonical PDF for {article}"
    return result


def source_mapping():
    law = read(ROOT / "public/data/laws.json")[LAW_ID]
    mapping = map_attachments(law["attachments"])
    snapshot = read(DATA / "attachment-titles.json")
    assert snapshot["lawId"] == LAW_ID
    assert map_attachments(snapshot["attachments"]) == mapping, "Pinned titles differ from law snapshot"
    return law, mapping


def download():
    _, mapping = source_mapping()
    old = {x["url"]: x for x in read(DATA / "download-manifest.json")} if (DATA / "download-manifest.json").exists() else {}
    rows = []
    for article in ARTICLES:
        for item in mapping[article]:
            if item["format"] == "DOC":
                continue
            suffix = "-1-3-8" if item["format"] == "JPG" else ""
            path = DATA / "originals" / f"{article}{suffix}.{item['format'].lower()}"
            if path.exists() and item["url"] in old:
                previous = old[item["url"]]
                assert file_info(path) == {k: previous[k] for k in ("bytes", "sha256")}, path
                rows.append(previous)
                continue
            with urlopen(Request(item["url"], headers={"User-Agent": "openlawtw-source-importer/1.0"}), timeout=90) as response:
                raw = response.read()
            assert raw.startswith(b"%PDF" if item["format"] == "PDF" else b"\xff\xd8"), item["title"]
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            rows.append({**item, "article": article, "originalFile": str(path.relative_to(ROOT)),
                         "bytes": len(raw), "sha256": digest(raw), "retrieved": datetime.now(timezone.utc).isoformat()})
            write(DATA / "download-manifest.json", rows)
    write(DATA / "download-manifest.json", rows)


def version_note(article):
    base = "依全國法規資料庫目前所列補充圖例附件保存；附件未標示完整版本日期，擷取日及 PDF 建檔日期均不作為修正或生效日期。"
    if article in ("1", "60", "107", "110"):
        base += "官方沿革第 50 點記載民國 93 年 3 月 10 日修正本條補充圖例，並停止適用部分原圖例；請一併核對沿革，勿以相同圖號推定為舊版或現行適用結論。"
    if article == "1":
        base += "沿革第 51 點另記載增訂圖 1-3-(8)，另列 JPG 原檔，不併入本 PDF。"
    if article == "39-1":
        base = "官方沿革第 81 點記載民國 107 年 6 月 14 日訂定本條補充圖例，自民國 109 年 7 月 1 日生效；此日期僅按該項記載，不能推及其他附件。"
    if article == "144":
        base += "官方沿革第 88 點另記載民國 115 年修正本條條文；PDF 建檔資訊為 2018 年，未據此宣稱附件已隨本次修正更新。PDF 屬性標題解碼為「Microsoft Word - 第117條補充圖例」，但官方附件名稱與兩頁實際圖說均為第 144 條；保留此來源差異，依官方附件名稱對應，使用前請核對官方原文。"
    return base


def render_page(page):
    bitmap = page.render(scale=SCALE, rotation=0)
    image = bitmap.to_pil().convert("RGB").copy()
    bitmap.close()
    return image


def extract_native_sources(records):
    result = []
    for record in records:
        doc = pdfium.PdfDocument(str(ROOT / record["originalFile"]))
        item = {"article": record["article"], "sha256": record["sha256"],
                "pdfMetadata": {k: v for k, v in doc.get_metadata_dict().items()
                                if k in ("Title", "CreationDate", "ModDate", "Creator", "Producer")}, "pages": []}
        for i in range(len(doc)):
            page = doc[i]
            textpage = page.get_textpage()
            item["pages"].append({"page": i+1, "text": textpage.get_text_range()})
            textpage.close()
            page.close()
        doc.close()
        result.append(item)
    return {"method": "PDF native text extraction only, no OCR; most scanned pages have no native text. PDF dates are metadata, not effective dates.", "records": result}


def render():
    law, mapping = source_mapping()
    originals = {x["url"]: x for x in read(DATA / "download-manifest.json")}
    records = []
    for article in ARTICLES:
        canonical = next(x for x in mapping[article] if x["format"] == "PDF")
        original = originals[canonical["url"]]
        path = ROOT / original["originalFile"]
        assert file_info(path) == {k: original[k] for k in ("bytes", "sha256")}, path
        record = {"id": f"{LAW_ID}-{article}", "lawId": LAW_ID, "article": article,
                  "articleNo": f"第 {article} 條", "title": canonical["title"], "source": canonical["url"],
                  "sourcePage": f"https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode={LAW_ID}&flno={article}",
                  **{k: original[k] for k in ("originalFile", "bytes", "sha256", "retrieved")},
                  "versionNote": version_note(article), "versionSource": HISTORY,
                  "pages": [], "alternatives": mapping[article], "supplementalFiles": []}
        doc = pdfium.PdfDocument(str(path))
        for i in range(len(doc)):
            page = doc[i]
            image = render_page(page)
            output = io.BytesIO()
            image.save(output, "WEBP", lossless=True, method=6, exact=True)
            raw = output.getvalue()
            relative = Path(LAW_ID) / article / f"{original['sha256'][:12]}-page-{i+1:03d}-{digest(raw)[:12]}.webp"
            out = PUBLIC / relative
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(raw)
            width, height = page.get_size()
            record["pages"].append({"page": i+1, "src": "/documents/article-supplements/" + relative.as_posix(),
                                    "width": image.width, "height": image.height, "bytes": len(raw), "sha256": digest(raw),
                                    "sourceRect": [0, 0, round(width, 4), round(height, 4)], "originalPage": True,
                                    "alt": f"{canonical['title']}，官方 PDF 第 {i+1} 頁完整原圖"})
            image.close()
            page.close()
        doc.close()
        for extra in mapping[article]:
            if extra["format"] != "JPG":
                continue
            metadata = originals[extra["url"]]
            raw = (ROOT / metadata["originalFile"]).read_bytes()
            assert digest(raw) == metadata["sha256"]
            relative = Path(LAW_ID) / article / f"figure-1-3-8-{digest(raw)[:12]}.jpg"
            out = PUBLIC / relative
            out.write_bytes(raw)
            with Image.open(io.BytesIO(raw)) as image:
                record["supplementalFiles"].append({**metadata, "src": "/documents/article-supplements/" + relative.as_posix(),
                                                    "width": image.width, "height": image.height,
                                                    "versionNote": "官方另列之第 1 條補充圖例圖 1-3-(8)，原始 JPG 位元組直接保存，未合併或重繪。"})
        records.append(record)
    catalog = {"schemaVersion": 1, "lawId": LAW_ID, "lawName": law["name"], "sourcePage": law["url"],
               "retrieved": max(x["retrieved"] for x in originals.values()),
               "method": {"renderer": "pypdfium2", "rendererVersion": str(pdfium.PYPDFIUM_INFO),
                          "pdfiumVersion": str(pdfium.PDFIUM_INFO), "scale": SCALE, "dpi": 72*SCALE,
                          "encoding": "WebP lossless", "crop": "none; complete PDF physical page",
                          "textMethod": "No OCR or reconstructed diagram text; images are the source content."},
               "records": records}
    write(DATA / "catalog.json", catalog)
    write(DATA / "source-text.json", extract_native_sources(records))
    print(f"Rendered {len(records)} articles / {sum(len(x['pages']) for x in records)} full PDF pages")


def verify_file(path, row):
    assert path.is_file(), f"Missing file: {path}"
    assert file_info(path) == {k: row[k] for k in ("bytes", "sha256")}, f"Changed bytes: {path}"


def verify_source_snapshots(mapping):
    sources = read(DATA / "sources/manifest.json")
    assert {x["id"] for x in sources} == {"law-all", "law-history", "copyright", "copyright-act-9"}
    for source in sources:
        verify_file(ROOT / source["file"], source)
    # The HTML adds lan=C to download links. Compare the exact title and FileId,
    # retaining the existing canonical source URL verbatim in catalog metadata.
    tree = html.fromstring((DATA / "sources/law-all.html").read_bytes())
    found = {(a.text_content().strip(), parse_qs(urlparse(a.get("href")).query).get("FileId", [None])[0])
             for a in tree.xpath('//a[contains(@href,"LawGetFile")]') if "補充圖例" in a.text_content()}
    expected = {(a["title"], parse_qs(urlparse(a["url"]).query)["FileId"][0]) for rows in mapping.values() for a in rows}
    assert found == expected, "Official HTML attachment evidence differs"


def check(check_render=False):
    law, mapping = source_mapping()
    verify_source_snapshots(mapping)
    catalog = read(DATA / "catalog.json")
    audit = read(DATA / "visual-review.json")
    originals = {x["url"]: x for x in read(DATA / "download-manifest.json")}
    assert catalog["schemaVersion"] == 1 and catalog["lawId"] == LAW_ID
    assert catalog["lawName"] == law["name"]
    assert [r["article"] for r in catalog["records"]] == list(ARTICLES)
    assert len(originals) == 25 and set(audit["articles"]) == set(ARTICLES)
    assert set(originals) == {x["url"] for rows in mapping.values() for x in rows if x["format"] != "DOC"}
    for article, rows in mapping.items():
        for item in rows:
            if item["format"] != "DOC":
                original = originals[item["url"]]
                assert all(original[k] == item[k] for k in ("title", "url", "format"))
                assert original["article"] == article
    referenced = set()
    for record in catalog["records"]:
        article = record["article"]
        assert record["lawId"] == LAW_ID and record["id"] == f"{LAW_ID}-{article}"
        assert record["articleNo"] == f"第 {article} 條"
        canonical = next(x for x in mapping[article] if x["format"] == "PDF")
        assert record["title"] == canonical["title"] and record["source"] == canonical["url"]
        assert record["sourcePage"] == f"https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode={LAW_ID}&flno={article}"
        assert record["alternatives"] == mapping[article] and record["versionSource"] == HISTORY
        assert record["versionNote"] == version_note(article) and "effective" not in record
        original = originals[record["source"]]
        assert all(record[k] == original[k] for k in ("bytes", "sha256", "originalFile", "retrieved"))
        verify_file(ROOT / record["originalFile"], original)
        doc = pdfium.PdfDocument(str(ROOT / record["originalFile"]))
        assert len(record["pages"]) == len(doc)
        reviewed = audit["articles"][article]
        assert reviewed["sourceSha256"] == record["sha256"]
        assert reviewed["reviewedPages"] == list(range(1, len(doc)+1))
        assert reviewed["fullPageVerified"] is True and reviewed["notes"]
        for i, page_info in enumerate(record["pages"]):
            page = doc[i]
            assert page_info["page"] == i+1 and page_info["originalPage"] is True
            assert page_info["src"].startswith(f"/documents/article-supplements/{LAW_ID}/{article}/")
            assert record["sha256"][:12] in page_info["src"] and page_info["sha256"][:12] in page_info["src"]
            path = ROOT / "public" / page_info["src"].lstrip("/")
            verify_file(path, page_info)
            referenced.add(path)
            assert page_info["sourceRect"] == [0, 0, *[round(x, 4) for x in page.get_size()]]
            with Image.open(path) as image:
                assert image.format == "WEBP" and image.size == (page_info["width"], page_info["height"])
                if check_render:
                    rendered = render_page(page)
                    assert image.convert("RGB").tobytes() == rendered.tobytes(), f"Changed pixels: {path}"
                    rendered.close()
            page.close()
        doc.close()
        assert len(record["supplementalFiles"]) == (1 if article == "1" else 0)
        for supplemental in record["supplementalFiles"]:
            assert supplemental["title"] == "第 1 條補充圖例圖1-3-(8).JPG"
            assert supplemental["sha256"][:12] in supplemental["src"]
            original = originals[supplemental["url"]]
            verify_file(ROOT / original["originalFile"], supplemental)
            path = ROOT / "public" / supplemental["src"].lstrip("/")
            verify_file(path, supplemental)
            referenced.add(path)
            with Image.open(path) as image:
                assert image.format == "JPEG" and image.size == (supplemental["width"], supplemental["height"])
            assert audit["supplementalJpg"]["sha256"] == supplemental["sha256"] and audit["supplementalJpg"]["reviewed"] is True
    assert {p for p in PUBLIC.rglob("*") if p.is_file()} == referenced, "Unexpected/unreferenced lazy assets"
    assert read(DATA / "source-text.json") == extract_native_sources(catalog["records"]), "Source text or PDF metadata changed"
    size = sum(p.stat().st_size for p in referenced)
    print(f"OK: 24 exact articles, 43 original links, 25 originals, {len(referenced)-1} complete PDF pages + original JPG; lazy assets {size:,} bytes; offline check")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--check-render", action="store_true")
    args = parser.parse_args()
    assert not ((args.check or args.check_render) and (args.download or args.render)), "Checks never perform downloads or writes"
    if args.check or args.check_render:
        check(args.check_render)
    else:
        if args.download:
            download()
        if args.render:
            render()
        if not (args.download or args.render):
            parser.print_help()


if __name__ == "__main__":
    main()
