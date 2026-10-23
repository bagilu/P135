# P135 V0.03 — SDS v3.4 合規報告

檢查時間：2026-10-23T12:12:07+08:00  
本機測試：62 項通過，0 項失敗。  
狀態：候選交付，正式 Supabase 環境仍有 REVIEW；不是已完成正式部署認證。  
來源基準：GitHub 5fc4448465c5c5cdfdf3a19b5a8d8657b53d8c92 ＋本機 V0.02。  
人工審核人：待老師於 staging／正式部署前核對。

| 編號 | 結果 | 證據與限制 |
|---|---|---|
| QA-01 | PASS | 本機 migration 執行後五個應用表與三個 legacy 表 RLS 開啟；正式 catalog 待部署核對。 |
| QA-02 | PASS | 前端無直接 table/view .from、REST 或 GraphQL；公開與編輯資料均由 P135 RPC 提供。 |
| QA-03 | PASS | 資料交換明確呼叫十一個命名 RPC 中必要項目；Auth、新聞擷取、Gemini 為獨立受控流程。 |
| QA-04 | REVIEW | 資料表分隔至 p135_data／p135_legacy，public 僅 RPC；實際 Dashboard Exposed Schemas 及 PostgREST table endpoint 必須在 staging／正式環境核對。 |
| QA-05 | PASS | 五個新表在同一 migration 內具精確 grants、RLS、policies、RPC EXECUTE，未使用 shared defaults。 |
| QA-06 | PASS | 本機 PostgreSQL 已執行 anon、一般登入者、唯一 owner 的允許／拒絕案例；覆蓋公開、草稿、私人資料、跨使用者連結。 |
| QA-07 | PASS | 公開資料另存無原文／筆記／UID 的白名單快照；RPC 明列必要欄位，無 SELECT *／to_jsonb 整列回傳。 |
| QA-08 | PASS | PUBLIC EXECUTE 撤除；anon 只可呼叫三個公開 RPC。其餘均需 authenticated 並通過 owner 資格。 |
| QA-09 | PASS | 本版本十一個 RPC 全採 SECURITY INVOKER；沒有 DEFINER 例外。測試 fixture 的舊 DEFINER 只用來測遷移前環境。 |
| QA-10 | PASS | 所有 ID 為 UUID，不需要 sequence grants；Edge 使用使用者 token，沒有 service_role 憑證。 |
| QA-11 | PASS | Chromium 實測密碼預設遮蔽、空白鍵顯示／隱藏、Enter 登入及登出清除私有內容。 |
| QA-12 | REVIEW | 本包無實際 config.js、真實 key／token；原遠端 Git 歷史及既有部署設定追蹤尚未改動，需另行盤點及規劃。 |
| QA-13 | PASS | production SQL 只建立／操作 P135 名稱及專用 schema；只讀參照 auth.users 檢查指定 UID；無全域授權或跨 P 寫入。 |
| QA-14 | REVIEW | 同名 ZIP 外層、README、config-sample.js、database、docs 齊全。本輪為功能維護包，A3 宣傳海報未另製，後續展示交付時補製。 |
| QA-15 | PASS | 兩頁 Web Version 與本地 CSS/JS cache busting 均為 V0.03，不依賴既有 config.js 的舊版本值。 |

## 測試環境與限制

- PGlite 真正 PostgreSQL 執行原子 migration、RLS、角色 grants、公開／私人 RPC；Auth uid 是合成使用者情境。
- Chromium 153 以實際本機 PostgreSQL RPC／RLS 提供資料，驗證桌面 1440px、手機 390px、標籤等高／變寬／換行、登入拒絕、發布、閱讀、取消公開及鍵盤密碼控制。
- Edge Functions 以 TypeScript 編譯及獨立 VM 測試，使用實際 DOM parser；外部 Auth／Gemini／新聞 HTTP 以 fixture 代替。
- 未使用真實帳號、未呼叫付費 AI、未更改正式 GitHub／Supabase。
- 公開 table endpoint 是否關閉須由實際 Exposed Schemas 與 API 回應核對，本機 PostgreSQL 不等於 PostgREST gateway。
- Gemini 候選模型及新聞網站即時版型需要實際環境測試，沒有假稱目前一定可用。

## 本輪修復

- 新增 public/private 分離與唯一編輯資格，取代所有登入者可寫。
- 本版 RPC 全改 INVOKER，以專用未暴露 schema、逐操作 RLS、最小 grants 共同實作。
- 移除整列 JSON 回傳，公開投影無原文、筆記、事蹟、UID 或內部欄位。
- Edge 需要 editor 資格；新聞 URL、redirect、大小與 AI 回應結構有驗證。
- 原有資料保留在 p135_legacy；全部先列草稿，不自動公開。
- 新聞、筆記與分析安全文字渲染，閱讀感受持久化，擷取新文章清空舊狀態。

## 遷移核准與回復

本包已提供具體可審閱的 migration、唯一 owner 設定、staging 步驟與緊急暫停公開讀取 SQL。依 SDS 第 13 節，正式修改須先備份、staging 驗證並由老師核准；本次未執行任何正式環境寫入。請勿直接搬回 legacy 而忽略切換後新資料。
