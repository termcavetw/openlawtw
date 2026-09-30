# 貢獻 openlawtw

歡迎補充法規俗稱、官方來源、漏收條文與資料校正。請附官方來源網址與要修正的具體位置。分類是閱讀輔助；母子法關係須有條文證據。

引用網站或整合資料前，請先看 [引用與資料整合指南](CITING.md)。程式授權見 [LICENSE](LICENSE)，資料、PDF 與圖片的使用依據見 [DATA_LICENSE.md](DATA_LICENSE.md) 與[文件權利清單](data/documents/RIGHTS.md)。

## 接受範圍與聯絡方式

- **資料 PR 必須附官方來源網址**，並指出法規名稱、地區、條號或 PDF 頁碼、具體缺漏與擷取日期；名稱或截圖本身不足以驗證來源。
- 接受官方原文、主管機關正式函釋、官方圖表附件，以及來源與日期校正。保留原文；資料與程式授權分別處理。
- 不接受貢獻者自行撰寫的法規解釋、註解、設計建議、個案適用判斷或 AI 生成的法律結論。這項限制不排除有官方來源的解釋函令。
- 別名、搜尋詞彙及分類是獨立編輯欄位，須指向可核對的正式資料，不得寫入官方原文字段。現有查找提示只能提供來源導覽，不增寫法律解釋。
- 程式錯誤修正、無障礙與介面改善可送程式 PR，請附重現步驟及必要驗證；官方網址要求針對資料內容。
- 資料缺漏可送 PR，或寄至 [termcavetw@gmail.com](mailto:termcavetw@gmail.com)。不提供個別支援、個案諮詢或處理時程承諾，來信不保證回覆。
- 公開 PR 不得附非必要個資、未公開案件文件、API 金鑰或帳號憑證。

## 補別名
編輯 data/aliases.json，例如：
```json
{
  "建技": "建築技術規則",
  "變使": "建築物使用類組及變更使用辦法"
}
```
鍵和值都用非空文字；值可為正式法規名或既有法規名稱片段。別名只參與查找，不修改法規原文。執行 npm run build && npm run check 後送 PR。

## 補搜尋詞彙與查找提示
- data/search-vocabulary.json：辨識沒有空格的地名、建築用語；避免加入會誤拆法規名的過短詞。
- data/search-guides.json：查找方向必須附已收錄的法規／條號及可核對的原文片段，不寫案件適用結論。提示與精確搜尋結果分開顯示。
- data/search-quality.json：新增實際查找需求、預期法規或條文 ID，以及官方來源依據。先決定合理期待，再執行 npm run check:quality；不可為了通過測試才依排名改答案。
- lib/coverage.ts：8 類收錄議題只按法規名稱分類，沒有匹配資料時顯示「待補查」，不能推論當地沒有規定。

## 補官方法規
- 中央收錄清單：data/expanded-central.json。
- 地方收錄清單：data/expanded-local.json，填 name、site、id。
- 技術規範入口：data/technical-sources.json。
- 官方原始紀錄：public/data/laws.json、public/data/rulings.json。
- 編輯目錄：data/catalog.json；由同步腳本產生，維持與 public/data/catalog.json 一致。

```sh
python3 -m pip install -r requirements.txt
python3 scripts/sync-laws.py --cache .law-cache --refresh
python3 scripts/sync-rulings.py --cache .rulings-cache --refresh
python3 scripts/validate-data.py --cache .law-cache
python3 scripts/check-rulings.py --cache .rulings-cache
npm run snapshot
npm run build
npm run typecheck
npm run check
```

可使用 --only-sites 臺北市,新北市 只重整指定地方來源；其餘既有地方快照保留。--refresh 會重新取得中央官方批次檔。擷取或解析失敗會記錄到 data/sync-report.json，已有全文不會因失敗降成連結。自動同步另以 sync-guard.py 阻擋資料消失、全文降級、條文大量減少及解析異常。

## 補 PDF、官方圖表與圖文章節

- 新增或更換檔案時，更新 `data/documents/catalog.json` 中的法規 ID、`file`、官方檔案 URL（`source`）、官方發布頁（`sourcePage`）、原檔 `sha256`、`bytes`、`pages`、擷取日期（`retrieved`）、版本說明（`versionNote`）與文字擷取方法（`textMethod`）。HTML 原文另依現有格式保存 `format`、`contentFile` 等欄位；不要把原始檔案的 hash 當成擷取文字或裁圖的 hash。
- 同步更新 `data/documents/RIGHTS.md` 的來源與權利紀錄：對應法規／檔案、官方頁與原檔網址、取得日期、官方權利說明的網址及適用範圍、已知第三方素材與待核實事項。不能只寫「政府網站」或「網路公開」，也不能把未知使用依據填成已授權；尚待核實的內容，先提供官方連結供審核。這份清單是文件，不是新增到資料 JSON 的授權欄位。
- 公告日、修正日、生效日、勘誤日與擷取日分別記錄在合適欄位或版本說明；檔名或網頁標示「最新」不足以推定生效日期。公報包含多份文件時，保留對應正文的頁碼與搜尋範圍。
- 裁圖需保留原始 PDF 的 SHA-256、PDF 實體頁碼、裁切範圍、圖號／圖說與擷取方法，並保存輸出檔案 hash。保留尺寸、表格、註記及必要上下文；不得以重繪或生成式圖片取代官方圖面。現有無障礙圖文章節由 `scripts/import-accessibility-reader.py` 產生，來源關係保存在 `data/documents/readers/accessibility/`。
- PR 應附原檔與網頁顯示的核對結果，包含文字、表格合併儲存格、圖說與章節順序。請執行 `python3 scripts/validate-documents.py`、`npm run build`、`npm run typecheck`、`npm run check`；修改無障礙圖文章節時，再執行 `python3 scripts/import-accessibility-reader.py --check`。

來源檔、文字擷取與裁圖是不同資料層，須保留彼此對應。此審核流程不改變程式 MIT 授權，也不將官方原文或第三方內容重新授權為 MIT。

## 審核原則
1. 原文逐字保留，項款結構是附加座標；不能確認的來源留 unparsed。
2. 公布／修正／生效／擷取日期分開。觀測到內容改變不等於官方當日修法。
3. 同字號可以對應多筆函釋。引用數是收錄記錄數，不能解讀成法規爭議程度。
4. 附件、表格、公式與歷史效力要回原站核對。修正來源名稱或 ID 時先查既有收藏與分享網址的相容性。

CI 會驗證資料、索引搜尋、搜尋品質案例、型別、離線包與版本遷移，以及引用目的地、所有生成法規頁的原文保真、錨點與 sitemap。生成的 public/data/v2/、runtime JSON、dist/、openlawtw.html 由 build 產生；Git 管理原始資料、歷史觀測紀錄與建置腳本即可。

共用輸出 /data/aliases.json、/data/yinxian-laws.js 來自同一份資料，供引線或其他工具接入。這個儲存庫不直接修改引線擴充套件。

## GitHub Desktop 與程式結構
以 GitHub Desktop 開啟儲存庫，修改後 Commit、Push，再建立 PR；原始碼沒有檔案數量限制。不要提交 node_modules、dist、runtime JSON 或建置生成的 public/data/v2。

引用辨識在 lib/citations.ts，網址在 lib/routes.ts，畫面元件在 components/legal-reference-text.tsx，靜態頁生成在 scripts/build-pages.mjs 與 scripts/static-html.mjs。修改這些功能後執行 npm run build、npm run typecheck、npm run check。新增引用規則時，需同時提供應連結與不應推測的案例；有目的地不等於語義判讀正確，仍需人工核對原文語境。

## 介面文字

網站自行撰寫的內文、按鈕與提示不使用 emoji；使用清楚文字或既有 SVG 圖示。不得為了介面風格刪改官方原文。

官方批次 XML 暫時無法取得時，可用 `--add-only --central-html data/industrial-central-sources.json` 明示加入已核對的 MOJ HTML 來源；保留 LawAll 與 LawHistory 的獨立原始 hash、日期及生效提示，並執行 parser 單元測試與 `validate-data.py --cache ... --source-ids ...` 完整來源比對。這條路徑不將既有批次快照換成 HTML。
