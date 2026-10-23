# P135 翻轉新聞 FlipNews — V0.03

個人的政治新聞分析庫，公開閱讀、唯一編輯者維護。

## 這版完成的功能

- 公開文章庫成為首頁：同高、寬度隨標題調整的標籤，自動換行。
- 每個標籤只顯示標題與報導日期；預設新到舊，可切換舊到新，並搜尋標題／媒體。
- 缺少報導日期的文章置於最後；不以匯入日冒充報導日期。
- 閱讀頁包含標題、日期、來源、原文連結與四項分析，並提供上一篇／下一篇。
- 相鄰文章跟隨首頁排序及搜尋；即使未載入下一批標籤仍可切換。
- 頁面最下方才放編輯工作台入口。
- 訪客不需登入；只有資料庫指定的一個 Supabase User UID 可以編輯。其他登入帳號仍只是讀者。
- 編輯工作台保留原流程，新增草稿／公開勾選；勾選後必須按儲存才生效。
- 心理感受分析可儲存及還原；擷取新新聞會清空舊分析、筆記及公開狀態。

## 本版需要後端升級，不能只覆蓋網頁

**先備份、於 staging 驗證，再依您的正式核准執行。此 ZIP 沒有更改正式 GitHub 或 Supabase。**

部署順序：

1. 先讀 `docs/Deployment.md`，備份正式資料、五個舊 RPC 與兩個舊 Edge Functions。
2. 在 SQL Editor 執行 `database/00_P135_Preflight.sql`，核對帳號 UID、原表權限及 schema exposure。
3. 在 staging 先執行 `database/10_P135_Migrate.sql`；確認後才在正式維護時段執行。
4. 編輯 `database/20_P135_SetOwner.sql`，將 `v_owner uuid := NULL` 改為您的 User UID，例如 `v_owner uuid := '您的 UUID'::uuid`，再執行。
5. 執行 `database/99_P135_HealthCheck.sql`；核對 Dashboard 未暴露 `p135_data`、`p135_legacy`。
6. 更新兩個 Edge Functions。每一個函式都需要 `supabase/functions/_shared/p135-auth.ts`；不能只貼單一 index.ts 而漏掉共用檔。部署方式見 Deployment.md。
7. 保留原有的實際 `config.js`，上傳 `index.html`、`editor.html`、`css/`、`js/` 至原 GitHub Pages 根目錄。
8. 重新整理確認 V0.03；登入編輯者帳號，在工作台歷史庫載入文章，檢查後勾選公開並儲存。

**既有文章遷移後全部先列為草稿，首頁起初沒有公開文章是正常的。**

## 設定與秘密

- ZIP 只提供 `config-sample.js`。更新既有環境不要覆蓋 `config.js`；新環境才複製範本並填入公開 URL、anon/publishable key。
- P135 保留自己的 `P135-auth-token` storageKey 與登入頁。註冊、忘記密碼、帳號維護導向 P130。
- `AI_API_KEY` 仍在 Supabase Secrets；本包沒有任何真實 key、User UID、登入 token 或新聞資料備份。
- 可選 `AI_MODELS` 是逗號分隔的候選模型清單；未設定時保留交接版的候選順序。實際可用模型應以您的 Gemini 帳號與執行紀錄為準。
- 兩個 Edge Functions 的 Verify JWT 均保留 ON，並額外驗證真實登入者及 P135 編輯資格。

## 資料與權限

- `p135_data`：未暴露的專用 schema。保存原文章、私人筆記、人物／事蹟、編輯資格及已公開內容快照。
- `p135_legacy`：未暴露的原表備份 schema；保留遷移當下的原表資料與 UUID，不刪除資料。
- `public`：只保留 P135 命名 RPC；不在 public 留下 P135 敏感資料表。
- 公開快照只含標題、來源連結、日期及分析。原新聞全文、私人筆記、人物事蹟不會複製到公開快照。
- 所有本版 RPC 採 SECURITY INVOKER，逐表最小 grants、逐操作 RLS；沒有 service_role 憑證、共用預設權限或跨 P 寫入。

## 相容性與限制

- 本版可遷移交接時的三個 public P135 表。若權限與基準不同、有額外 View／外部外鍵依賴或已初始化，migration 會停止，請先盤點，不要刪表重跑。
- 既有的 `P135_UpsertArticle` 相容 RPC 僅儲存草稿；更新舊頁面會取消該篇的公開，避免舊介面不知情發布。
- 來源擷取限制為自由、聯合、中時、三立的 HTTPS 網址；其他媒體可在工作台手動貼入。
- AI 分類不是外部事實查核；角色對調是明確的假設改寫。
- 已完成本機實際 PostgreSQL、瀏覽器及後端模擬測試；尚未代您部署或驗證正式 Supabase gateway。正式權限／Exposed Schemas／模型可用性仍須核對。

## 檔案導覽

- `database/`：盤點、原子 migration、擁有者設定、權限修復、Health Check、緊急暫停公開讀取。
- `supabase/`：兩個 Edge Functions、共用授權程式與 Verify JWT 記錄。
- `docs/`：部署、隱私與架構、SDS v3.4 原文、合規報告及測試結果。
- `tests/`：可重跑的本機測試程式與合成 fixture；只用於測試，不上傳至 Pages 或 SQL Editor。

請依 `docs/Deployment.md` 分階段部署，勿將整個 ZIP 無差別上傳至 GitHub Pages。
