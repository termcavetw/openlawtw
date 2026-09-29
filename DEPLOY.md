# openlawtw v0.18.0 部署指南

專案：[termcavetw/openlawtw](https://github.com/termcavetw/openlawtw)；目標網站：[openlawtw.vercel.app](https://openlawtw.vercel.app/)。

GitHub 請提交**原始專案**，由 Vercel 執行建置。原始碼包、已建置的靜態網站與單檔 HTML 用途不同，不能互相替代。

## 選對檔案與專案根目錄

| 交付內容 | 用途 |
| --- | --- |
| `openlawtw-source.zip` 或標示「原始碼」的 ZIP | 解壓至 GitHub 儲存庫的專案根目錄，供修改、驗證與 Vercel 建置。 |
| 已建置的 `dist/` 或標示「靜態部署」的 ZIP | 供直接上傳靜態主機；不是 GitHub 原始專案。內含的 `vercel.json` 使用已建置網站設定。 |
| `openlawtw.html` | 已內嵌收錄資料的單檔閱讀版，可直接開啟；不是開發專案，也不是 GitHub 部署入口。 |

解壓後，`package.json`、`package-lock.json`、`vercel.json`、`index.html`、`app/`、`components/`、`lib/`、`public/`、`data/`、`scripts/` 和 `.github/` 應位於專案根目錄，避免額外包一層資料夾。保留 `LICENSE`、資料權利文件、第三方作者聲明及其他隨附文件。

更新既有 checkout 時，**解壓覆蓋不會刪除已退役的檔案**。原始碼增修與刪除差異都要一併更新；本次交付另有完整 Git patch 與 30 檔退役清單可供核對。若套用 patch，先確認它的基準版本與目前儲存庫一致，並處理未提交修改。若改用完整替換，先備份，保留既有 `.git/`、個人設定及未提交的工作，再依退役清單確認刪除範圍；不要直接清空整個儲存庫。

GitHub Desktop 的 Changes 應包含預期的新增、修改與刪除。不要提交 `node_modules/`、`dist/`、生成的資料分片、`.env` 真實值或 `.vercel/` 帳號設定；`.gitignore` 不會自動取消已追蹤檔案。

## 本機建置與驗證

使用 Node.js 24；`package.json` 最低要求為 22.13.0。日常網站建置使用 npm；完整官方資料／PDF 驗證另需 Python 3.12 與 `requirements.txt` 的依賴。

```sh
npm ci
python3 -m pip install -r requirements.txt
python3 scripts/validate-data.py
python3 scripts/import-accessibility-reader.py --check
npm run build
npm run typecheck
npm run check
```

Windows 若使用 `python` 啟動器，將上述 `python3` 換成對應指令即可。上述流程與 `.github/workflows/validate.yml` 的驗證步驟對應。`npm run build` 會準備資料、建置 `dist/`、產生法規靜態頁、PWA、單檔 HTML 及 `dist/openlawtw-source.zip`。只修改程式或說明文件不必執行官方同步；資料維護後的版本封存及其他核對要求見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## GitHub Desktop → Pull Request → Vercel

1. 在 GitHub Desktop 開啟既有儲存庫，確認目前未提交工作，再建立工作分支。放入原始碼更新及退役檔案的刪除差異。
2. 檢查 Changes、完成本機驗證，Commit 到工作分支，Push／Publish branch 後開啟 Pull Request。不要把未驗證的修改直接推送到受保護的 `main`。
3. 確認 GitHub Actions 的 `Validate code and legal data` 工作流程成功；其工作名稱為 `validate`。按照 [GITHUB_SETUP.md](GITHUB_SETUP.md) 設定 main 的 PR、必過檢查與憑證保護，再由維護者審閱並合併。既有保護規則不要為了這次更新而移除。
4. 在 Vercel 匯入或確認已連接這個儲存庫，Production Branch 設為 `main`，使用下列原始專案設定。
5. 合併後檢查 Vercel 的 Production deployment 成功，並核對其 commit SHA 就是這次合併的提交。GitHub 上傳成功不等於部署成功。

| Vercel 設定 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | 專案根目錄 |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

根目錄 `vercel.json` 已宣告 Vite、建置指令、輸出目錄及快取標頭。若既有 Dashboard 保留舊的空白 Build Command 或 Output Directory `.`，請改為上表；不要用 `dist/vercel.json` 蓋掉原始專案根目錄的設定。目前不需要新增環境變數、後端服務或全站 SPA rewrite。

## 部署後驗收

- 頁首顯示 `v0.18.0`。同版本的文件或介面修正仍需以 Vercel commit SHA 確認，不能只看版本號。
- 搜尋法規、選縣市、閱讀條文和函釋均可操作；`/laws/D0070109.html#a-1` 可開啟建築法第 1 條，`/#ruling=9821` 可開啟指定函釋。
- `/#view=universe` 可開啟法規宇宙；《建築物無障礙設施設計規範》可切換圖文章節／原始 PDF。手機另核對文字、章節、圖片與 PDF 開啟方式。
- 「資料與開源」與「關於」中的 GitHub、引用指南連結指向正確儲存庫；確認 GitHub 的 main 已包含 [CITING.md](CITING.md) 及相關權利文件。
- `/laws/index.html`、`/sitemap.xml` 和法規獨立頁可讀取；不存在的 `/laws/unknown-id.html` 應回應 404。既有案件引用、收藏與離線包可正常讀取。
- `/data/manifest.json` 應使用 `no-cache`；從當次 manifest 選一個實際存在的 `/data/v2/` 分片檢查，應含 `max-age=31536000` 與 `immutable`。不要拿舊版本的 hash 檔名當驗收目標。

法規獨立頁使用實體 `.html` 路徑，保留原文、canonical 與 sitemap；不需要用所有路徑都導回 `index.html` 的方式處理。若更換正式網域，需同步核對 `lib/page-meta.ts` 的 `SITE_URL` 及 `index.html` metadata，再重新建置。

本次交付更新本機專案及檔案；未代為推送 GitHub、部署 Vercel 或變更遠端保護／排程設定。以上 Production 回應標頭、手機與部署流程需在實際發布後核對。

## PWA 與離線更新

PWA 需 HTTPS 或 localhost。網站先保存介面，再由使用者選擇中央、個別縣市或函釋資料；「介面已保存」不表示全庫皆已離線可讀。官方外部連結與尚未收錄的附件仍需要網路。

更新時會核對資料雜湊，成功後切換版本；失敗時保留既有版本及已選資料。瀏覽器回收儲存空間後，使用者可能需要重新下載。法規靜態頁不會全部預先快取。

若部署成功後仍顯示舊版，可從網站的「安裝／離線」檢查更新，或開啟 [更新檢查頁](https://openlawtw.vercel.app/update.html)。更新頁不預先快取，也不會主動清除收藏。驗收時勿以清除使用者案件與收藏作為更新步驟。

## 官方資料快照與每週同步

v0.18.0 收錄 1,013 部索引、983 部條文全文、19,441 條／點及 30 份原文文件；9,054 筆函釋沿用既有資料。新增中央 XML 的來源批次為 2026-09-18，本輪新增資料取得與核對日為 2026-09-29。每筆資料保留自己的擷取、修正與生效資訊；部署日或批次日不是法規生效日。收錄仍不完整，案件適用與現行效力須核對官方原文。

`.github/workflows/sync.yml` 提供 `Review weekly official snapshots`，排程為臺灣時間每週一 04:23，可能受 GitHub 延遲。**加入工作流程檔不會啟用資料同步**：排程工作以 `ENABLE_LAW_SYNC` 為開關；手動 `workflow_dispatch` 則可獨立執行。

若維護者決定啟用：

1. 在 Settings → Actions → General → Workflow permissions 允許 GitHub Actions 建立 Pull Request。
2. 先手動執行 `Review weekly official snapshots`，檢查官方來源可連線、同步與驗證成功，並審閱產出的草稿 PR；手動執行也會更新工作分支與建立 PR。
3. 確認流程符合需求後，在 Settings → Secrets and variables → Actions → Variables 設定 `ENABLE_LAW_SYNC=true`，才會讓排程進行同步。
4. 流程會擷取資料、阻擋異常縮減、建立版本封存、建置及檢查，再更新 `data/weekly-official-snapshot` 草稿 PR；經維護者審閱與合併才進入主分支部署。

內建 `GITHUB_TOKEN` 建立的 PR 可能不會自動觸發另一個 PR workflow。若需要必過的 `validate`，請手動執行 `Validate code and legal data`，**選擇該 PR 的工作分支**，核對同一提交的 `validate` 成功後再合併；更新分支後須重新驗證，不能用 main 的綠燈代替。詳細保護設定見 [GITHUB_SETUP.md](GITHUB_SETUP.md)。

## 開源、作者與來源

程式依 [LICENSE](LICENSE) 採 MIT，保留原作者及 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。官方資料、PDF 與圖片的使用依據見 [DATA_LICENSE.md](DATA_LICENSE.md) 及[文件權利清單](data/documents/RIGHTS.md)，不因放在公開儲存庫或網站上就改採 MIT。引用與知識庫整合請見 [CITING.md](CITING.md)。

Git 提交作者與網站品牌是不同設定。需要信箱隱私時，使用 GitHub 帳號實際提供的 noreply 地址，只修改這個專案的 local 設定；不要編造地址或覆寫共同歷史。ZIP 不包含 `.git`，忽略規則及本次檔案檢查也不等於完整歷史憑證稽核。官方操作方式見 [GitHub 提交信箱說明](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)。
