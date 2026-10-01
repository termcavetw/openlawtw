# 逐條補充圖例來源

本資料只涵蓋《建築技術規則建築設計施工編》`D0070115` 在官方附件清單中標為「補充圖例」的 **43 個原始連結、24 個條號**。不從條文語意、圖面內容、檔名相似度推導其他對應。

## 檔案與來源層

- `attachment-titles.json`：既有法規資料的精確附件標題及原始網址；`sources/law-all.html` 為 2026-10-01 再取得的官方整頁證據。HTML 下載網址另帶 `lan=C`，驗證比對精確標題與 FileId，目錄保留既有原始網址。
- `originals/`、`download-manifest.json`：24 份官方 PDF 和第 1 條額外 JPG 的原始位元組、擷取時間、大小與 SHA-256。18 個 DOC 仍保留原始外部連結，不另轉製或聲稱與 PDF 位元組相同。
- `catalog.json`：每條以唯一 PDF 為主要來源；`pages` 是全部 PDF 實體頁，含完整頁面範圍（PDF point）、像素尺寸、大小、來源與輸出 SHA-256。`alternatives` 保留所有 43 個原始 PDF/DOC/JPG 名稱與網址。第 1 條 JPG 另列在 `supplementalFiles`，不併入 PDF 頁次。
- `public/documents/article-supplements/D0070115/`：43 張完整頁面、144 dpi、無損 WebP 和 1 個原始 JPEG。檔名包含來源及輸出 hash，供按需載入；不嵌入法規資料 shard、不作 service worker 預快取。
- `source-text.json`：PDF 原生文字及相關檔案屬性；沒有 OCR，多數掃描頁沒有可抽取文字。僅作来源核查，不將此文字代替影像、加入法規原文或推論生效日期。
- `visual-review.json`：全部 43 頁及 JPG 的目視核對結果，包含版本差異及圖說觀察；不是法律適用判斷。
- `sources/`：官方全文、沿革、本站資料開放宣告及著作權法第 9 條的 HTML 快照，來源、擷取時間、大小、SHA-256 見 `sources/manifest.json`。

## 版本注意事項

擷取日與 PDF 建檔日不是修正或生效日。第 1、60、107、110 條的官方沿革記載曾修正圖例、停止適用部分原圖例；本資料只保存目前官方連結，不以相同圖號判斷是哪一歷史版本。第 1 條另列圖 1-3-(8) JPG。第 39-1 條訂定及生效日期僅按官方沿革第 81 點記載。

第 144 條有來源屬性差異：官方附件標題和兩頁實際圖說是第 144 條，但 PDF 內部 Title 的 Big5 十六進位內容解碼為「Microsoft Word - 第117條補充圖例」。依官方附件精確標題對應第 144 條，不依內部屬性改映射。PDF 建檔資料為 2018 年，而官方沿革有 2026 年第 144 條修正；未推論附件已同步更新或判定其现行效力。此差異也寫入顯示用 `versionNote`。

第 3-1 條圖內未見明確條號，因此只有官方附件標題作為對應依據。第 121 條第 2 頁是前頁計算说明的接續，仍完整保留。

## 重現及驗證

使用專案 Python 相依套件（pypdfium2、Pillow、lxml）。所有檢查均不需要網路：

```sh
python3 scripts/import-article-supplements.py --check
python3 scripts/import-article-supplements.py --check-render
python3 -m unittest discover -s scripts/tests -p test_article_supplements.py
```

`--check` 逐一驗證精確對應、官方 HTML 證據、原檔及輸出位元組、尺寸、頁序、全頁範圍、視覺審查覆蓋、版本註記與所有 lazy 圖檔的引用完整性。`--check-render` 額外重新渲染每頁並比對解碼後的 RGB 像素。

```sh
python3 scripts/import-article-supplements.py --download
python3 scripts/import-article-supplements.py --render
```

`--download` 僅下載缺少的官方 PDF/JPG；已有紀錄先驗證 hash，不默默覆蓋來源。`--render` 使用固定的原檔產生完整頁面與目錄；渲染器／編碼器版本可能影響輸出 bytes，所以版本已記錄。更換來源必須重新核對官方標題、原檔、版本及全部實體頁，更新來源與審核紀錄後才可發佈；不要直接改 hash 使檢查通過。

權利適用範圍與官方宣告見上層 [RIGHTS.md](../RIGHTS.md) 的逐條補充圖例節。原始官方內容不另套用專案 MIT 授權。
