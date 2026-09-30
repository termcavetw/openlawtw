# 工業擴廠、工廠登記與非都市土地資料增補（v0.20.0）

## 缺漏與本次範圍

2026-09-30 對 main `6c7afd64e8ea9f613d43723c6f1320b3ed7e6bdc` 核對：`J0030099`《興辦工業人使用毗連非都市土地擴展計畫申請審查辦法》未存在於原始法規集合，不只是搜尋未命中。既有《工廠管理輔導法》《非都市土地使用管制規則》《區域計畫法》《建築法》《水利法施行細則》等已收錄。

本次補入直接授權、工廠設立登記、毗連擴廠、特定工廠土地變更及農地變更審查的 11 部全文、239 條／點。原有 1,013 部法規記錄逐筆保持不變。更新後為 1,024 部索引、994 部條文全文、19,680 條／點；既有 30 份原文文件與 9,054 筆函釋不變。

## 新增來源

| 法規／行政規則 | ID | 條／點 | 官方來源 |
| --- | --- | ---: | --- |
| 興辦工業人使用毗連非都市土地擴展計畫申請審查辦法 | J0030099 | 22 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030099) |
| 產業創新條例 | J0040051 | 87 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0040051) |
| 工廠管理輔導法施行細則 | J0030068 | 18 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030068) |
| 工廠從事物品製造加工範圍及面積電力容量熱能規模認定標準 | J0030117 | 7 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030117) |
| 工廠設立許可或核准登記附加負擔辦法 | J0030119 | 16 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030119) |
| 特定工廠登記辦法 | J0030152 | 31 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030152) |
| 特定工廠申請變更編定為特定目的事業用地審查辦法 | J0030153 | 16 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030153) |
| 申請工廠設立許可及登記事項收費標準 | J0030044 | 5 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0030044) |
| 農業用地變更回饋金撥繳及分配利用辦法 | M0020018 | 11 | [MOJ](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=M0020018) |
| 農業主管機關同意農業用地變更使用審查作業要點 | 農業部-FL014304 | 19 | [農業部](https://law.moa.gov.tw/LawContent.aspx?id=FL014304) |
| 臺中市政府受理非都市土地使用管制規則第三十二至三十四條申請變更編定丁種建築用地審查作業要點 | 臺中市-GL003092 | 7 | [臺中市](https://law.taichung.gov.tw/LawContent.aspx?id=GL003092) |

法規頁的官方附件全部保留連結，包括 J0030099 的[低污染事業認定附表](https://law.moj.gov.tw/LawClass/LawGetFile.ashx?FileId=0000365522&lan=C)。附件本身未新增為可離線閱讀或全文搜尋的 PDF；不得把「全文」統計解讀成附件也完成收錄。

《產業創新條例》官方頁的部分條文尚未生效提示完整保存在 `effectiveNote`；未由最後一條推斷全法單一生效日期。臺中來源僅列公發布日，未虛填為修正日。分類及「工業擴廠」「毗連擴廠」「特登」是查找用編輯欄位，不增寫官方法律解釋。

## 方法與重現

本次官方 bulk XML 下載端點回覆 502／connection refused，改用實際下載的 MOJ LawAll 和 LawHistory HTML。新增明示 `--central-html` 路徑，僅允許 `--add-only`，逐筆保存 SHA-256、實際取得時間及獨立沿革頁來源；沒有將 HTML 偽稱為 XML，也沒有改寫既有批次來源。

```sh
python scripts/sync-laws.py --add-only --central-html data/industrial-central-sources.json --only-sites 臺中市,農業部
python scripts/validate-data.py --cache .law-cache --source-ids J0030099,J0040051,J0030068,J0030117,J0030119,J0030152,J0030153,J0030044,M0020018,臺中市-GL003092,農業部-FL014304
python -m unittest discover -s scripts/tests -v
python scripts/sync-guard.py .sync-before.json
npm run snapshot
npm run build
npm run typecheck
npm run check
```

獨立驗證比對所有新增條文、條號、附件、沿革及原始回應 hash。新增資料沿用索引、版本封存、靜態法規頁及離線包管線；法規 ID 可直接查找。PWA 的 `/laws/index.html` 與 `/` 共用同一離線 app shell，避免預下載重複索引頁，維持原有 3 MiB 初始殼層預算。

## 閱讀排版

條文行高由 1.95 收為 1.7；項間距由 .8em 收為 .45em，款／目由 .4em 收為 .15em。原文段落、項款資料及字級控制保持不變。桌機、手機斷點有 CSS／實際元件文字保真回歸測試；銀白石墨配色及函釋最多三行節錄保留。

## 尚未納入及界線

- 近名舊規《興辦工業人申請利用毗連非都市土地擴展計畫及用地面積審查辦法》已廢止，未當作現行法新增。
- 桃園《興辦工業人申請利用毗連非都市土地擴展計畫審查認定基準》為掃描 PDF，本次未經完整 OCR／版面核對，未捏造成條文。[官方下載頁](https://edb.tycg.gov.tw/News_Content.aspx?n=3841&s=847513)
- 《興辦工業人申請利用特定農業區之毗連非都市土地擴展計畫及用地處理計畫》是核定計畫，尚未進行原檔逐頁核對，不混充為 MOJ 法規命令。[官方申辦來源](https://www.chcg.gov.tw/DTO/greenenergy/06service/service01_con.aspx?data_id=18897&topsn=4594)
- 本次不是全國所有工業法規或各縣市擴廠行政規則的完整盤點，不提供個案適用結論。

## 本機驗證結果

2026-09-30：建置、TypeScript、全部 `npm run check` 通過；163/163 搜尋案例、1,024 靜態法規頁、19,680 條／點原文保真、7 個 MOJ 解析單元測試、11 部新增來源完整比對、既有無障礙圖文原檔檢查通過。初始離線殼層 2,995,877 bytes，仍低於 3 MiB。瀏覽器視覺與遠端 CI／部署結果須另以發布後核對為準，以上並非遠端完成聲明。
