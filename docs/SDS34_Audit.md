# P135 V0.05 — SDS v3.4 檢查報告

本次前端檢查 **37 項通過、0 失敗**：DOM 17、分批載入 8、Chromium＋本地 PostgreSQL 12。使用 243 篇合成文章實測 100 → 200 → 243 自動接續、彩色兩行標籤、手機版，以及既有登入／發布／閱讀／取消公開流程。正式 Supabase 及付費 AI 未使用。

SQL、Edge 與 V0.04.2 逐位元組相同；本次不執行任何 SQL，也不重新部署 Edge。保留的 Database_Test_Results.json 與 Edge_Test_Results.json 是舊版證據，未計入本次 37 項。

| 編號 | 結果 | 證據與限制 |
|---|---|---|
| QA-01 | PASS | 全新安裝後五表 RLS 啟用；不建立 legacy schema。正式環境待執行 SQL 後核對。 |
| QA-02 | PASS | 前端無直接 table/view .from、REST 或 GraphQL；公開與編輯資料均由 P135 RPC 提供。 |
| QA-03 | PASS | 資料交換明確呼叫十一個命名 RPC 中必要項目；Auth、新聞擷取、Gemini 為獨立受控流程。 |
| QA-04 | REVIEW | public 只放 P135 RPC，資料在 p135_data；仍須人工確認實際 Exposed Schemas 與直接 table endpoint 被 gateway 拒絕。 |
| QA-05 | PASS | 單一初始化 transaction 建立五表、RLS／policies、最小 grants、十一 INVOKER RPC 與唯一編輯者；不依賴 shared defaults。 |
| QA-06 | PASS | 本次 DOM 17、分批載入 8、Chromium＋本地 PostgreSQL 12，合計 37 項。SQL／Edge 未變更，舊版 DB／Edge 報告是歷史證據，未重新計數。 |
| QA-07 | PASS | 公開資料另存無原文／筆記／UID 的白名單快照；RPC 明列必要欄位，無 SELECT *／to_jsonb 整列回傳。 |
| QA-08 | PASS | PUBLIC EXECUTE 撤除；anon 只可呼叫三個公開 RPC。其餘均需 authenticated 並通過 owner 資格。 |
| QA-09 | PASS | 正式十一個 RPC 均 SECURITY INVOKER。舊 DEFINER 僅保留於 tests/fixtures 建立舊版起點，不能用於部署。 |
| QA-10 | PASS | 所有 ID 為 UUID，不需要 sequence grants；Edge 使用使用者 token，沒有 service_role 憑證。 |
| QA-11 | PASS | Chromium 實測密碼預設遮蔽、空白鍵顯示／隱藏、Enter 登入及登出清除私有內容。 |
| QA-12 | REVIEW | ZIP 與新增程式沒有實際 config.js 或秘密。既有 GitHub 已追蹤 config.js，本輪保持其 blob 不變以保留部署；歷史未改寫，不能稱此項完整符合。 |
| QA-13 | PASS | 本次只修改前端、測試與說明。全部 SQL／Edge 逐位元組保留；不執行正式資料庫操作。 |
| QA-14 | REVIEW | 同名 ZIP 外層、README、config-sample.js、database、docs 齊全。本輪為功能維護包，A3 宣傳海報未另製，後續展示交付時補製。 |
| QA-15 | PASS | 前端版本與快取 V0.05；所有 SQL 和 Edge 與 V0.04.2 相同。已安裝環境只更新前端。 |

正式環境已存在的 REVIEW 紀錄沿用，不是本次新增的部署前置條件。
