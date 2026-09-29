# openlawtw schema v2 與靜態資料 API

入口為 /data/manifest.json，schemaVersion 固定為 2。此版為靜態檔案 API，沒有後端或 MCP server。

## 取得一部法規
manifest.laws[法規ID] 提供 url、sha256、bytes。取得該 URL 的 JSON，即為該部法規。URL 含完整 SHA-256；相同內容重建會得到相同 URL，可長期快取。/data/manifest.json 會隨部署版本更新。

每份 Law 保留原有 id、name、url、source、modified、effective、articles，並加入：
- schemaVersion：2。
- contentHash：規範化文件內容的 SHA-256，排除抓取時間、批次日期與編輯備註。
- sourceRecordId：查找來源觀測資料的鍵，中央 CF／CM 是 XML 批次檔。
- version.observedAt：本庫首次觀測這一內容版本的時間。
- version.previousContentHash：上次已記錄內容；初始基準為 null。
- version.officialModified、effectiveDate：來源所列法規整體日期，不能當作各條修正日。

法規文字沒有整份 search.json 複本。manifest.indexes 是分片倒排索引；中央依穩定 ID 雜湊分成 16 組，地方按縣市，函釋按 ID 區間。encoding=gzip 的 .bin 為明確壓縮資料，先校驗下載位元組的 sha256，再 gzip 解壓為 JSON。不同輸出主機不需猜測 .gz 的 HTTP 編碼。

## 條、項、款、目
Article 仍有 no、text、path，另有穩定 id、anchor、contentHash、officialAmendedAt 與 structure。文字原樣保留；officialAmendedAt 目前為 null，來源沒有逐條修正日。

```json
{
  "id": "D0070115/a:164-1",
  "anchor": "a-164-1",
  "no": "第 164-1 條",
  "structure": {
    "status": "parsed",
    "method": "moj-xml-line-boundaries-v1",
    "units": [
      {
        "id": "D0070115/a:164-1/p:1",
        "kind": "paragraph",
        "number": 1,
        "start": 0,
        "end": 216,
        "children": []
      }
    ]
  }
}
```

上例只示意第一項；實際 children 包含三款。單位 ID 依條號與項款序位組成，不因文字調整改號。start/end 為原文的 UTF-16 半開區間，與 JavaScript string.slice 相同。Python 消費端要轉成 UTF-16 索引，不能直接視為 Unicode code point。

只對可確認的中央 XML 行界與連續列款解析；含表格、縮排續行、異常列款或地方 HTML 混合換行時保留 unparsed、空 units 與 reason。禁止為不明段落補造第幾項。

分享網址範例：
```text
/laws/D0070115.html#a-164-1-p-1-i-2
```

v0.9.0 使用上方獨立頁面網址，舊的 `#law=…&article=…&unit=…` 仍可讀取。每頁保留所有已確認的條項款錨點。

條號增刪仍保留官方 no；不代表舊版本同一序位永遠有同義內容。引用時應附本庫版本與官方網址。

## 函釋與相關目錄
manifest.rulings 的鍵為 floor(Number(id)/256)，每片是該 ID 區間的完整 Ruling 陣列。區間固定，新增資料不會令後面所有分片移位。
v0.8.1 新增 manifest.rulingCounts，指向獨立的 `{[lawId]: {total, articles: {[normalizedArticleNo]: count}}}` 筆數表。total 依官方函釋 ID 計數；同一函釋重複引用同一條只計一次，不同 ID 的同字號仍分別計數。零筆的法規也有紀錄。本文分片不混入衍生函釋統計，函釋更新不會改變官方條文的內容雜湊。此表包含於每個離線包。

manifest.related[lawId] 是該法規的函釋摘要，summaryOnly=true、body 空字串僅代表摘要；開全文時必須依 id 載入正式紀錄。summaryOnly 未設定且 body 空白，才是官方僅提供主旨／字號的項目。manifest.rulingHeads 供全庫目錄，不能當作原文匯出。
閱讀條文先載入筆數表；只有使用者開啟函釋按鈕或分頁才下載 related，全文仍依需下載。
同 numberKey 保留多筆 ID；下載 UI 匯出會讀取所有全文分片。

## 來源與觀測歷史
manifest.provenance 指向原始來源檔雜湊。hashScope 明列 downloaded-xml-file、downloaded-html-file 或 downloaded-json-feed；它不是虛構的逐部原始檔雜湊。contentHash 與資料傳输檔 sha256 也各有不同用途。

data/history.json 是可提交至 Git 的觀測帳本；npm run snapshot 只在內容變更時增加紀錄，記錄變更條號與前後內容雜湊。v0.7 建立初始基準，不回填不存在的歷史。Git 保留原文版本；本版 UI 不提供完整修法紅綠比對。

## 查找與離線
索引只儲存文件位置與 CJK 字元、雙字的 delta-varint/base64 posting lists，沒有再次複製整段原文。候選交集後才載入對應法規／函釋，並用精確條號、別名、全部關鍵字及原文再驗證。

manifest.packs 描述中央、22 縣市和函釋包。首次只快取介面，選包採完整性校驗與成功後寫入收據；更新失敗保留舊版本。介面、資料、收據分開存放。瀏覽器清理空間可能使資料不完整，UI 必須如實標示。

## 共用別名
data/aliases.json 是唯一人工維護的別名來源；build 產生 /data/aliases.json 及 /data/yinxian-laws.js（named exports: aliases、laws）。其他工具可接入，不必另維護一份法規名稱／網址對照。

## 引用連結與靜態頁
`lib/citations.ts` 使用目錄正式名稱、條號與已解析的結構建立連結。`data/runtime-citations.json` 由 build 生成，只包含已知條號與連續項款數，不另維護一份條文原文。它是介面內部產物，不是穩定對外 API。

法規原文可辨識本法／本條例及保守的「依第○條」；函釋不從目前開啟的法規推測「本法」「同法」指誰。未指明項卻直接引用款時，不推測其母項。函釋引用連至本庫快照，不代表發文當時版本。

build 產生 363 個 `/laws/<id>.html` 與靜態目錄 `/laws/index.html`。法規頁包含原文 HTML、結構錨點及同一份 JSON 快照；啟動互動介面時重用當頁 JSON。網站根目錄也提供可爬取的法規目錄。sitemap 共 365 個網址；不補造逐條修正日期或 sitemap lastmod。

Service Worker 管理下的已知法規網址由已驗證介面開啟，再讀取相應資料；初次不預存所有法規 HTML。未收錄的 law ID 不套用介面回退。單檔 HTML 的內部導航沿用 hash，分享時使用網站獨立網址。

## 官方圖文文件（v0.12）

`Law.document` 保存官方 PDF 的來源、來源頁、頁數、SHA-256、擷取日及版本說明。PDF 與逐頁抽取文字由 `data/documents/catalog.json` 管理；`manifest.documents[lawId]` 指向按需下載的內容定址分片（原始 PDF base64 + 頁面搜尋文字）。PDF 原始位元組保留，不重繪尺寸圖。`coverage: link` 仍表示尚無結構化全文，UI 另顯示「圖文 PDF」；不能用文字抽取代替官方圖表。PDF 日期獨立於 MOI 索引修正日期，重新抓取 HTML 不等於更新 PDF。


## 原文文件與全站文件搜尋（2026-09-29）

`Law.document` 表示獨立原文文件，`format` 為 `pdf` 或 `html`（未提供時沿用PDF）。`coverage=full`仍只表示已拆分條文；`coverage=link`且具有`document`時已收錄原文文件，不等於僅有連結。僅來源連結必須同時沒有`document`。

- `manifest.documents[id]`：按需載入的原文文件。PDF包含原檔base64與逐頁抽取文字；HTML包含白名單清理後的正文HTML與完整文字，保留表格合併，不保留腳本、事件及站台樣式。
- `manifest.documentTexts[id]`：供搜尋驗證的文字資料`{pages:[{page,text}]}`，不含原檔PDF。索引列以`documentPage`標記實際頁碼，不借用`Article.no`。
- 公報合輯可提供`searchPages`限制搜尋正文；完整`pages`與原始PDF仍保留。`data/documents/catalog.json`的`searchRange`記錄頁碼及首尾原文界線，`startPage`設定預設閱讀頁。
- 文件結果使用`SearchHit.type=documents`與`documentPage`；全站「條文／文件」結果包含條文及文件頁。
- 網站分享路由為`/laws/<id>.html#document-page-N`；單檔版為`#law=<id>&page=N`。頁碼必須為正整數，閱讀器再依檔案頁數限制。
- Runtime目錄不再附帶完整附件清單、前言及備註；開啟法規時自內容資料取得，減少初始下載量。
- `python scripts/validate-documents.py`核對原檔、HTML文字及表格、PDF抽取文字與公報搜尋範圍。Python檢查需安裝requirements.txt。


## v0.15 版本、案件與實務來源

- `data/history.json.archive` 是完整封存的提交索引；`data/versions/objects/<sha256>.json` 保存正文與來源描述，`assets/<sha256>.<ext>` 保存原始檔及既有可讀文字。內容定址檔案不可覆寫；歷史雜湊不會被推定成不存在的歷史全文。`recordedAt` 為封存時間、`sourceRetrieved` 為資料來源擷取欄位，與官方修正／施行日期分開。
- `data/practice/ntpc-interior-forms.json` 記錄官方原始清單與 11 份書表；`sourcePageSHA256` / `sha256` 各自驗證來源頁與原始 ODT。`versionLabel` 是官方清單標示。建置為 `manifest.practiceDocuments` 的可驗證分片；原始 ODT 以 base64 保存在分片內，不與法條索引混算。
- `openlawtw-casebook` JSON schemaVersion 1：案件 folders 包含 name、notes、questions、entries。引用保存 locator、quote、contentHash、sourceHash、sourceURL、sourcePageURL、region、observedAt、officialModifiedAt、effectiveAt、capturedAt、note。匯入限制大小、驗證雜湊及安全網址，保存快照不會自動替換。


## v0.16 圖文章節衍生資料

`data/documents/readers/catalog.json` 對應 law ID 與圖文來源 JSON。每份 `reader.json` 保存官方原檔 SHA-256、章節／小節、原始逐行文字、跨頁段落與圖檔來源座標；圖檔用 SHA-256 驗證。衍生資料不改變原始 PDF、Law.article、coverage 或官方修正日期。

`manifest.documentReaders[id]` 指向不含圖片的章節目錄，保存章節、小節、搜尋文字、段落定位及各章 DataFile。各章分片按需載入，圖片以 base64 保留無損 WebP；所有分片均列入 manifest.files、所屬地區離線包與單檔 HTML。錯誤或版本不符可重試，並可切回官方原始 PDF。

既有 `#document-page-N` 仍是物理頁碼定位，圖文模式以章節和段落的來源頁碼開啟相應內容。一般法規章節只是 Article.path 的視圖分組，不改寫條文或項款。
