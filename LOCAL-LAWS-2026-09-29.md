# 2026-09-29 各縣市搜尋資料增補

22 縣市現在均有可搜尋的法規全文。本次沿用建築相關規定範圍，並非全台全部自治法規。

全庫由 626 部索引／610 部全文，增為 984 部索引／938 部全文／18,956 條原文；新增索引 358 部，增加全文 328 部。既有 610 部全文逐筆比對保持不變，中央 XML 與函釋快照未重新下載。

| 縣市 | 原全文 | 本次後全文 | 僅來源連結 |
| --- | ---: | ---: | ---: |
| 臺北市 | 47 | 47 | 1 |
| 新北市 | 61 | 61 | 0 |
| 桃園市 | 42 | 42 | 0 |
| 臺中市 | 30 | 30 | 0 |
| 臺南市 | 31 | 31 | 0 |
| 高雄市 | 31 | 31 | 0 |
| 基隆市 | 0 | 58 | 2 |
| 新竹市 | 18 | 18 | 0 |
| 新竹縣 | 19 | 19 | 1 |
| 苗栗縣 | 15 | 15 | 0 |
| 彰化縣 | 17 | 17 | 0 |
| 南投縣 | 13 | 13 | 1 |
| 雲林縣 | 0 | 33 | 2 |
| 嘉義市 | 0 | 46 | 18 |
| 嘉義縣 | 0 | 47 | 4 |
| 屏東縣 | 19 | 19 | 0 |
| 宜蘭縣 | 0 | 62 | 3 |
| 花蓮縣 | 0 | 64 | 4 |
| 臺東縣 | 18 | 18 | 2 |
| 澎湖縣 | 16 | 16 | 0 |
| 金門縣 | 17 | 17 | 1 |
| 連江縣 | 2 | 20 | 5 |

## 原文與完整性

每筆已收錄全文均保留官方來源及擷取日期，核對條文列數、原文及 SHA-256；未編號前言、複雜表格或無法完整拆分的內容，保留來源與附件並明示待解析。官方標示廢止／停止適用的 24 筆候選不列為現行資料。

雲林以瀏覽器取得官方頁面 DOM；來源雜湊範圍明示為 `browser-dom-html`。其他新增來源為官方 HTML 下載。擷取日期不等於法規修正或生效日期。

搜尋與條文網址忽略官方標題中的零寬排版字元，顯示原文保持不變。

修正 Windows 路徑、URL／ZIP 分隔符與 Python UTF-8 讀寫，讓本機建置、單檔 HTML 及離線包可以使用新增資料。

## 驗證

- 原有 610 部全文內容保持不變。
- 22 縣市各增加法規名稱及最後條文的搜尋驗收，另加 7 縣市連寫查詢，共 130 組。
- 328 部地方全文與 2,964 條／點逐字核對官方 HTML（僅忽略排版空白）。
- 398 筆來源快照雜湊核對。
- `npm run typecheck`、`npm run build`、`npm run check`。

## 本次新增與補全文清單

- [嘉義巿施工中之違章建築即報即拆作業規定](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000193) — 全文 6 條／點
- [嘉義市免由建築師設計、監造或營造業承造之一定金額工程造價、一定規模規定](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000015) — 官方連結／附件，尚未完整解析
- [嘉義市免計建築面積雜項工作物大門式圍牆設置原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000385) — 全文 8 條／點
- [嘉義市公有畸零地合併使用證明書核發基準](https://law.chiayi.gov.tw/LawContent.aspx?id=FL026914) — 全文 14 條／點
- [嘉義市建築執照工程造價標準表](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000016) — 官方連結／附件，尚未完整解析
- [嘉義市建築工程必須申報勘驗部分作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000018) — 官方連結／附件，尚未完整解析
- [嘉義市建築工程辦理施工計畫書諮詢會作業原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000805) — 全文 8 條／點
- [嘉義市建築爭議事件處理辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=FL046257) — 全文 15 條／點
- [嘉義市建築物免辦理變更使用執照辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=FL044306) — 全文 7 條／點
- [嘉義市建築物公共安全檢查簽證及申報案件簽證不實認定作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000784) — 全文 7 條／點
- [嘉義市建築物室內裝修審查作業事項規範](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000386) — 全文 16 條／點
- [嘉義市建築物施工中管制要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000019) — 全文 23 條／點
- [嘉義市建築物未領得使用執照接用水電辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=FL031633) — 官方連結／附件，尚未完整解析
- [嘉義市建築物申請補辦建築執照作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000022) — 官方連結／附件，尚未完整解析
- [嘉義市建築物設置太陽光電設施辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000518) — 全文 7 條／點
- [嘉義市建築物附建防空避難設備或停車空間繳納代金及管理使用辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=FL023337) — 全文 9 條／點
- [嘉義市建築管理自治條例](https://law.chiayi.gov.tw/LawContent.aspx?id=FL022491) — 全文 49 條／點
- [嘉義市建造執照申請有關特殊結構審查原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000020) — 全文 6 條／點
- [嘉義市建造執照雜項執照簽證案件抽查考核處理原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000363) — 全文 11 條／點
- [嘉義市推行建築基地之法定空地綠化執行要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000021) — 官方連結／附件，尚未完整解析
- [嘉義市政府使用公私有建築物室內空間埋設污水下水道管線補償要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000564) — 全文 5 條／點
- [嘉義市政府公共工程及公有建築工程營建剩餘土石方交換利用作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000635) — 全文 11 條／點
- [嘉義市政府受理都市危險及老舊建築物加速重建計畫作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000554) — 全文 11 條／點
- [嘉義市政府地質敏感區建築基地地質調查及地質安全評估委託審查原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000797) — 全文 7 條／點
- [嘉義市政府執行違章建築查報及拆除要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000673) — 全文 7 條／點
- [嘉義市政府委託專業公會辦理建築管理業務作業原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000846) — 全文 17 條／點
- [嘉義市政府建築執照地質敏感區基地地質調查及安全評估審查作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000498) — 全文 10 條／點
- [嘉義市政府建築工程搭建樣品屋管理要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000720) — 全文 12 條／點
- [嘉義市政府核發建築物使用執照要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000857) — 全文 5 條／點
- [嘉義市政府處理違反公寓大廈管理條例事件裁處基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000524) — 官方連結／附件，尚未完整解析
- [嘉義市政府處理違反建築法事件統一裁罰基準(使用管理部分)](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000522) — 官方連結／附件，尚未完整解析
- [嘉義市政府處理違反建築法事件統一裁罰基準(建照管理部分)](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000521) — 官方連結／附件，尚未完整解析
- [嘉義市政府辦理建造執照及雜項執照展延復審期限處理原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000746) — 全文 4 條／點
- [嘉義市政府辦理新領使用執照建築物之複查作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000290) — 官方連結／附件，尚未完整解析
- [嘉義市政府辦理都市更新實施者申請代為拆除或遷移土地改良物實施辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000780) — 全文 14 條／點
- [嘉義市政府都市計畫容積移轉審查許可要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000509) — 全文 11 條／點
- [嘉義市政府都市計畫容積移轉接受基地土地市場價格估價作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000432) — 全文 5 條／點
- [嘉義市申請建築線指示作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=FL026919) — 全文 8 條／點
- [嘉義市畸零地使用規則](https://law.chiayi.gov.tw/LawContent.aspx?id=FL022468) — 全文 17 條／點
- [嘉義市臨時展演場所搭建臨時建築物管理作業程序](https://law.chiayi.gov.tw/LawContent.aspx?id=FL030701) — 官方連結／附件，尚未完整解析
- [嘉義市興辦公共工程建築改良物拆遷補償救濟自治條例](https://law.chiayi.gov.tw/LawContent.aspx?id=FL022993) — 官方連結／附件，尚未完整解析
- [嘉義市興闢公共設施拆除建築物剩餘建築基地內改建或增建辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=FL023338) — 全文 11 條／點
- [嘉義市處理違反都市計畫法事件統一裁罰基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000289) — 官方連結／附件，尚未完整解析
- [嘉義市辦理農業用地作農業設施容許使用審查辦法作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000481) — 全文 5 條／點
- [嘉義市辦理都市計畫規劃徵求民眾意見實施要點](https://law.chiayi.gov.tw/LawContent.aspx?id=FL030697) — 官方連結／附件，尚未完整解析
- [嘉義市迅行及策略性更新地區建築物高度及建蔽率放寬標準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000779) — 全文 6 條／點
- [嘉義市都市危險及老舊建築物舊有房屋申請重建認定標準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000682) — 全文 5 條／點
- [嘉義市都市更新事業及權利變換計畫提列共同負擔項目及金額基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000699) — 全文 3 條／點
- [嘉義市都市更新事業計畫核定後免辦理變更事業計畫處理原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000614) — 全文 4 條／點
- [嘉義市都市更新單元劃定基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000361) — 全文 6 條／點
- [嘉義市都市更新建築容積獎勵辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000681) — 全文 8 條／點
- [嘉義市都市更新權利變換最小分配面積單元基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000812) — 全文 3 條／點
- [嘉義市都市更新範圍公有土地一定規模以上及特殊原因認定基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000766) — 全文 5 條／點
- [嘉義市都市計畫乙種工業區申請設置公共服務設施及公用事業設施作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000287) — 全文 12 條／點
- [嘉義市都市計畫公共設施保留地容許臨時建築使用管制要點](https://law.chiayi.gov.tw/LawContent.aspx?id=FL022995) — 全文 5 條／點
- [嘉義市都市計畫土地使用變更回饋審議原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000014) — 官方連結／附件，尚未完整解析
- [嘉義市都市計畫委員會委員派聘任作業要點](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000182) — 全文 3 條／點
- [嘉義市都市計畫工業區申請建築執照處理原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000633) — 全文 12 條／點
- [嘉義市都市計畫數值地形圖資料流通辦法](https://law.chiayi.gov.tw/LawContent.aspx?id=FL035266) — 全文 13 條／點
- [嘉義市都市計畫農業區土地作為連接建築線私設通路使用審查基準](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000013) — 官方連結／附件，尚未完整解析
- [嘉義市都市設計審議作業規定](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000198) — 官方連結／附件，尚未完整解析
- [嘉義市領有使用執照建築基地範圍內部分土地申請建築處理原則](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000796) — 全文 6 條／點
- [嘉義市騎樓設置標準](https://law.chiayi.gov.tw/LawContent.aspx?id=FL022494) — 全文 6 條／點
- [嘉義市高氯離子混凝土建築物善後處理措施](https://law.chiayi.gov.tw/LawContent.aspx?id=GL000017) — 官方連結／附件，尚未完整解析
- [嘉義縣一定規模以下建築物免辦理變更使用執照辦法](https://law.cyhg.gov.tw/LawContent.aspx?id=FL035595) — 全文 10 條／點
- [嘉義縣偏遠地區簡化建築管理辦法](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000617) — 全文 7 條／點
- [嘉義縣免請領建築執照建築物或雜項工作物處理原則](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000648) — 全文 3 條／點
- [嘉義縣公有畸零地合併使用證明書核發基準](https://law.cyhg.gov.tw/LawContent.aspx?id=FL052674) — 全文 15 條／點
- [嘉義縣執行施工中違章建築即報即拆作業規定](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000258) — 全文 8 條／點
- [嘉義縣山坡地建築基地免退縮設置人行步道認定原則](https://law.cyhg.gov.tw/LawContent.aspx?id=FL052676) — 全文 5 條／點
- [嘉義縣建築執照圖檔光碟繳交作業原則](https://law.cyhg.gov.tw/LawContent.aspx?id=FL048833) — 全文 6 條／點
- [嘉義縣建築工程勘驗執行辦法](https://law.cyhg.gov.tw/LawContent.aspx?id=FL031963) — 全文 6 條／點
- [嘉義縣建築物公共安全檢查簽證及申報案件簽證不實認定與懲處作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000296) — 全文 6 條／點
- [嘉義縣建築物室內裝修審核及查驗作業事項規範](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000162) — 全文 14 條／點
- [嘉義縣建築物施工中發生公共安全事件處理原則](https://law.cyhg.gov.tw/LawContent.aspx?id=FL023521) — 官方連結／附件，尚未完整解析
- [嘉義縣建築物施工中管制要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000291) — 全文 22 條／點
- [嘉義縣建築物申請補辦建造執照作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=FL052721) — 全文 5 條／點
- [嘉義縣建築物造價標準表](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000311) — 官方連結／附件，尚未完整解析
- [嘉義縣建築物附建防空避難設備或停車空間繳納代金及管理使用辦法](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000418) — 全文 8 條／點
- [嘉義縣建築管理自治條例](https://law.cyhg.gov.tw/LawContent.aspx?id=FL026925) — 全文 42 條／點
- [嘉義縣建造執照及雜項執照協助審查試行作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000486) — 全文 7 條／點
- [嘉義縣建造執照及雜項執照審查規定項目作業原則](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000481) — 全文 2 條／點
- [嘉義縣建造執照及雜項執照簽證案件考核處理原則](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000321) — 全文 12 條／點
- [嘉義縣建造執照申請特殊構造委託審查原則](https://law.cyhg.gov.tw/LawContent.aspx?id=FL026756) — 全文 6 條／點
- [嘉義縣政府公共工程及公有建築工程營建剩餘土石方交換利用作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000313) — 全文 8 條／點
- [嘉義縣政府受理都市危險及老舊建築物加速重建計畫作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000602) — 全文 9 條／點
- [嘉義縣政府建築物實施耐震能力評估及補強方案工作執行要點](https://law.cyhg.gov.tw/LawContent.aspx?id=FL052677) — 全文 7 條／點
- [嘉義縣政府處理建築物擅自建造裁罰基準](https://law.cyhg.gov.tw/LawContent.aspx?id=FL053530) — 全文 2 條／點
- [嘉義縣政府處理違反公寓大廈管理條例案件裁罰基準](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000697) — 全文 3 條／點
- [嘉義縣政府處理違反建築法使用管理規定事件裁罰基準](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000501) — 全文 4 條／點
- [嘉義縣政府辦理違反都市計畫法案件處理原則及統一裁罰基準](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000185) — 全文 6 條／點
- [嘉義縣政府辦理都市更新實施者申請代為拆除或遷移土地改良物實施辦法](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000711) — 全文 13 條／點
- [嘉義縣政府配合廢止營利事業統一發證制度後續建築管理措施處理原則](https://law.cyhg.gov.tw/LawContent.aspx?id=FL052678) — 全文 4 條／點
- [嘉義縣新取得使用執照之建築物複查機制作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000259) — 全文 6 條／點
- [嘉義縣未發布細部計畫整體開發地區無建築行為使用審查自治條例](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000133) — 全文 11 條／點
- [嘉義縣未領使用執照建築物申請接用水電許可自治條例](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000164) — 全文 6 條／點
- [嘉義縣畸零地使用自治條例](https://law.cyhg.gov.tw/LawContent.aspx?id=FL034164) — 全文 16 條／點
- [嘉義縣臨時性建築物管理要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000733) — 全文 12 條／點
- [嘉義縣興辦公共設施拆除合法建築物賸餘部分就地整建辦法](https://law.cyhg.gov.tw/LawContent.aspx?id=FL027048) — 全文 14 條／點
- [嘉義縣辦理申請農業用地作農業設施容許使用審查作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=FL049966) — 全文 18 條／點
- [嘉義縣辦理貨櫃屋申請臨時建築許可審查要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000372) — 全文 9 條／點
- [嘉義縣違章建築拆除完成認定基準](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000693) — 全文 4 條／點
- [嘉義縣都市更新單元劃定基準](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000140) — 全文 8 條／點
- [嘉義縣都市計畫人行步道用地檢討變更處理原則](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000202) — 全文 7 條／點
- [嘉義縣都市計畫保護區農業區土地使用審查要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000309) — 全文 11 條／點
- [嘉義縣都市計畫公共設施保留地臨時建築使用辦法第四條臨時建築使用細目、建蔽率及最大建築面積](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000022) — 官方連結／附件，尚未完整解析
- [嘉義縣都市計畫宗教專用區檢討變更審議原則](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000253) — 全文 8 條／點
- [嘉義縣都市計畫容積移轉許可審查要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000613) — 全文 14 條／點
- [嘉義縣都市計畫甲種及乙種工業區申請設置工業發展有關設施暨公共服務設施及公用事業設施審查要點](https://law.cyhg.gov.tw/LawContent.aspx?id=FL052681) — 全文 9 條／點
- [嘉義縣都市計畫農業區土地作為連接建築線私設通路使用審查基準](https://law.cyhg.gov.tw/LawContent.aspx?id=FL032754) — 全文 2 條／點
- [嘉義縣都市設計審議作業規定](https://law.cyhg.gov.tw/LawContent.aspx?id=FL043585) — 全文 5 條／點
- [嘉義縣非供居住使用之農業相關設施免由建築師設計監造及營造業承造標準](https://law.cyhg.gov.tw/LawContent.aspx?id=FL021922) — 全文 4 條／點
- [嘉義縣非都市土地丁種建築用地容許作工業設施使用之低污染事業認定作業要點](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000706) — 全文 5 條／點
- [嘉義縣高氯離子混凝土建築物善後處理要點](https://law.cyhg.gov.tw/LawContent.aspx?id=FL040556) — 全文 9 條／點
- [基隆市一定規模以下建築物免辦理變更使用執照辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054775) — 全文 17 條／點
- [基隆市免辦建築執照建築物或雜項工作物管理辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000615) — 全文 10 條／點
- [基隆市公有畸零地合併使用證明書核發基準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL003538) — 全文 16 條／點
- [基隆市各項活動搭建臨時建築物管理作業程序](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054907) — 全文 9 條／點
- [基隆市合法建築物平屋頂搭蓋防漏設施處理規則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000435) — 全文 10 條／點
- [基隆市山坡地建築之擋土牆作為建築物外牆共構使用審查作業細則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054906) — 全文 6 條／點
- [基隆市山坡地建築退縮設置人行步道認定原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004318) — 全文 2 條／點
- [基隆市山坡地申請建築許可設置擋土設施處理維護距離審查要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000699) — 全文 3 條／點
- [基隆市山坡地開發建築基地條件特殊免適用建築技術規則建築設計施工編第二百六十二條第三項規定認定標準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL055275) — 全文 6 條／點
- [基隆市建築執照選號作業辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000139) — 全文 7 條／點
- [基隆市建築工程免由建築師設計、監造及營造業承造一定金額工程造價標準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL055276) — 全文 3 條／點
- [基隆市建築工程搭建樣品屋及設置臨時廣告物處理辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000425) — 全文 9 條／點
- [基隆市建築工程施工中必需勘驗部份作業要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054908) — 全文 9 條／點
- [基隆市建築工程造價估算標準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL051483) — 全文 3 條／點
- [基隆市建築爭議事件處理作業程序](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054909) — 全文 11 條／點
- [基隆市建築物使用執照變更案違章建築處理原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004323) — 官方連結／附件，尚未完整解析
- [基隆市建築物公共安全檢查申報作業程序](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000077) — 全文 5 條／點
- [基隆市建築物公共安全檢查簽證及申報案件簽證不實認定與懲處作業要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000229) — 全文 6 條／點
- [基隆市建築物增設一定規模以下構造物處理要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000795) — 全文 4 條／點
- [基隆市建築物恢復使用及供水供電審查辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL046311) — 全文 7 條／點
- [基隆市建築物施工場所管制要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004315) — 全文 24 條／點
- [基隆市建築物設置電動車充電設備及裝置空間執行要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000638) — 全文 7 條／點
- [基隆市建築物附建防空避難設備或停車空間繳納代金及管理使用辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000249) — 全文 9 條／點
- [基隆市建築管理自治條例](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000079) — 全文 47 條／點
- [基隆市建築（含雜項整地執照）工程辦理施工防災計劃說明會作業要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004325) — 全文 6 條／點
- [基隆市建造執照申請有關特殊結構委託審查處理原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004316) — 全文 8 條／點
- [基隆市拆除合法建築物剩餘部分就地整建自治條例](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000078) — 全文 17 條／點
- [基隆市政府公有建築工程代辦作業要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000614) — 全文 27 條／點
- [基隆市政府委託審查機構辦理建築物室內裝修審查作業事項規範](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054912) — 全文 14 條／點
- [基隆市政府工務處辦理都市計畫容積移轉送出基地地上物認定及處理原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000499) — 全文 6 條／點
- [基隆市政府建築執照圖說電子檔繳交作業原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL046423) — 全文 9 條／點
- [基隆市政府建築執照複印閱覽申請須知](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054915) — 全文 7 條／點
- [基隆市政府建造執照及雜項執照展延復審期限處理原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000788) — 全文 8 條／點
- [基隆市政府處理違反都市計畫法案件統一裁罰基準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000566) — 全文 5 條／點
- [基隆市政府辦理建築師懲戒業務作業程序](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000076) — 全文 6 條／點
- [基隆市政府辦理建築師簽證發照、考核處理原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL039784) — 全文 8 條／點
- [基隆市政府辦理建築物變更戶數作業要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000236) — 全文 8 條／點
- [基隆市政府辦理施工中違章建築即報即拆作業規定](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000396) — 全文 8 條／點
- [基隆市政府辦理高氯離子鋼筋混凝土建築物處理及鑑定原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000778) — 全文 5 條／點
- [基隆市政府都市設計審議作業規定第六點執行須知](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000107) — 全文 6 條／點
- [基隆市新舊違章建築日期劃分基準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000137) — 全文 2 條／點
- [基隆市未領得使用執照之既有建築物申請接水接電辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL055113) — 全文 8 條／點
- [基隆市畸零地使用規則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL003536) — 全文 16 條／點
- [基隆市臨接未完成道路闢建之建築基地申請建築執照出入通路管理辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000604) — 全文 9 條／點
- [基隆市舊有違章建築修繕辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004309) — 全文 7 條／點
- [基隆市違章建築優先拆除執行要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000720) — 全文 5 條／點
- [基隆市違章建築拆除結案作業原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000721) — 全文 4 條／點
- [基隆市違章建築申請補辦執照執行要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000036) — 全文 6 條／點
- [基隆市都市更新單元劃定標準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL046312) — 全文 6 條／點
- [基隆市都市更新建築容積獎勵辦法](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000774) — 全文 4 條／點
- [基隆市都市計畫保護區、農業區土地使用審查要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL026265) — 全文 9 條／點
- [基隆市都市計畫保護區農業區土地使用審查要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000402) — 全文 9 條／點
- [基隆市都市計畫倉儲區文化創意產業土地使用審查要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000698) — 全文 6 條／點
- [基隆市都市計畫區騎樓設置標準](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004306) — 全文 4 條／點
- [基隆市都市計畫容積移轉許可審查要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054949) — 全文 13 條／點
- [基隆市都市計畫工業區污水處理及污水下水道使用自治條例](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054814) — 全文 37 條／點
- [基隆市都市計畫甲乙種工業區申請設置工業發展有關設施及公共服務設施暨公用事業設施土地使用審查作業要點](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000239) — 官方連結／附件，尚未完整解析
- [基隆市都市設計審議作業規定](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL054828) — 全文 14 條／點
- [基隆市高氯離子鋼筋混凝土建築物善後處理自治條例](https://exlaw.klcg.gov.tw/LawContent.aspx?id=FL004310) — 全文 14 條／點
- [基隆市新建公共建築物無障礙設施及設備竣工勘檢作業原則](https://exlaw.klcg.gov.tw/LawContent.aspx?id=GL000082) — 全文 3 條／點
- [宜蘭縣一定規模以下農業設施免退縮建築認定基準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000157) — 全文 4 條／點
- [宜蘭縣偏遠地區簡化建築管理辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000712) — 全文 9 條／點
- [宜蘭縣公共工程及公有建築工程營建賸餘土石方交換利用作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000721) — 全文 10 條／點
- [宜蘭縣公共建築物無障礙環境替代改善計畫處理原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034349) — 全文 8 條／點
- [宜蘭縣公寓大廈管理委員會使用空間免計入建築面積及總樓地板面積管理辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL041247) — 全文 4 條／點
- [宜蘭縣公有畸零地合併使用證明書核發基準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL023838) — 全文 9 條／點
- [宜蘭縣地質敏感區建築基地地質調查及地質安全評估結果報告委託審查作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000507) — 全文 7 條／點
- [宜蘭縣建築基地施工圍籬綠美化執行要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000230) — 全文 5 條／點
- [宜蘭縣建築工程施工勘驗執行辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL030366) — 全文 11 條／點
- [宜蘭縣建築施工告示牌設置規則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000108) — 全文 5 條／點
- [宜蘭縣建築物使用執照核發辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000233) — 全文 9 條／點
- [宜蘭縣建築物免辦理變更使用執照辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL040021) — 全文 9 條／點
- [宜蘭縣建築物公共安全檢查簽證及申報案件簽證不實認定作業原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034344) — 全文 6 條／點
- [宜蘭縣建築物公共安全檢查簽證及申報業務注意事項](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034347) — 全文 11 條／點
- [宜蘭縣建築物屋頂突出物高度設計審查辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000492) — 全文 5 條／點
- [宜蘭縣建築物擅自建造補辦建築執照申請辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034156) — 全文 5 條／點
- [宜蘭縣建築物施工中損壞鄰房爭議事件處理自治條例](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL036358) — 全文 13 條／點
- [宜蘭縣建築物變更使用執照涉及違建部分處理原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000459) — 全文 3 條／點
- [宜蘭縣建築物跨越人行道設置遮雨棚作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000493) — 全文 7 條／點
- [宜蘭縣建築物造價估算標準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL051000) — 全文 5 條／點
- [宜蘭縣建築物附建防空避難設備或停車空間繳納代金及管理使用辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034154) — 全文 9 條／點
- [宜蘭縣建築管理自治條例](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL023420) — 全文 48 條／點
- [宜蘭縣建造執照及雜項執照簽證案件抽查處理原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000257) — 全文 8 條／點
- [宜蘭縣建造執照申請有關特殊結構委託審查作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034343) — 全文 6 條／點
- [宜蘭縣拆除合法建築物剩餘部分就地整建辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL030365) — 全文 12 條／點
- [宜蘭縣政府取締違章建築執行要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034336) — 全文 8 條／點
- [宜蘭縣政府執行建築基地開放空間管理維護要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000618) — 全文 14 條／點
- [宜蘭縣政府執行違章建築取締辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL023438) — 全文 7 條／點
- [宜蘭縣政府執行違章建築強制拆除達不堪使用認定要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000786) — 全文 4 條／點
- [宜蘭縣政府執行違章建築查報作業原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL046532) — 全文 5 條／點
- [宜蘭縣政府委任各鄉鎮市公所受理申請農業用地作農業設施容許使用委任作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000441) — 全文 9 條／點
- [宜蘭縣政府施工中建築工程災害緊急應變標準作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000748) — 全文 10 條／點
- [宜蘭縣政府處理建築物擅自建造裁罰基準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000405) — 全文 4 條／點
- [宜蘭縣政府處理違反公寓大廈管理條例事件統一裁罰基準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000594) — 全文 3 條／點
- [宜蘭縣政府處理違反建築法使用管理規定事件統一裁罰基準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000735) — 官方連結／附件，尚未完整解析
- [宜蘭縣政府辦理國土計畫及都市計畫審議會議會場管理要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000600) — 全文 8 條／點
- [宜蘭縣政府辦理山坡地興建農舍管理及設計審查原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000341) — 全文 7 條／點
- [宜蘭縣政府辦理建築物施工計畫書備查作業原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000782) — 官方連結／附件，尚未完整解析
- [宜蘭縣政府辦理建造執照及雜項執照展延復審期限處理原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000744) — 全文 5 條／點
- [宜蘭縣政府辦理都市危險及老舊建築物申請重建原合法建築物建築基地認定原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000713) — 全文 5 條／點
- [宜蘭縣政府辦理都市計畫農業區土地作為連接建築線之私設通路使用審查要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL040798) — 全文 9 條／點
- [宜蘭縣政府都市計畫保護區及農業區土地使用審查要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000289) — 全文 10 條／點
- [宜蘭縣既存違章建築影響公共安全執行計畫](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000346) — 全文 4 條／點
- [宜蘭縣未領得使用執照之建築物申請接水接電辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL030367) — 全文 8 條／點
- [宜蘭縣畸零地使用規則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL023434) — 全文 16 條／點
- [宜蘭縣簡化實施都市計畫以外地區建築管理辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000132) — 全文 6 條／點
- [宜蘭縣臨時性建築物管理辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000109) — 全文 12 條／點
- [宜蘭縣興建農舍及其農業用地稽查及取締要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000364) — 官方連結／附件，尚未完整解析
- [宜蘭縣舊違章建築修繕辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL023446) — 全文 13 條／點
- [宜蘭縣辦理現有巷道認定及指定建築線作業辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000621) — 全文 13 條／點
- [宜蘭縣農、林、畜牧、養殖業暨休閒農業設施建築物使用類組認定原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000094) — 全文 3 條／點
- [宜蘭縣農業用地申請興建農舍審查作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000540) — 全文 9 條／點
- [宜蘭縣農業用地申請農業設施容許使用審查作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL051520) — 全文 7 條／點
- [宜蘭縣違反都市計畫法案件裁罰基準](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000581) — 全文 4 條／點
- [宜蘭縣都市計畫公共設施保留地臨時建築使用規則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL023541) — 全文 10 條／點
- [宜蘭縣都市計畫地區建築基地法定空地綠化實施辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL029898) — 全文 9 條／點
- [宜蘭縣都市計畫地區法定騎樓或無遮簷人行道設置辦法](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL041248) — 全文 6 條／點
- [宜蘭縣都市計畫容積移轉許可審查條件](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000571) — 全文 11 條／點
- [宜蘭縣都市計畫容積移轉許可審查要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000416) — 全文 7 條／點
- [宜蘭縣都市計畫甲、乙種工業區設置工業發展有關設施、公共服務設施、公用事業設施審查要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL042321) — 全文 7 條／點
- [宜蘭縣都市設計審議作業要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000665) — 全文 12 條／點
- [宜蘭縣非住宅建築物樓層高度設計審查準則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000247) — 全文 5 條／點
- [宜蘭縣非都市土地丁種建築用地平面設計類似住宅處理原則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000319) — 全文 4 條／點
- [宜蘭縣非都市建築用地既有建築物重建排放水審查準則](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=GL000532) — 全文 4 條／點
- [宜蘭縣高氯離子鋼筋混凝土建築物善後處理要點](https://glrslaw.e-land.gov.tw/LawContent.aspx?id=FL034340) — 全文 9 條／點
- [申請「已完成目的事業開發或利用許可之整體開發水土保持計畫取得水土保持完工證明書之後續個別開發建築或其他開發利用行為，涉及水土保持處理原則」之補充規定](https://law.cyhg.gov.tw/LawContent.aspx?id=GL000308) — 官方連結／附件，尚未完整解析
- [花蓮縣O九一八地震災後辦理鋼構型組合屋申請臨時建築許可審查要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001248) — 全文 9 條／點
- [花蓮縣O四O三地震災後辦理鋼構型組合屋申請臨時建築許可審查要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001499) — 全文 9 條／點
- [花蓮縣偏遠地區建築管理辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL035114) — 全文 5 條／點
- [花蓮縣免辦建造執照屋頂防漏處理原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001238) — 全文 3 條／點
- [花蓮縣公有畸零地合併使用證明書核發基準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL026597) — 全文 17 條／點
- [花蓮縣受理補辦建築執照及建築物申報勘（查）驗檢附混凝土氯離子含量檢測證明文件補充規定](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000027) — 全文 3 條／點
- [花蓮縣吉安都市計畫住一住宅區審查作業程序](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL047549) — 全文 7 條／點
- [花蓮縣地質敏感區建築基地地質調查及地質安全評估結果報告審查原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000952) — 全文 8 條／點
- [花蓮縣執行違反都市計畫土地使用管制規定處理原則及統一裁處基準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000576) — 全文 7 條／點
- [花蓮縣實施綠建築審核及抽查處理規定](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000025) — 全文 4 條／點
- [花蓮縣實施都市計畫以外地區原住民保留地簡化建築管理辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001429) — 全文 8 條／點
- [花蓮縣山坡地建築基地人行步道設置原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL046233) — 全文 4 條／點
- [花蓮縣建築工程施工勘驗執行辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000512) — 全文 8 條／點
- [花蓮縣建築物免辦理變更使用執照辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000716) — 全文 9 條／點
- [花蓮縣建築物公共安全檢查簽證及申報案件簽證不實認定與懲處作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000637) — 全文 6 條／點
- [花蓮縣建築物室內裝修管理辦法作業事項規範暨作業流程圖](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000029) — 全文 14 條／點
- [花蓮縣建築物施工損鄰爭議事件處理自治條例](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL049563) — 全文 12 條／點
- [花蓮縣建築物施工管制辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000821) — 全文 28 條／點
- [花蓮縣建築物造價、一定金額及規模標準表](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000930) — 官方連結／附件，尚未完整解析
- [花蓮縣建築物附建防空避難設備或停車空間繳納代金及管理使用辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL044134) — 全文 7 條／點
- [花蓮縣建築物雨、污水分流設計審查及竣工查驗標準作業程序](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000621) — 官方連結／附件，尚未完整解析
- [花蓮縣建築管理自治條例](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL026603) — 全文 40 條／點
- [花蓮縣建築開發業管理自治條例](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000500) — 全文 9 條／點
- [花蓮縣建造執照及雜項執照簽證案件考核處理原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000501) — 全文 8 條／點
- [花蓮縣建造執照申請有關特殊結構審查原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL026608) — 全文 7 條／點
- [花蓮縣建造執照申請變更設計減少樓層數工程期限處理原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000243) — 全文 5 條／點
- [花蓮縣拆除合法建築物賸餘部分就地整建辦法（98.11.19訂定）](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL053692) — 全文 11 條／點
- [花蓮縣政府97年度獎勵優良綠建築設計與應用技術實施計畫](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000022) — 全文 8 條／點
- [花蓮縣政府主導辦理都市更新公有土地一定規模及特殊原因認定要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001341) — 全文 7 條／點
- [花蓮縣政府受理建築法第五十五條建造或雜項執照變更案件補充規定](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000026) — 全文 1 條／點
- [花蓮縣政府執行新領得使用執照建築物複查機制作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000507) — 全文 10 條／點
- [花蓮縣政府委辦各鄉（鎮、市）公所核發申請農業用地作農業設施容許使用審查作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL030320) — 全文 12 條／點
- [花蓮縣政府建造執照及雜項執照會審作業實施計畫](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000021) — 全文 10 條／點
- [花蓮縣政府申請農業用地作農業設施容許使用審查小組設置要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001331) — 全文 9 條／點
- [花蓮縣政府處理違反建築法事件統一裁罰基準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL045744) — 全文 5 條／點
- [花蓮縣政府辦理建築師懲戒業務作業程序](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000494) — 全文 6 條／點
- [花蓮縣政府辦理變更使用執照申請案違章建築部分處理原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000362) — 全文 4 條／點
- [花蓮縣新建公共建築物行動不便者使用設施建築執照審查暨勘檢作業執行計畫](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000023) — 全文 9 條／點
- [花蓮縣既有公共建築物行動不便者設施替代改善計畫處理原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL046054) — 官方連結／附件，尚未完整解析
- [花蓮縣未領得使用執照之建築物申請暫時接水接電作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL030308) — 全文 11 條／點
- [花蓮縣污水下水道公告使用地區用戶配合用戶接管施工拆除違章建築作業準則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000198) — 全文 5 條／點
- [花蓮縣申請興建農業設施高度及樓層審查標準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL039049) — 全文 4 條／點
- [花蓮縣申請興建農舍農民資格證明作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000618) — 全文 8 條／點
- [花蓮縣畸零地使用規則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL024182) — 全文 15 條／點
- [花蓮縣臨時展演場所搭建臨時建築物管理作業程序](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL035118) — 全文 8 條／點
- [花蓮縣變更都市計畫回饋代金分期繳納辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL043070) — 全文 6 條／點
- [花蓮縣農舍及農業設施以臨接通路或農路申請建築執照處理原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000185) — 全文 6 條／點
- [花蓮縣迅行及策略性更新地區建築物高度及建蔽率放寬標準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001568) — 全文 6 條／點
- [花蓮縣違章建築拆除結案作業原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001206) — 全文 4 條／點
- [花蓮縣違章建築查報及拆除標準作業程序](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL048392) — 官方連結／附件，尚未完整解析
- [花蓮縣違章建築申請補辦建築執照作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL035117) — 全文 6 條／點
- [花蓮縣都市危險及老舊建築物加速重建計畫作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000737) — 全文 13 條／點
- [花蓮縣都市危險及老舊建築物重建住宅貸款利息補貼作業規定](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000876) — 全文 6 條／點
- [花蓮縣都市更新單元劃定基準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000969) — 全文 11 條／點
- [花蓮縣都市更新建築容積獎勵辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001397) — 全文 6 條／點
- [花蓮縣都市更新權利變換實施者申請拆除或遷移土地改良物辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001396) — 全文 13 條／點
- [花蓮縣都市更新權利變換專業估價者選任注意事項](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001342) — 全文 11 條／點
- [花蓮縣都市更新權利變換計畫提列共同負擔項目及金額基準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL001531) — 全文 9 條／點
- [花蓮縣都市計畫(公共設施用地及其他分區)變更使用許可審議原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000872) — 全文 6 條／點
- [花蓮縣都市計畫保護區、農業區土地使用審查要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL040880) — 全文 12 條／點
- [花蓮縣都市計畫內騎樓或無遮簷人行道設置標準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL026634) — 全文 4 條／點
- [花蓮縣都市計畫公共設施保留地臨時建築使用細目、建蔽率及最大建築面積限制標準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL026606) — 全文 3 條／點
- [花蓮縣都市計畫容積移轉審查許可要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000404) — 全文 15 條／點
- [花蓮縣都市計畫甲（乙）種工業區申請容許使用設施審查要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL042272) — 全文 15 條／點
- [花蓮縣都市計畫農業區土地申請私設連接建築線通路審查基準](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL046858) — 全文 5 條／點
- [花蓮縣都市設計審議原則](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=GL000904) — 全文 10 條／點
- [花蓮縣震災後危險建築物緊急鑑定組訓及動員作業要點](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL034926) — 全文 12 條／點
- [花蓮縣高氯離子鋼筋混凝土建築物善後處理辦法](https://glrs.hl.gov.tw/glrsout/LawContent.aspx?id=FL035113) — 全文 12 條／點
- [連江縣免辦建築執照建築物或雜項工作物作業要點](https://law.matsu.gov.tw/LawContent.aspx?id=GL000507) — 官方連結／附件，尚未完整解析
- [連江縣各項違反都市計畫法案件通案處理原則](https://law.matsu.gov.tw/LawContent.aspx?id=GL000489) — 全文 5 條／點
- [連江縣山坡地建築退縮設置人行步道認定原則](https://law.matsu.gov.tw/LawContent.aspx?id=GL000521) — 全文 2 條／點
- [連江縣山坡地開發建築基地條件特殊免適用建築技術規則建築設計施工編第二百六十二條第三項規定認定標準](https://law.matsu.gov.tw/LawContent.aspx?id=GL000522) — 官方連結／附件，尚未完整解析
- [連江縣建築物一定規模以下免辦理變更使用執照管理辦法](https://law.matsu.gov.tw/LawContent.aspx?id=GL000333) — 全文 11 條／點
- [連江縣建築物室內裝修審核及查驗作業規範](https://law.matsu.gov.tw/LawContent.aspx?id=GL000620) — 全文 15 條／點
- [連江縣建築物施工中管制要點](https://law.matsu.gov.tw/LawContent.aspx?id=GL000539) — 全文 20 條／點
- [連江縣建築物簡化管理自治條例施行細則](https://law.matsu.gov.tw/LawContent.aspx?id=FL033977) — 全文 4 條／點
- [連江縣建築物簡化管理自治條例第五條之三執行要點](https://law.matsu.gov.tw/LawContent.aspx?id=GL000601) — 全文 4 條／點
- [連江縣建築物附設防空避難設備或停車空間繳納代金及管理使用自治條例](https://law.matsu.gov.tw/LawContent.aspx?id=GL000111) — 官方連結／附件，尚未完整解析
- [連江縣建築管理自治條例](https://law.matsu.gov.tw/LawContent.aspx?id=GL000331) — 全文 45 條／點
- [連江縣政府建築線指定(示)作業要點](https://law.matsu.gov.tw/LawContent.aspx?id=GL000488) — 全文 13 條／點
- [連江縣政府建造執照申請特殊結構認定標準及委託審查原則](https://law.matsu.gov.tw/LawContent.aspx?id=GL000434) — 全文 5 條／點
- [連江縣政府處理違反建築法使用管理規定事件裁罰基準](https://law.matsu.gov.tw/LawContent.aspx?id=GL000543) — 全文 5 條／點
- [連江縣政府違章建築案件統一裁罰基準](https://law.matsu.gov.tw/LawContent.aspx?id=GL000585) — 全文 3 條／點
- [連江縣政府違章建築管理自治條例」](https://law.matsu.gov.tw/LawContent.aspx?id=GL000280) — 官方連結／附件，尚未完整解析
- [連江縣未領得使用執照之建築物申請接用水電辦法](https://law.matsu.gov.tw/LawContent.aspx?id=GL000332) — 全文 8 條／點
- [連江縣畸零地使用自治條例](https://law.matsu.gov.tw/LawContent.aspx?id=GL000279) — 全文 15 條／點
- [連江縣違章建築分類分期查報拆除計畫](https://law.matsu.gov.tw/LawContent.aspx?id=GL000444) — 官方連結／附件，尚未完整解析
- [連江縣違章建築查報作業原則](https://law.matsu.gov.tw/LawContent.aspx?id=GL000445) — 全文 16 條／點
- [連江縣都市計畫保護區土地使用審查要點](https://law.matsu.gov.tw/LawContent.aspx?id=GL000501) — 全文 12 條／點
- [連江縣都市計畫地區土地變更回饋審議原則](https://law.matsu.gov.tw/LawContent.aspx?id=GL000581) — 全文 9 條／點
- [連江縣高氯離子鋼筋混凝土建築物善後處理辦法](https://law.matsu.gov.tw/LawContent.aspx?id=GL000448) — 全文 10 條／點
- [雲林縣2013農業博覽會各項活動搭建臨時建築物許可作業程序](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000175) — 全文 8 條／點
- [雲林縣2017台灣燈會各項活動搭建臨時建築物許可作業程序](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000424) — 全文 6 條／點
- [雲林縣公寓大廈公共安全管理優良認證申請作業辦法](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000484) — 全文 7 條／點
- [雲林縣公寓大廈安全維護原則](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000613) — 全文 5 條／點
- [雲林縣公寓大廈管理維護使用空間設置辦法](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000482) — 全文 10 條／點
- [雲林縣山坡地開發公有建築基地適用建築技術規則建築設計施工編第二百六十二條第三項但書規定認定標準](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000485) — 全文 7 條／點
- [雲林縣建築工程必需申報勘驗部分作業要點](https://law.yunlin.gov.tw/LawContent.aspx?id=FL054801) — 全文 5 條／點
- [雲林縣建築物室內裝修審查作業事項規範](https://law.yunlin.gov.tw/LawContent.aspx?id=FL054803) — 全文 14 條／點
- [雲林縣建築物工程造價標準表](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000383) — 官方連結／附件，尚未完整解析
- [雲林縣建築物附設停車空間繳納代金及管理使用辦法](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000198) — 全文 8 條／點
- [雲林縣建築管理自治條例](https://law.yunlin.gov.tw/LawContent.aspx?id=FL028330) — 全文 42 條／點
- [雲林縣建築開發業管理自治條例](https://law.yunlin.gov.tw/LawContent.aspx?id=FL042576) — 全文 9 條／點
- [雲林縣建造執照與雜項執照規定項目審查及簽證項目抽查作業要點](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000462) — 全文 10 條／點
- [雲林縣拆除合法建築物剩餘部分就地整建自治條例](https://law.yunlin.gov.tw/LawContent.aspx?id=FL028328) — 全文 16 條／點
- [雲林縣政府免辦建築執照建築物或雜項工作物處理原則](https://law.yunlin.gov.tw/LawContent.aspx?id=GL001168) — 全文 4 條／點
- [雲林縣政府受理建築物恢復供水供電申請作業程序](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000239) — 全文 6 條／點
- [雲林縣政府執行新領得使用執照建築物複查機制作業要點](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000466) — 全文 6 條／點
- [雲林縣政府執行違章建築查報作業原則](https://law.yunlin.gov.tw/LawContent.aspx?id=GL001200) — 全文 2 條／點
- [雲林縣政府建築物施工計畫書指導原則](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000511) — 全文 8 條／點
- [雲林縣政府施工中違章建築即報即拆作業規定](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000467) — 全文 6 條／點
- [雲林縣政府災害後危險建築物緊急評估作業原則](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000574) — 全文 5 條／點
- [雲林縣政府處理違反公寓大廈管理條例事件裁罰基準](https://law.yunlin.gov.tw/LawContent.aspx?id=GL001120) — 全文 2 條／點
- [雲林縣政府處理違反建築法事件裁罰基準](https://law.yunlin.gov.tw/LawContent.aspx?id=GL001115) — 全文 2 條／點
- [雲林縣政府辦理建造執照及雜項執照展延復審期限處理原則](https://law.yunlin.gov.tw/LawContent.aspx?id=GL001089) — 全文 6 條／點
- [雲林縣政府辦理都市計畫工業區取得建築物使用執照後防弊措施作業程序](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000362) — 全文 5 條／點
- [雲林縣政府辦理都市計畫工業區正在興建建築物稽查作業程序](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000361) — 全文 5 條／點
- [雲林縣未領得使用執照建築物申請接用水電辦法](https://law.yunlin.gov.tw/LawContent.aspx?id=FL038867) — 全文 6 條／點
- [雲林縣畸零地使用自治條例](https://law.yunlin.gov.tw/LawContent.aspx?id=FL028271) — 全文 17 條／點
- [雲林縣簡化實施都市計畫以外地區建築管理辦法](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000104) — 全文 5 條／點
- [雲林縣違章建築拆除完成認定標準](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000943) — 全文 5 條／點
- [雲林縣都市計畫住宅區旅館設置審查作業要點](https://law.yunlin.gov.tw/LawContent.aspx?id=FL030715) — 全文 9 條／點
- [雲林縣都市計畫公共設施保留地地價查估圖例](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000243) — 官方連結／附件，尚未完整解析
- [雲林縣非都市土地丁種建築用地容許作工業設施使用之低污染事業認定作業要點](https://law.yunlin.gov.tw/LawContent.aspx?id=FL040963) — 全文 4 條／點
- [雲林縣非都市土地特定農業區丁種建築用地使用情形檢查作業措施](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000224) — 全文 4 條／點
- [雲林縣騎樓設置標準](https://law.yunlin.gov.tw/LawContent.aspx?id=GL000364) — 全文 7 條／點

## 重現與維護

```powershell
python -X utf8 scripts/sync-laws.py --cache .law-cache --add-only
python -X utf8 scripts/validate-data.py --cache .law-cache
npm run snapshot
npm run build
npm run typecheck
npm run check
```

雲林來源若遭下載端拒絕，沿用既有完整快照；如更新瀏覽器 DOM 快照，須同步建立同名 `.source.json`，含 URL、SHA-256、`browser-dom-html` 雜湊範圍與觀測時間，匯入時自動核對。
