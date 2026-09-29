# openlawtw v0.14.1 部署
目標網址：https://openlawtw.vercel.app

v0.14.1 修正宇宙圖整頁向左上偏移：改用獨立滿版 Dialog，移除一般置中彈窗的 -50% 平移。GitHub Desktop 更新請使用檔名帶 v0.14.1 的原始碼 ZIP；覆蓋根目錄內容、Commit 後 Push。

v0.14 新增「法規宇宙」。部署完成後點頁首入口，或開啟 `https://openlawtw.vercel.app/#view=universe`。此版仍保留 v0.13.1 的閱讀入口與可調整函釋欄。無新增環境變數與服務；不需另設 rewrite。

v0.13.1：桌機函釋並讀欄支援拖曳分隔線調整寬度並記住設定；雙擊或 Enter 恢復預設，方向鍵微調。函釋標題區限制高度，保留原文閱讀空間。

v0.13 修正入口：首次開啟直接進工作區，再次開啟恢復本機最後閱讀法規及條文位置。Logo 聚焦搜尋；縣市切換保留正文。介紹頁需主動點「關於」，返回閱讀可接續原位置。

本次加入搜尋首頁、縣市指南及《建築物無障礙設施設計規範》105 頁官方圖文 PDF。PDF 按需載入，包含頁內查找、章節跳轉與下載；尚未拆為項款條文。

本版交付的是 **Vercel 建置專案**。部署包與原始碼包內容相同、擇一使用，均為 126 個原始檔，不再限制為 100 檔。資料分片、法規 HTML 與 sitemap 由 Vercel 建置時產生。

## GitHub → Vercel
1. 在 GitHub Desktop 選擇 openlawtw 儲存庫並開啟本機資料夾。解壓 openlawtw-pwa.zip（或 openlawtw-source.zip），把內容放到儲存庫根目錄；package.json、vercel.json、app、public、scripts 必須在根目錄，避免多包一層資料夾。
2. 在 GitHub Desktop 檢查 Changes，Commit 到主分支後 Push origin；.gitignore 已排除 node_modules、dist 與生成的資料分片。
3. 在 Vercel 匯入這個 GitHub 儲存庫，設定如下。
4. 首次部署完成後，開啟網站檢查條文與函釋，再從「安裝／離線」下載需要的縣市。
5. GitHub 的 .github/workflows/ 也要一併上傳，才會有 PR 驗證與定期同步。

| 設定 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | 儲存庫根目錄 |
| Node.js | 24.x（或 >=22.13） |
| Install Command | npm ci |
| Build Command | npm run build |
| Output Directory | dist |

**從 v0.6 更新既有 Vercel 專案時**，將 Dashboard 中舊有的空白 Build Command、Output Directory「.」覆寫設定改為上表。新版根目錄 vercel.json 已包含建置與快取標頭。部署產出的 dist/ 可直接供靜態主機使用；GitHub 儲存庫請提交原始專案，讓 Vercel 生成 dist，不必提交生成的數百個檔案。

## 三種使用方式
- 線上網站：先載入介面與選定法規，開始搜尋時才載入所需地區和函釋索引。
- PWA：HTTPS 或 localhost 可安裝；選擇中央、個別縣市、函釋全文作為離線包。
- 單檔 HTML：直接開啟 openlawtw.html，全部資料與程式均內嵌。需支援 DecompressionStream 的現代瀏覽器。

## 確認 v0.14.1
部署成功後，頁首會顯示 **v0.14.1**。開啟《建築法》：桌機條號和「函釋 N」在正文左側小欄；手機改成正文上方一列，正文恢復全寬，頂列顯示「搜尋」「離線」。點選函釋後，桌機左側開啟並讀區，手機出現底部抽屜。新訪客範圍為全台，既有使用者保留原先選擇。

首頁搜尋「無障礙規範」，即可開啟圖文規範；點選「載入圖文與頁內查找」後，可搜 206.2 定位 PDF 第 24、25 頁。原檔約 3.12 MB，含頁面抽取文字的分片約 4.3 MB；此分片不列入首裝快取，已選中央離線包者更新時會補下載。

可檢查的網址：
- `/#region=臺北市`：臺北市範圍工作區；介紹／指南改為 `/#view=about&region=臺北市`。
- `/laws/內政部-GL000734.html`：無障礙圖文規範。
- `/laws/屏東縣-FL026602.html`：新增的屏東縣建築管理自治條例。
- `/laws/臺北市-FL038035.html`：新增的臺北市一定規模以下建築物免辦理變更使用執照管理辦法。
- `/laws/D0070109.html#a-73-p-2`：直接開啟建築法第 73 條第 2 項；重新整理仍停在該項。
- `/#ruling=17111`：內文「建築法第73條第2項」可點擊跳轉。
- `/laws/index.html`：不啟用 JavaScript 也可展開縣市目錄。
- `/sitemap.xml`：628 個網址；每個法規頁有自己的標題、描述及 canonical。

首次直接開啟法規獨立頁時，原文與當頁 JSON 已在 HTML 中，互動介面重用該 JSON。由首頁進入或受 Service Worker 管理時，仍依需讀取法規分片。函釋筆數表為 42,596 bytes，按「函釋」才下載該法規相關摘要；建築法摘要為 1,419,698 bytes。這些是未計 HTTP 壓縮的檔案大小。

程式及檔案已更新不等於線上網站已更新；請確認 Vercel 的 Production deployment 使用本次上傳的 commit。

## 快取與升級
新裝置預快取 12 個介面與目錄檔案，約 2.95 MB（未計 HTTP 壓縮）；閱讀資料按需載入並保存。每部法規和固定區間函釋各有內容雜湊，變動時只抓新的資料分片與受影響的索引。

v0.7 → v0.10.0 使用相同分片格式，未變更的資料可重用。v0.8.1 增加共用的函釋筆數表，已選離線包只須補抓此新資料檔及新版介面。已選的離線包在升級時會一起校驗，全部成功才切換。失敗保留舊介面及已選資料。v0.4–v0.6 已存完整資料的裝置會做一次完整格式遷移，以保留原有離線範圍；完成後可在管理介面移除不需要的包。收藏不受版本快取影響。

「網站介面已保存」不表示所有資料已下載。離線搜尋缺少資料時會顯示結果不完整。包容量為上限，共用分片只存一次。瀏覽器回收空間後，管理介面會標示需要重新下載。

法規靜態頁不會全部預快取；離線可閱讀已保存法規，尚未下載的法規仍需連線。獨立 HTML 約 33.48 MB，已內嵌全部收錄資料。

網站有新版本時，安裝／離線入口會提示更新；若仍顯示舊版，可開啟 https://openlawtw.vercel.app/update.html 檢查更新。該頁不預快取，也不會清除收藏。

## 部署後確認快取標頭
一般資料規則為 `/data/:filename`，只匹配資料目錄第一層；內容定址分片 `/data/v2/(.*)` 使用 immutable，兩條規則不重疊。請在自己的 Production 部署後確認：

```sh
curl -I https://openlawtw.vercel.app/data/manifest.json
curl -I https://openlawtw.vercel.app/data/v2/ruling-counts-245c70055413fa25df950a5f6a54ac9283a17e60df37098f2b23b6bb5d6ac2ea.json
```

前者應為 no-cache，後者應包含 max-age=31536000 與 immutable。也請確認 `/laws/D0070109.html` 返回 HTML 原文、canonical 指向該獨立頁，且 `/laws/unknown-id.html` 返回 404。本版使用實體 .html 路徑，不需要全站 SPA rewrite。本次僅驗證專案設定，尚未驗證 Vercel 實際回應標頭。

## 搜尋引擎入口
正式部署後可向 Google Search Console 提交 `https://openlawtw.vercel.app/sitemap.xml`。靜態 HTML、真實連結與 sitemap 已生成；是否收錄與排名由搜尋引擎決定，本次沒有驗證 Google 實際收錄。更換網域時，需同步修改 lib/page-meta.ts 的 SITE_URL 及 index.html 的網站 metadata 後重新建置。

## 啟用每週同步
先在 GitHub Actions 頁面手動執行「Review weekly official snapshots」。確認流程與官方來源能正常連線後：
1. 在 Settings → Actions → General → Workflow permissions，允許 GitHub Actions 建立 pull request。
2. 在 Settings → Secrets and variables → Actions → Variables 新增 ENABLE_LAW_SYNC，值為 true。
3. 排程為臺灣時間每週一 04:23；GitHub 可能延遲執行。

流程擷取官方資料、保留無法取得的舊快照、檢查資料縮減和解析異常、執行全部驗證，再建立草稿 PR。維護者看過差異後合併，Vercel 才會從主分支部署。此交付未在任何遠端儲存庫啟用排程或部署。

預設 GITHUB_TOKEN 產生的 PR 不一定觸發另一個 PR workflow；同步工作本身已執行全部檢查。需要獨立 required check 時，可由維護者手動執行 Validate workflow 或配置專用 GitHub App，勿直接略過驗證。

## 收錄範圍
本版新增 257 部地方全文及 6 部官方來源索引，涵蓋 15 個縣市。全庫 626 部索引、610 部全文、15,992 條／點原文、290 條法源關係。臺北全文 47 部、新北 61 部、臺中 30 部、屏東 19 部。完整清單與缺口見 LOCAL-LAWS.md。

中央 XML 仍為 2026-09-18 快照；新地方頁面於 2026-09-28 擷取。既有 353 部全文保持不變。9,054 筆函釋來源未重新下載；依新目錄重建後有 7,923 筆明示條號關聯。官方附件與歷史法規仍由原站查閱。

## 本版資料更新注意

新版本的離線包包含新增地方法規；已選包會由現有升級流程補抓新增或變更的分片。原始碼包與部署包完全相同，擇一解壓到 repo 根目錄即可。公開資料來源未全部成功連線，網站的收錄清單保留未取得全文的狀態，不以總部數代表全台收錄完整。

## 公開儲存庫前：品牌、作者與支援範圍

1. 可將儲存庫放在品牌 organization 下；`termcave` 是希望使用的名稱，尚未確認名稱可用性，也尚未建立組織或儲存庫。取得實際網址後再填 README／網站連結，勿先加入不存在的連結。目前網站的原始碼入口仍下載本站 ZIP。
2. Organization 不會遮蔽提交者帳號。`user.name` 只改提交顯示名稱，GitHub 仍可能依 email 關聯個人帳號；noreply 地址也可能包含使用者名稱。這是品牌整理與信箱隱私設定，不是匿名保證。
3. 首次 Commit 前，在 GitHub 帳號的 Email 設定取得該帳號實際提供的 noreply 地址。不要把聯絡信箱當成 commit 信箱，也不要自行編造 `termcave@users.noreply.github.com`。
4. 從 GitHub Desktop 開啟本儲存庫的終端機，只設定此專案，避免改動其他工作的全域作者資訊：

```sh
git config --local user.name "termcave"
# 下行佔位文字必須換成 GitHub 帳號 Email 設定中顯示的實際地址。
git config --local user.email "YOUR_GITHUB_PROVIDED_NOREPLY_EMAIL"
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

5. 如已有 commits，發布前自行檢查作者、提交者及舊內容：

```sh
git log --all --format="%h %an <%ae> | %cn <%ce>"
```

改設定不會更新歷史 commit；不要直接對已共用的歷史強制覆寫。原始碼 ZIP 不包含 `.git`，本次檔案掃描不涵蓋你電腦或遠端儲存庫的歷史，也不構成完整憑證稽核。
6. 若決定只收 PR，可在儲存庫 Settings → General → Features 取消 Issues；這是 GitHub 設定，README 或模板無法代為關閉。本次未變更遠端設定。
7. README／CONTRIBUTING 已列明：官方來源資料 PR，或寄信至 termcavetw@gmail.com；不提供個別支援，不承諾回覆或補齊時程。聯絡信箱會公開出現在這些文件中。保留既有 MIT 與第三方授權聲明，不因更換品牌刪除原作者歸屬。

官方說明：
- https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address
- https://docs.github.com/en/account-and-profile/concepts/email-addresses
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/disabling-issues
