# 引用與資料整合指南

Openlawtw 是官方資料的整理與查找入口。引用法規、函釋或圖表時，建議同時保留官方原文來源與 Openlawtw 連結，讓讀者能核對原文、找到位置。

本頁提供可追溯的引用方式，不新增授權條件。程式授權見 [LICENSE](LICENSE)；官方文字、PDF、圖片與第三方內容的使用依據見 [DATA_LICENSE.md](DATA_LICENSE.md) 及[文件權利清單](data/documents/RIGHTS.md)。回連 Openlawtw 是引用建議，不是額外的 MIT 義務；也不以本指南限制 MIT 所允許的商業使用。

## 複製哪一個網址

優先使用法規或函釋閱讀頁的「連結」按鈕，並保留「官方原文」網址。以下是目前實作的網址格式：

| 對象 | Openlawtw 格式 | 說明 |
| --- | --- | --- |
| 整部法規 | `/laws/{法規ID}.html` | 例如 `/laws/D0070109.html`。法規 ID 含中文時應以 `encodeURIComponent` 編碼。 |
| 指定條文 | `/laws/{法規ID}.html#a-{條號}` | 例如建築法第 1 條為 `/laws/D0070109.html#a-1`；第 77-2 條為 `#a-77-2`。 |
| 已解析的項、款、目 | 條文錨點後接 `-p-{項}-i-{款}-s-{目}` | 依實際結構省略後續層級；只有已解析且存在的座標可用，不能由文字順序猜測。 |
| 函釋 | `/#ruling={函釋ID}` | 例如 `/#ruling=9821`。函釋 ID 是本庫紀錄識別碼，不等於發文字號；目前沒有 `/rulings/{ID}.html` 路徑。 |
| PDF 頁面 | `/laws/{法規ID}.html#document-page-{頁碼}` | 頁碼從 1 起算，包含封面與目錄，可能不同於印製頁碼。圖文章節閱讀器會定位對應內容。 |

`{法規ID}`、`{條號}`等是占位符，不能直接當作網址使用。完整網址需加上站台根網址 `https://openlawtw.vercel.app`。網頁更新可能改變收錄內容；固定入口不等於固定版本，也不是永久不變的法律文本。

## 引用範例

以下範例的日期來自本庫已收錄紀錄，用來示範格式，不表示已於你閱讀當天再次核對官方網站。正式使用時請填入實際查閱日期，並核對當時的官方版本。

### 法規與條文

> 《建築法》第 1 條。官方來源：全國法規資料庫；本庫所載修正日期：2022-05-11；本庫擷取日期：2026-09-28（UTC）。查閱日期：請填實際日期。

- [官方原文：建築法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0070109)
- [Openlawtw：建築法第 1 條](https://openlawtw.vercel.app/laws/D0070109.html#a-1)

修正日期是整部法規來源欄位，不表示每一條都在同一天修正。若需要特定條文的修正時間，請另核對官方沿革；未列生效日期時，不應直接用修正日代替。

### 函釋

> 內政部函 87.07.02.台內營字第8772186號，主旨「檢送關於領得建造執照之建築物辦理變更設計法令適用疑義，請查照依會商結論辦理。」發文日期：1998-07-02；來源所載更新日期：2018-10-08；本庫函釋資料擷取日期：2026-09-28。查閱日期：請填實際日期。

- [官方原文：國土管理署函釋紀錄 9821](https://www.nlma.gov.tw/ch/titlelist/interpcomp/9821)
- [Openlawtw：函釋紀錄 9821](https://openlawtw.vercel.app/#ruling=9821)

發文日、來源頁更新日與本庫擷取日不同；更新日不代表重新發文。同字號可能有多筆紀錄，請保留函釋 ID、發文機關、完整字號與官方 URL，不能只憑數字字號合併。引用連線、收錄狀態或正文提及「停止適用」，都不能單獨用來判斷這筆函釋是否仍適用。

### PDF 與圖表

引用 PDF 或裁圖時，建議記錄文件全名、官方版本說明、PDF 實體頁碼、印製頁碼／章節或圖號，以及官方來源頁與原檔連結。以已收錄的《建築物無障礙設施設計規範》為例：

- [官方發布頁](https://www.nlma.gov.tw/ch/legislation/regsearch/927)
- [官方 PDF 原檔](https://www.nlma.gov.tw/uploads/files/e9abb44ff171074d23a7d1d5ee35b4a4.pdf)
- [Openlawtw：PDF 第 1 頁](https://openlawtw.vercel.app/laws/%E5%85%A7%E6%94%BF%E9%83%A8-GL000734.html#document-page-1)
- 本庫原檔擷取日：2026-09-28。原檔 SHA-256：`1ff0c1cc4cb27c6f74219bfb0d264cac056f88fe9109e36031c53cd6358c0245`。
- 本庫版本說明：官方頁列於 109 年 5 月 11 日勘誤的「全文-最新」附件；PDF 封面仍列 108 年 1 月 4 日修正、108 年 7 月 1 日生效。這些日期應分別保留。

圖文章節中的圖片由收錄的原 PDF 擷取；它們不因轉成 WebP 或顯示在網站上就改採程式的 MIT 授權。圖表尺寸、表格與公式請核對原檔，並依[文件權利清單](data/documents/RIGHTS.md)查看使用依據與待核實項目。

## 整批匯入知識庫、搜尋或 AI 工具

為了能回溯每筆回答，建議在匯入時保留以下資料；這些是資料品質做法，並非新增的程式授權義務：

| 保存項目 | 本庫可用來源或欄位 |
| --- | --- |
| 原始紀錄與位置 | 法規 `id`、`name`、`region`、條文 `no`；函釋 `id`、`number`；PDF 頁碼與圖號。不要只存切片文字或向量。 |
| 官方來源與查找入口 | 法規／函釋 `url`，文件的 `document.source` 與 `document.sourcePage`，以及對應 Openlawtw 連結。 |
| 官方日期 | 法規 `modified`、`effective`、`effectiveNote`；函釋 `date`、`published`、`modified`。缺值保留未知，不推算適用日期。 |
| 擷取與觀測日期 | 法規 `retrieved`、文件 `document.retrieved`；函釋批次的 `stats.retrieved`；`data/provenance.json` 的 `observedAt`。函釋批次日期不是逐筆再次核對紀錄。 |
| 批次與版本 | 來源批次 `snapshot`、資料清單的批次資訊、匯入時的 Git commit SHA，以及你自己的匯入時間。網站程式版本號不能單獨識別法規版本。 |
| 內容與原檔雜湊 | 有提供時保存 `contentHash`、`document.sha256`、來源的 `sha256` 及 `hashScope`。`data/history.json` 保存內容觀測與封存索引；不同計算範圍的 SHA-256 不能互相替代。 |
| 使用依據與加工方式 | 保留來源的權利聲明、必要標示、PDF 權利清單與擷取方法；你自行加入的摘要、分類或 AI 回答應與官方原文分開。 |

資料檔結構見 [`lib/law-types.ts`](lib/law-types.ts)，來源紀錄見 [`data/provenance.json`](data/provenance.json) 和 [`data/documents/catalog.json`](data/documents/catalog.json)。上述檔案是專案目前的資料結構，不是承諾相容性、更新頻率或服務水準的公開 API。

需要固定證據時，請在使用依據允許的範圍內保存實際引用文字／原檔、來源與日期，並計算雜湊。只保存網址或 hash 無法重建舊正文。本庫版本封存只涵蓋已保存的觀測版本，不代表完整官方沿革；較早只有 hash 的紀錄也不能還原全文。

更新知識庫時，記錄內容何時改變，重新核對引用位置與官方來源，並保留舊引用對應的版本。請避免將資料擷取日、批次日、Git 提交日或索引更新日當成法律修正、生效或官方確認日期。

## 回報引用或來源問題

發現錯誤請依 [CONTRIBUTING.md](CONTRIBUTING.md) 提供官方網址、法規／函釋 ID、條號或 PDF 頁碼、觀測日期與具體差異。一般缺漏可送 PR；若涉及個人案件，請不要公開非必要個資或未公開文件。
