# GitHub 保護設定

適用儲存庫：[termcavetw/openlawtw](https://github.com/termcavetw/openlawtw)。這份文件是設定步驟；提交文件不會自動開啟 GitHub 後台功能，也不會啟用每週資料同步。

## 先確認驗證成功

把本次修改提交到工作分支，開啟 Pull Request。在 [Actions](https://github.com/termcavetw/openlawtw/actions) 確認 `Validate code and legal data` 完成且成功，工作名稱是 `validate`。目前流程包含官方資料完整性、PDF 圖文來源、建置、型別與功能檢查。

必過檢查應從 GitHub 顯示的已執行紀錄中選取，不能只在文件中自行命名。若失敗，先查看失敗步驟並修正原因，再設定保護；不要移除檢查來取得綠燈。

## 阻擋憑證誤上傳

1. 以擁有此儲存庫管理權限的帳號開啟 [Settings](https://github.com/termcavetw/openlawtw/settings)。
2. 在側欄 `Security and quality` → `Advanced Security` 找到 `Secret Protection`；若未啟用則開啟。
3. 確認 `Push protection` 為 Enabled，查看既有 secret scanning 警示並處理。

不同帳號介面可能顯示 `Security` 或 `Code security and analysis`。請依 GitHub 當下顯示的功能確認；不需要為此建立新 token、貼出密鑰或購買方案。

`.gitignore` 排除 `.env`、`.env.*` 與 `.vercel/`，保留不含真實值的 `.env.example`／`.env.*.example`。忽略規則不會移除已追蹤檔案或歷史內容，也不能取代憑證掃描。若發現真實憑證曾公開，先在發行服務撤銷／輪替，再處理受影響的 Git 歷史。

## 保護 main 分支

先查看是否已有 Ruleset 或分支規則；已有規則時更新原規則，保留其他既有保護。尚未設定時，可使用 `Settings` → `Branches` → `Add classic branch protection rule`：

| 項目 | 設定 |
| --- | --- |
| Branch name pattern | `main` |
| Require a pull request before merging | 開啟 |
| Require approvals | 單人維護暫不要求其他人核准；仍保留 PR 與檢查流程 |
| Require status checks to pass before merging | 開啟，選取實際的 `validate` 工作 |
| Require branches to be up to date before merging | 開啟 |
| Do not allow bypassing the above settings | 開啟，讓管理員提交也遵守檢查 |
| Allow force pushes / Allow deletions | 都保持關閉 |

儲存後重新開啟規則，核對分支、必過工作與上述狀態。以一個正常的 PR 確認合併前會等待 `validate`。不要製造含真實憑證的測試提交。

## 每週同步 PR 的檢查

本專案不因開源而自動啟用 `ENABLE_LAW_SYNC`。若日後另行啟用，內建 `GITHUB_TOKEN` 建立的草稿 PR 可能不會自動觸發 PR 驗證。

此時請到 `Validate code and legal data` → `Run workflow`，**選擇該 PR 的工作分支**，等同一個提交的 `validate` 成功再合併；更新分支後需要驗證新的提交。不要選 main 的成功紀錄代替 PR 提交，也不要為了合併移除必過檢查。詳細同步步驟見 [DEPLOY.md](DEPLOY.md)。

## 完成後確認

- 儲存庫保持 Public，原有 MIT 與第三方作者聲明保留。
- Push protection 顯示 Enabled；main 規則已儲存，`validate` 已選入必過檢查。
- GitHub 上能開啟 [CITING.md](CITING.md)、[DATA_LICENSE.md](DATA_LICENSE.md) 和 [附件來源清單](data/documents/RIGHTS.md)。
- Vercel 部署成功後，「資料與開源」及「關於」頁的 GitHub／引用指南入口可以使用。

## 官方說明

- [啟用 Push protection](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/enable-push-protection)
- [設定分支保護規則](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Actions 事件與 GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
