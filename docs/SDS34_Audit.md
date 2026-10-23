# P135 V0.04 — SDS v3.4 檢查報告

本地測試 **68 項通過，0 項失敗**：資料庫 27、Edge 12、DOM 17、Chromium 12。正式 Supabase gateway／Auth／AI 仍待部署驗收；不是正式環境已驗證的宣稱。

來源：GitHub main `2a70d25e4342679f411ce3c4b84c4ce46adf82ac`。使用者確認 P135 舊資料只是測試資料，可捨棄，要求直接更新；本輪改用精確刪除舊三表的全新安裝，不執行舊資料 schema 搬移。

| 編號 | 狀態 | 證據與限制 |
|---|---|---|
| QA-01 | PASS | 全新安裝後五表 RLS 啟用；不建立 legacy schema。正式環境待執行 SQL 後核對。 |
| QA-02 | PASS | 前端無直接 table/view .from、REST 或 GraphQL；公開與編輯資料均由 P135 RPC 提供。 |
| QA-03 | PASS | 資料交換明確呼叫十一個命名 RPC 中必要項目；Auth、新聞擷取、Gemini 為獨立受控流程。 |
| QA-04 | REVIEW | public 只放 P135 RPC，資料在 p135_data；仍須人工確認實際 Exposed Schemas 與直接 table endpoint 被 gateway 拒絕。 |
| QA-05 | PASS | 單一初始化 transaction 建立五表、RLS／policies、最小 grants、十一 INVOKER RPC 與唯一編輯者；不依賴 shared defaults。 |
| QA-06 | PASS | 隔離 PostgreSQL 與 Chromium 測試公開／草稿、owner／其他登入者／訪客、跨使用者拒絕與失敗原子回復。 |
| QA-07 | PASS | 公開資料另存無原文／筆記／UID 的白名單快照；RPC 明列必要欄位，無 SELECT *／to_jsonb 整列回傳。 |
| QA-08 | PASS | PUBLIC EXECUTE 撤除；anon 只可呼叫三個公開 RPC。其餘均需 authenticated 並通過 owner 資格。 |
| QA-09 | PASS | 正式十一個 RPC 均 SECURITY INVOKER。舊 DEFINER 僅保留於 tests/fixtures 建立舊版起點，不能用於部署。 |
| QA-10 | PASS | 所有 ID 為 UUID，不需要 sequence grants；Edge 使用使用者 token，沒有 service_role 憑證。 |
| QA-11 | PASS | Chromium 實測密碼預設遮蔽、空白鍵顯示／隱藏、Enter 登入及登出清除私有內容。 |
| QA-12 | REVIEW | ZIP 與新增程式沒有實際 config.js 或秘密。既有 GitHub 已追蹤 config.js，本輪保持其 blob 不變以保留部署；歷史未改寫，不能稱此項完整符合。 |
| QA-13 | PASS | 使用者明確放棄 P135 舊測試資料；只 DROP 精確三表 RESTRICT 並建立 P135 專用物件。外部 View／FK、未知物件、多載及重跑均測試停止；Auth 及 P101 合成資料、ACL、RLS 保持不變。 |
| QA-14 | REVIEW | 同名 ZIP 外層、README、config-sample.js、database、docs 齊全。本輪為功能維護包，A3 宣傳海報未另製，後續展示交付時補製。 |
| QA-15 | PASS | 兩頁顯示 V0.04，本地 CSS／JS cache busting 同步；不採用既有 config.js 內舊版本值。 |

## 驗證內容

- 未填或不存在的 UID 會在刪除前停止；外部 View／其他 P 的 FK 依賴會使整筆交易回復。
- 可從舊測試庫或沒有舊表的新環境安裝；初始文章數為零。
- 新版 schema 已存在時禁止重跑，已儲存新文章及公開快照保持完整。
- 合成 P101 資料、ACL、RLS、policy 及共用 Auth 使用者數保持不變。
- 五表 RLS、十一 INVOKER RPC、anon 僅三公開 RPC；草稿、私人欄位及跨使用者連結拒絕案例通過。
- Chromium 153 與實際本地 PostgreSQL RPC／RLS 整合：桌面 1440px、手機 390px、公開／取消公開、日期排序／前後篇、唯一編輯者及密碼鍵盤操作通過。
- Edge 使用真實 DOM parser／TypeScript 編譯，Auth／新聞／Gemini HTTP 為模擬；沒有呼叫付費 AI 或執行 Supabase SQL。

## 待實際環境驗收

- Exposed Schemas／直接 table endpoint、真實登入與 Edge、Gemini 模型可用性。
- 既有 GitHub config.js blob 保留未改；其追蹤與歷史問題仍為 REVIEW。
- 本輪為維護與初始化包，A3 宣傳海報未另製（QA-14 REVIEW）。
- 已下載的資料匯出可自行留存，本版不宣稱驗證過該備份可還原，也不要求恢復舊測試資料。
