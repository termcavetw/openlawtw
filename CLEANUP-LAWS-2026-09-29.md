# v0.18.0：專案清理與官方法規增補

新增 **29 部**：中央 12、南投 7、彰化 10；其中 28 部條文全文、1 部官方 HTML 原文文件。原有 984 部資料逐筆比對保持不變。
新增 377 條／點原文；全庫 1,013 部索引、983 部條文全文、19,441 條／點、30 份原文文件。既有 9,054 筆函釋未重新下載。

中央官方 XML 批次為 2026-09-18，下載與新增地方頁面核對日為 2026-09-29；下載日期不等於修正或施行日期。新增規定於取得的官方來源未標廢止，不據此判斷個別案件適用。中央附件保留官方連結，未將未下載的圖表宣稱為已內嵌。

## 清理範圍

清除不再被目前 manifest／PWA 引用的舊資料分片與舊 JavaScript／CSS、退役實務資料包原始資料及三支匯入／測試腳本。`.law-cache` 原始來源移至專案外備份；官方 PDF、圖文來源、歷史版本、授權、vendor、法規及函釋資料均保留。執行時逐檔校驗與備份，再移除；完整清單見清理檔案校驗紀錄。

移出專案的檔案共 2,715 個、138,375,380 bytes（約 138.4 MB）：舊建置產物 2,187 個、退役資料包原始檔及腳本 17 個、來源快取 511 個。此數字為移出的舊檔大小，未扣除本輪新增資料及新建置產物。

覆寫及移除的舊檔備份於 `C:\Users\User\Documents\Codex\2026-09-29\d-side-projects-openlawtw\work\Openlawtw-before-cleanup-law-expansion`，沿用原始相對路徑，並逐檔核對 SHA-256。

HTML 原文文件匯入流程已改為優先讀取既有來源封存，可在沒有 `.law-cache` 的專案中重建。

原文閱讀器恢復有序清單編號；只有包住單一清單的官方排版表格會收合空白欄，手機不必為這類純文字橫向捲動。真正的資料表仍保留列欄與橫向捲動。

## 新增清單

| 地區 | 法規與官方來源 | 收錄 |
|---|---|---|
| 中央 | [身心障礙福利機構設置標準](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0050048) | 27 條／點 |
| 中央 | [身心障礙者專用停車位設置管理辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0050069) | 15 條／點 |
| 中央 | [燃氣熱水器及其配管安裝標準](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0120013) | 13 條／點 |
| 中央 | [防焰性能認證實施辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0120073) | 23 條／點 |
| 中央 | [防焰物品或其材料防焰性能試驗標準](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0120074) | 12 條／點 |
| 中央 | [防火管理人訓練與專業機構登錄及管理辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0120079) | 27 條／點 |
| 中央 | [燃氣熱水器及其配管承裝業管理辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=J0130028) | 19 條／點 |
| 中央 | [室內空氣品質管理法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0130001) | 24 條／點 |
| 中央 | [室內空氣品質管理法施行細則](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0130002) | 13 條／點 |
| 中央 | [室內空氣品質維護管理專責人員設置管理辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0130003) | 9 條／點 |
| 中央 | [室內空氣品質標準](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0130005) | 5 條／點 |
| 中央 | [公告場所室內空氣品質檢驗測定管理辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=O0130006) | 18 條／點 |
| 南投縣 | [南投縣建築物設備繳納代金及管理使用自治條例](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=FL021920) | 8 條／點 |
| 南投縣 | [南投縣興辦公共工程拆遷建築改良物補償及獎勵辦法](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=FL034563) | 18 條／點 |
| 南投縣 | [南投縣都市計畫住宅區一般旅館設置審查自治條例](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=FL044609) | 7 條／點 |
| 南投縣 | [南投縣都市更新地區及更新單元劃定準則](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=FL053769) | 6 條／點 |
| 南投縣 | [南投縣簡化實施都市計畫以外地區建築管理辦法](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=GL000020) | 7 條／點 |
| 南投縣 | [南投縣營建工程賸餘土石方處理及資源堆置處理場設置管理自治條例](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=GL000179) | 44 條／點 |
| 南投縣 | [南投縣國道六號交流道路段及省縣道交會處大型廣告物擴大禁建自治條例](https://glrs.nantou.gov.tw/glrsout/LawContent.aspx?id=GL000257) | 7 條／點 |
| 彰化縣 | [彰化縣都市設計審議作業程序](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=FL026537) | 8 條／點 |
| 彰化縣 | [彰化縣建築開發業管理自治條例](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=FL028115) | 8 條／點 |
| 彰化縣 | [彰化縣都市設計審議委員會設置辦法](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=FL044145) | 11 條／點 |
| 彰化縣 | [彰化縣都市計畫保護區農業區土地容許使用審查要點](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=FL050628) | 12 條／點 |
| 彰化縣 | [彰化縣都市計畫甲種及乙種工業區申請設置工業發展有關設施暨公共服務與公用事業設施使用案件處理原則](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=FL088017) | 12 條／點 |
| 彰化縣 | [彰化縣政府辦理都市計畫農業區已建築供居住使用之合法建築物基地認定作業要點](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=GL000109) | 12 條／點 |
| 彰化縣 | [彰化縣政府受理提議劃定更新地區作業原則](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=GL000367) | 5 條／點 |
| 彰化縣 | [彰化縣政府受理違章建築檢舉要點](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=GL000439) | 官方 HTML 原文、可搜尋 |
| 彰化縣 | [彰化縣都市更新權利變換計畫提列共同負擔項目及費用審議原則](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=GL000453) | 3 條／點 |
| 彰化縣 | [彰化縣都市更新權利變換最小分配面積單元標準](https://lawsearch.chcg.gov.tw/GLRSNEWSOUT/LawContent.aspx?id=GL000465) | 4 條／點 |

## 驗證

原有 984 部快照不變、新增官方原文逐條與來源 SHA-256 核對；搜尋回歸新增 8 組查找及 1 組原文文件內文案例。執行資料驗證、版本封存、TypeScript、正式建置與既有測試。桌面與手機檢查新增資料的搜尋與閱讀。

本次僅更新本機專案及交付產物，未部署至線上網站。
