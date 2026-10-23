# P135 V0.04.2 — SDS v3.4 檢查報告

本地 **85 項通過，0 項失敗**：資料庫 29、Edge 27、DOM 17、Chromium 12。Gemini HTTP、Auth 與新聞 HTTP 為模擬；沒有使用真實 key 或呼叫付費 AI。正式 Supabase／Gemini 平台仍需部署後驗收。

本次只修正 AI 分析的候選、有限重試與錯誤分類。全部 database/*.sql、擷取函式及共用授權檔和 V0.04.1 逐位元組相同；**已初始化環境不執行任何 SQL**。

| 編號 | 結果 | 證據與限制 |
|---|---|---|
| QA-01 | PASS | 全新安裝後五表 RLS 啟用；不建立 legacy schema。正式環境待執行 SQL 後核對。 |
| QA-02 | PASS | 前端無直接 table/view .from、REST 或 GraphQL；公開與編輯資料均由 P135 RPC 提供。 |
| QA-03 | PASS | 資料交換明確呼叫十一個命名 RPC 中必要項目；Auth、新聞擷取、Gemini 為獨立受控流程。 |
| QA-04 | REVIEW | public 只放 P135 RPC，資料在 p135_data；仍須人工確認實際 Exposed Schemas 與直接 table endpoint 被 gateway 拒絕。 |
| QA-05 | PASS | 單一初始化 transaction 建立五表、RLS／policies、最小 grants、十一 INVOKER RPC 與唯一編輯者；不依賴 shared defaults。 |
| QA-06 | PASS | 85 項本地測試通過，含原 503/404/503 重現、備援成功、最多一次暫時 HTTP 失敗額外重試、配額／逾時／內容封鎖／格式分類、診斷不含金鑰或新聞；真實 Gemini 仍待部署驗證。 |
| QA-07 | PASS | 公開資料另存無原文／筆記／UID 的白名單快照；RPC 明列必要欄位，無 SELECT *／to_jsonb 整列回傳。 |
| QA-08 | PASS | PUBLIC EXECUTE 撤除；anon 只可呼叫三個公開 RPC。其餘均需 authenticated 並通過 owner 資格。 |
| QA-09 | PASS | 正式十一個 RPC 均 SECURITY INVOKER。舊 DEFINER 僅保留於 tests/fixtures 建立舊版起點，不能用於部署。 |
| QA-10 | PASS | 所有 ID 為 UUID，不需要 sequence grants；Edge 使用使用者 token，沒有 service_role 憑證。 |
| QA-11 | PASS | Chromium 實測密碼預設遮蔽、空白鍵顯示／隱藏、Enter 登入及登出清除私有內容。 |
| QA-12 | REVIEW | ZIP 與新增程式沒有實際 config.js 或秘密。既有 GitHub 已追蹤 config.js，本輪保持其 blob 不變以保留部署；歷史未改寫，不能稱此項完整符合。 |
| QA-13 | PASS | 依使用者授權及實際盤點，精確 DROP P135 原四表（含 SwapRules）RESTRICT；其他物件依賴 SwapRules／原文章表時交易回復。未知物件、多載與重跑仍停止；共用 Auth、P101 合成資料／ACL／RLS 保持不變。 |
| QA-14 | REVIEW | 同名 ZIP 外層、README、config-sample.js、database、docs 齊全。本輪為功能維護包，A3 宣傳海報未另製，後續展示交付時補製。 |
| QA-15 | PASS | 前端顯示與本地 CSS/JS cache 均 V0.04.2；資料庫 SQL 保持 V0.04.1 逐位元組相同，既有環境只更新分析 Edge。 |

## 本次針對實際故障的檢查

- 重現主模型 503、舊備援 404、另一模型 503；回應服務暫不可用及受控診斷，不再誤報 JSON。
- 主模型故障後切換新的輕量備援可成功；單檔 Dashboard 與 CLI 路徑均驗證。
- 額外重試最多一次、僅針對指定暫時 HTTP 狀態；404／400／429、逾時與內容封鎖不額外重試。
- 內容封鎖直接停止，不變更安全門檻或切模型探測。
- 診斷不回傳／記錄上游錯誤本文、新聞、API key 或 token。
- 日期排序、前後篇、草稿／公開、唯一編輯者、手機及密碼鍵盤操作回歸通過。

## 實際環境限制

- GitHub 更新不會自動部署 Supabase Edge；老師須部署 P135-analyze-news 並更新 AI_MODELS Secret。
- 本次未代執行 Supabase SQL、修改 Secrets 或測試真實 Google 帳戶的模型可用性。
- 既有 config.js blob 保留，其追蹤與歷史為 REVIEW；Exposed Schemas 及 A3 海報仍保留原 REVIEW。
- 官方依據、故障證據及部署指引見 AI_Recovery.md。
