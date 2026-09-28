# 貢獻 openlawtw

歡迎補充法規俗稱、官方來源、漏收條文與資料校正。請附官方來源網址與要修正的具體位置。分類是閱讀輔助；母子法關係須有條文證據。

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
