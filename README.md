# openlawtw

臺灣建築法規查找與閱讀工具 · **v0.25.2**

[使用網站](https://openlawtw.vercel.app/) · [GitHub 原始碼](https://github.com/termcavetw/openlawtw) · [引用指南](CITING.md) · [資料來源與權利](DATA_LICENSE.md)

目前收錄 **1,027 部法規索引、996 部條文全文、19,708 條／點原文、31 份原文文件及 9,054 筆函釋**。22 縣市均有法規全文，但收錄仍不完整；本工具提供官方原文查找，不判斷個案適用或函釋效力。

程式採 MIT；法規、函釋、PDF 與圖表依各自來源與權利說明處理，不因收錄於本庫而改採 MIT。附件與裁圖的逐檔紀錄見 [資料文件清單](data/documents/RIGHTS.md)，第三方程式聲明見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 本版更新

v0.25.2 統一條文「⋯」選單的圖示與文字對齊。列印預覽新增「返回條文」，關閉預覽並退出列印設定；瀏覽器不允許關閉時，改回原閱讀網址與條號。列印設定也增加返回按鈕及 44px 關閉按鈕。

v0.25.1 修正短條文被左側操作撐高：條號旁收成「⋯」，函釋、加入案件、分享、複製、官方原文及列印改為點開操作。第 116-2 條補上官方 PDF 第 2 頁的完整表格影像與符號說明，支援局部橫滑、列印及離線，並保留兩頁原始 PDF 下載。未改寫條文文字；本次附件來源與核對紀錄見 [逐條表格目錄](data/documents/article-figures/catalog.json)及[文件權利清單](data/documents/RIGHTS.md)。

v0.25.0 新增友善列印：可選單一法條、章節或整部法規，以 A4 直式／橫式預覽，使用瀏覽器列印或儲存 PDF。保留完整條文、表格、條號與來源日期，隱藏操作介面及搜尋標示；原始附件需另開列印。預覽在新視窗開啟，已載入的條文可離線使用。

每條新增「官方原文」與「列印」。全國法規資料庫及新北市已核實的條／增訂條號可直接開啟該條官方頁；其他網站或未核實編號明示「官方全文」，不猜測定位。官方頁可能已更新，應核對版本。頁首保留官方原文、列印、收藏，複製引用／連結收進「更多」。來源查核與測試見 [列印與官方逐條連結](PRINT-OFFICIAL-LINKS.md)。

延續 v0.24.2 的工業用地、消防及電信連寫查詢；查找提示保留條文來源，不判斷案件適用。

## 閱讀與查找

- 根網址與 PWA 進入工作區。首次開啟顯示搜尋、常用法規與收藏；再次開啟可恢復本機上次閱讀位置，明示分享條號優先。Logo 聚焦搜尋，「關於」需主動開啟。
- 搜尋支援正式法規名、明示別名、法規 ID、中文／全形條號、字號及多詞查詢。結果按法規合併，可展開命中條文或原文文件頁碼；縣市選擇可搭配中央法規查找。
- 桌機函釋在左側並讀，可拖曳調整欄寬；手機使用抽屜。函釋卡片顯示原文節錄，可見時才載入；來源未收錄本文者不補寫內容。
- 法條引用與同法規明定名詞以低調底線提示。桌機滑過預覽、點擊固定，手機點開底部面板；顯示原文、官方來源與快照日期。不確定的引用不連結，項款無法核實時保留整條。
- 章節目錄顯示實際條號範圍。可可靠解析的文字表格保留跨列／跨欄結構，其餘公式與圖表保留原始排版；寬表局部橫滑，保留原文核對與縮放。
- PDF 可查找文字與定位頁碼；無障礙規範另有圖文章節。外部附件仍需連網。
- 法規宇宙保留各星球顏色，可切換 2D／3D、查看已收錄法源證據及函釋關聯。位置、大小與距離不表示法規位階或重要性，無連線不代表無關。
- 收藏、本機案件引用、版本異動追蹤、分享圖卡與嵌入卡保留。異動比對的是本庫版本，不是官方即時修法通知。
- 載入使用 20px 黑白 Thinking Orb；支援減少動態效果，離開畫面或切到背景時停止動畫。

每部法規有 `/laws/<法規ID>.html` 獨立頁、canonical 與 sitemap；舊 `#law=` 分享網址保留相容。例：[建築法第 73 條](https://openlawtw.vercel.app/laws/D0070109.html#a-73)。

## 資料、來源與離線

schema v2 保留官方文字、穩定條文 ID、可確認的項款範圍及來源觀測紀錄。無法核實的結構保留原文，不推測層級。修正日、生效日、擷取日與網站版本分別記錄；部署日期不等於法規生效日期。

法規逐部分片、函釋依固定 ID 區間分片，以 SHA-256 定址。搜尋先以 CJK 倒排索引找候選，再以原文驗證。PWA 首次只保存介面，可選擇中央、縣市或函釋離線包，不強迫下載全庫。

`npm run build` 產生的 `openlawtw.html` 內嵌全部收錄資料，可直接開啟；網站 PWA 需 HTTPS 或 localhost。尚未下載的資料、官方外部附件與連結仍需要網路。瀏覽器封鎖或清除本機儲存會影響收藏、案件與閱讀位置，請自行保管匯出資料。

本版僅補取第 116-2 條的官方附件，未重新同步整庫法規。各法規沿用自己的來源日期；最近增補見 [工業用地來源](INDUSTRIAL-LAND-2026-09-30.md) 與 [電信／消防來源](TELECOM-FIRE-2026-09-30.md)。國土署函釋為既有 9,054 筆，其中 9,012 筆有本文、42 筆僅主旨／字號。

## 開發與驗證

使用 Node.js 24（最低 22.13）、npm 與 Python 3.12。在專案根目錄執行：

```sh
npm ci
python3 -m pip install -r requirements.txt
python3 -m unittest discover -s scripts/tests -v
python3 scripts/validate-data.py
python3 scripts/import-accessibility-reader.py --check
npm run build
npm run typecheck
npm run check
```

以上與 `.github/workflows/validate.yml` 的資料／程式檢查對應。CI 另安裝 Playwright Chromium，執行 `scripts/check-law-print-browser.py`，驗證 1280／390／320px 的條文操作及列印並保存截圖／PDF。開發預覽使用 `npm run dev`，正式建置預覽使用 `npm run preview`；`npm run check` 需先完成建置。搜尋品質可單獨執行 `npm run check:quality`，案例是開發者整理的來源查找期待，不是法律適用判斷或外部盲測精準率。

只修改程式、搜尋詞彙或說明文件不必重新同步官方資料。資料維護後執行 `npm run snapshot` 再重新建置；完整同步、來源逐字核對與 PDF 驗證方式見 [CONTRIBUTING.md](CONTRIBUTING.md)，資料結構見 [SCHEMA.md](SCHEMA.md)。

### 手機驗證界線

v0.24.1 已限制外層橫向溢出、讓表格獨立橫滑，並避免頁籤數字拆行。v0.25.0 已檢查 Chromium 320／390px 的閱讀與列印操作，**iPhone 主畫面 PWA 的正文左右拖移仍待實機確認**，不得將窄視窗測試視為真機修復完成。

回歸頁：[建築技術規則建築設計施工編第 116-3 條](https://openlawtw.vercel.app/laws/D0070115.html#a-116-3)。需核對正文不橫移、表格可完整橫滑、縮放及垂直閱讀正常。歷史驗證紀錄見 [VALIDATION.md](VALIDATION.md) 與各次更新文件；舊版結果不代表本版已實測。

## GitHub 與 Vercel

原始專案提交至 [termcavetw/openlawtw](https://github.com/termcavetw/openlawtw)，經工作分支、PR 與 CI 驗證後合併至 `main`。不提交 `node_modules/`、`dist/`、生成分片或帳號設定；不改寫既有作者歷史、不強制推送。

Vercel 使用 Node.js 24、`npm ci`、`npm run build`，部署輸出為 `dist/`。完整原始碼 ZIP 放在 `artifacts/openlawtw-source.zip`，可由 GitHub Actions 的 `openlawtw-review` 產物取得；不放入網站部署目錄。發布須核對遠端提交、該提交的 CI 與正式部署，不能只依頁面版本號判斷。

部署與快取驗收見 [DEPLOY.md](DEPLOY.md)，保護規則見 [GITHUB_SETUP.md](GITHUB_SETUP.md)。更新未生效時可使用網站「安裝／離線」或 [更新檢查頁](https://openlawtw.vercel.app/update.html)，勿以清除案件與收藏作為更新步驟。

每週官方同步採草稿 PR 流程；工作流程檔存在不代表排程已啟用。`ENABLE_LAW_SYNC` 的設定與人工審核方式見部署指南。

## 貢獻與範圍

本專案依維護者可用時間更新，不承諾完整收錄或回覆時程。資料缺漏／勘誤請附官方來源網址、法規名稱、條號或頁碼及具體問題送 PR，或寄至 [termcavetw@gmail.com](mailto:termcavetw@gmail.com)。不提供個案法律諮詢；公開 PR 請勿附個資、未公開案件文件或憑證。

接受官方法規原文、正式函釋、附件及來源／日期校正，不收自行撰寫的法律解釋或 AI 法律結論，也不以一般表單或實務資料增加收錄量。搜尋別名、詞彙及編輯提示與原文分開，分別位於 `data/aliases.json`、`data/search-vocabulary.json`、`data/search-guides.json`；提示須有可核對的來源片段。

建置亦輸出 `/data/aliases.json` 與 `/data/yinxian-laws.js` 供引線等工具使用，本庫不直接修改引線擴充套件。引用或整合請依 [CITING.md](CITING.md) 保存來源、條號／字號、資料日期與版本。

## 歷史更新文件

下列文件記錄各版本當時的資料量、實作及驗證界線，不代表目前收錄數或部署狀態。

| 版本／主題 | 紀錄 |
| --- | --- |
| v0.23–0.24 引用、定義與部署精簡 | [條文內查閱](INLINE-READING-2026-09-30.md) |
| v0.22 電信與消防法規 | [來源與收錄](TELECOM-FIRE-2026-09-30.md) |
| v0.21 原文表格 | [表格來源與查核](TABLES-2026-09-30.md) |
| v0.20 工業用地 | [增補與來源](INDUSTRIAL-LAND-2026-09-30.md) |
| v0.19 介面、異動追蹤與分享 | [介面更新](UI-REFINEMENT.md) · [分享與嵌入](WATCH-SHARE-EMBED.md) |
| v0.18 法規增補 | [增補與清理](CLEANUP-LAWS-2026-09-29.md) |
| v0.17 法規宇宙、移除實務資料包 | [立體星圖](UNIVERSE-3D-2026-09-29.md) · [移除紀錄](REMOVE-PRACTICE-2026-09-29.md) |
| v0.15–0.16 工作區與文件閱讀 | [工作區](WORKSPACE-2026-09-29.md) · [圖文章節](PDF-CHAPTERS-2026-09-29.md) · [文件搜尋](DOCUMENT-SEARCH-2026-09-29.md) |
| 地方法規歷次擴充 | [初期](LOCAL-LAWS.md) · [第一輪](LOCAL-LAWS-2026-09-29.md) · [第二輪](LOCAL-LAWS-ROUND2-2026-09-29.md) |
