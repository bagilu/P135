# SBI-P-SDS v3.4

## 智慧商情研究室 P 系列專案共用開發規範

**SBI Lab P-Series Shared Development Standard**  
**Version 3.4 · 2026-10-20**  
慈濟大學 經營管理學系｜智慧商情研究室

### 最高原則

帳號共用，權限分開；資料共庫，物件隔離；前端分站，後端以 Project Code 嚴格分界。

> **RLS Always On → No Direct Table Access → RPC Only → Least Data → Least Privilege**  
> 全面啟用 RLS → 禁止前端直接存取資料表 → 統一透過 RPC → 最小資料揭露 → 最小權限授予

## 0. v3.4 版本變更摘要

本版完整承接 v3.3 的 shared Auth、P130 Account Center、跨專案隔離、migration、Web Versioning、海報標準、密碼顯示／隱藏、RLS/RPC 強制規範與交付前檢查。本版新增：

- 納入 Supabase 2026-10-30 權限預設變更：既有專案中新建的 `public` 資料表不再自動取得 Data API grants；既有資料表保留原有 grants。
- 明確區分 `GRANT` 與 RLS：前者決定資料庫角色能否執行操作，後者決定可操作哪些資料列，兩者不可互相取代。
- 明確定義 RPC-only 的 API 暴露邊界、逐表授權原則、`SECURITY INVOKER` 預設與錯誤測試要求。
- 禁止以廣泛 `GRANT`、全域預設權限或關閉 RLS 作為快速修復。

本版新條文優先於 v3.3 中較寬鬆的內容。既有系統以 migration 漸進改善；不得因本版發布而未經評估批次變更權限。

## 1. 適用範圍與總體架構

適用於 SBI Lab 所有 P 系列網站與系統。預設架構為 GitHub Pages（HTML/CSS/JavaScript）＋ Supabase PostgreSQL。低敏感度專案得共用 Supabase Project，但必須確保資料庫物件、角色、RLS、RPC 與 migration 隔離；高敏感系統應評估獨立 Supabase Project。

| 層級 | 標準 |
|---|---|
| 前端 | GitHub Pages；非必要不引入 Node/npm/build pipeline |
| 資料庫 | Supabase PostgreSQL；按 Project Code 隔離 |
| 登入 | 共用 Supabase Auth；各 P 專案自行登入 |
| 帳號維護 | 集中由 P130 Account Center 處理 |
| 授權 | 各 P 專案自行管理角色及業務權限 |

## 2. GitHub 與交付規範

### 2.1 GitHub Pages

預設使用靜態 HTML/CSS/JavaScript。大型框架須有明確需求，不為技術炫技增加部署複雜度。

### 2.2 `config.js`

部署環境使用 `config.js` 儲存公開 Supabase URL 與 anon/publishable key；版本庫及 ZIP 僅提供 `config-sample.js`，禁止覆蓋既有 `config.js`。`service_role`、secret key、SMTP 密碼與其他機密不得放入公開前端。

### 2.3 ZIP 與目錄

ZIP 最外層須為同名資料夾；至少包含 `README.md`、`config-sample.js`、前端檔案、`database/`、`docs/`。建議提供 `90_Pxx_Permissions.sql`、`99_Pxx_HealthCheck.sql`。

### 2.4 Web Versioning（承襲 v3.2）

- 開發／測試階段採可見流水版本號，建議自 V0.001 起遞增；每次使用者可見或可操作的前端變更均應遞增。
- `index.html` 應顯示 Web Version；CSS/JS query-string cache busting 版本必須同步。
- Git commit SHA 不等於 Web Version；純 SQL、文件或未改變前端可見行為的後端更新不強制遞增。

## 3. Supabase 物件命名規範

| 物件 | 命名 |
|---|---|
| Table | `TblPxx...` |
| View | `VwPxx...` |
| PostgreSQL Function / RPC | 名稱必須包含 P 編號，例如 `P118_GetTimelineSites` |
| Edge Function | 名稱包含 P 編號 |
| Storage bucket | 名稱具有 P 專案辨識 |

禁止沒有專案識別的 generic 物件（如 `users`、`records`、`uploads`），正式跨專案平台物件除外。

## 4. P-SDS 跨專案隔離

任何單一 P 專案 SQL、RPC、policy、trigger、Edge Function、migration 只能操作本專案物件；不得修改其他 P 專案。

禁止於單一專案 migration 使用全域 `GRANT/REVOKE ON ALL TABLES/SEQUENCES IN SCHEMA public`、`ALTER DEFAULT PRIVILEGES`、`DROP SCHEMA public CASCADE`、`DROP OWNED BY`、`GRANT/REVOKE ALL ON SCHEMA public`。跨專案平台治理須另行審核。

Supabase 的新預設不構成使用全域預設權限或廣泛 grants 的理由。新資料表以逐表、逐角色、逐操作授權為原則。

## 5. 前端資料存取規範

資料流：**Frontend → 專案 PostgreSQL RPC → Database**。GitHub Pages 前端禁止直接對 Table 或 View 進行 `SELECT`、`INSERT`、`UPDATE`、`DELETE`，包括 Supabase `.from()` 或等價 REST/GraphQL 查詢。所有前端資料交換均透過本專案命名空間的 PostgreSQL Function（Supabase RPC）。不得以公開 anon key 作為授權證明。

v3.2 允許優先採 RPC/Edge Function 的建議，在 v3.3 起改為強制 RPC-only 資料庫交換規則。Edge Function 如需資料庫存取，亦應遵守專案邊界與權限控制；特殊非 PostgreSQL 服務流程應經獨立架構審查。

v3.4 補充：前端程式碼不得呼叫資料表／View API；正式環境亦應以 Data API 的 **Exposed Schemas** 設定限制可呼叫的 schema，避免只靠前端自律。需要落實 RPC-only 時，僅暴露 RPC 所在 schema；資料表所在 schema 不得暴露。

## 6. 共用 Supabase Auth 與 P130 Account Center

所有需要登入的 P 專案原則上共用同一 Supabase Project 的 `auth.users`；每個 P 專案保留自己的登入頁與 `signInWithPassword()` 流程。註冊、Email 驗證、忘記密碼、重設／修改密碼、基本資料與跨 P 授權管理集中於 P130。P130 不是另一套 Supabase Auth。

各專案登入頁可連結 P130 註冊、忘記密碼、帳號設定；Supabase Authentication Redirect URLs 必須保留所有合法專案網址。

### 6.1 密碼顯示／隱藏（承襲 v3.3）

所有 P 系列專案任何密碼欄位均須提供「顯示密碼／隱藏密碼」控制，包含登入、註冊、確認密碼、重設與修改密碼。預設遮蔽；切換不改變欄位值；控制應有可辨識標籤及鍵盤操作能力。不得記錄、傳送或在日誌顯示明文密碼。

## 7. Authentication 與 Authorization 分離

Auth 回答「你是誰」，專案授權回答「你能做什麼」。三層為 Shared Auth（`auth.uid()`）、Project Access（是否可使用該 P 專案及角色）、Project-local Role（單位或業務權限）。某專案管理員不自動等於其他專案管理員。

跨專案授權可由 P130 及正式平台物件維護；不能因使用者已登入就視為取得所有 P 專案權限。

## 8. Auth 前端與安全實作

- 每個 P 專案使用不同 `auth.storageKey`，例如 `P112-auth`；無登入需求者可設定 `persistSession: false`。
- 不得在 `auth.users` 新增時以 Auth Trigger 自動建立全部 P 專案 profile；各專案按需由自身 RPC 初始化。
- 退出單一 P 專案不得刪除 shared `auth.users`；應停用該專案 access 或 membership。

## 9. RLS、Data API Grants、SECURITY INVOKER 與 RPC

### DB-01 RLS Always On

所有 P 系列資料表一律啟用 RLS。公開資料亦不得以關閉 RLS 取代權限設計；同時審核 schema exposure、table grants、policy、view 與 function 執行身分。

### DB-02 No Direct Table Access

公開前端不得對 Table/View 直接進行 `SELECT/INSERT/UPDATE/DELETE`，包括 Supabase `.from()` 或等價 REST/GraphQL 查詢。應檢查 Data API Exposed Schemas；不能只以「前端目前沒有寫 `.from()`」當作已限制直接存取。

### DB-03 RPC Only

所有前端與 Supabase PostgreSQL 的資料交換均經由本專案命名空間 RPC Function；SQL 業務邏輯留在資料庫端。RPC 所在 schema 才列入 Data API 的 Exposed Schemas。

### DB-04 Least Data

Function 僅回傳業務必要欄位；禁止為方便使用 `SELECT *` 或回傳不必要 Email、token、內部註記、他人資料。

### DB-05 Least Privilege：Function

Function 應撤除 `PUBLIC EXECUTE`，按需求明確授予 `anon` 或 `authenticated`。管理、匯入、批次更新、核准、敏感資料、跨使用者資料、權限變更等 Function 不得授權 `anon`。`authenticated` 僅代表登入，不代表管理權；Function 必須檢查專案角色與業務權限。

### DB-06 Least Privilege：Table Grants

`GRANT` 是資料庫操作權限，不是登入或業務授權；RLS policy 不會替代 `GRANT`，也不會自動撤銷既有 `GRANT`。僅授予 RPC 實際需要的角色與操作。`anon` 預設不得取得人物、答題紀錄、會員、管理或其他非公開資料表權限。`service_role` 會繞過 RLS，僅供受控伺服器端使用，絕不放入瀏覽器、ZIP 或 GitHub。

### DB-07 Data API 新表預設（v3.4 新增）

依 Supabase 公告，自 **2026-10-30** 起，既有專案中新建的 `public` 資料表不再自動獲得 Data API 權限；既有資料表保留原 grants。缺少必要 `GRANT` 時，API 請求會在 RLS policy 評估前因資料庫權限不足而失敗，常見 SQLSTATE 為 `42501`。不得因公告而批次開放所有既有資料表。

### DB-08 RPC Only 的建議資料庫邊界（v3.4 新增）

新專案或可重構專案，建議以一個暴露給 Data API 的 RPC schema 提供命名空間函式；P 專案資料表放在未暴露的專案資料 schema（例如 `p139_data`）。在不暴露資料 schema 的前提下，依 `SECURITY INVOKER` 函式所需，授予 `authenticated` 對該 schema/table/sequence 的最小 `USAGE`／操作權限，並啟用 RLS、設定逐操作 policies。這可讓 RPC 以呼叫者身分執行，而不直接提供資料表 REST endpoint。

若沿用 exposed `public` tables，`GRANT` 會讓角色具備直接呼叫該資料表 Data API 的權限入口；實際資料仍受 RLS 控制，但這不等同於技術上封閉資料表 endpoint。不得以寬鬆 `GRANT` 假稱達成 No Direct Table Access。既有系統遷移須先驗證，不得直接搬移 schema 或撤權造成服務中斷。

### DB-09 SECURITY INVOKER 預設，DEFINER 僅例外（v3.4 新增）

PostgreSQL Function 預設採 `SECURITY INVOKER`，使函式依呼叫者權限與 RLS 執行。若明確需求無法以 invoker 完成，`SECURITY DEFINER` 僅可作書面核准的例外：固定安全 `search_path`、所有物件以 schema-qualified 名稱、撤除不必要的 `PUBLIC/anon EXECUTE`、驗證輸入與 `auth.uid()`、檢查 project/unit role、避免 SQL injection、限制回傳欄位，並進行允許與拒絕案例測試。

### DB-10 逐表 Migration 必備項目（v3.4 新增）

建立每一張應用程式資料表時，必須在同一份 migration 中列出 RLS、逐操作 policies、精確 `GRANT/REVOKE`、必要的 sequence 權限、schema exposure 決策、RPC Function 與 EXECUTE 權限。不可依賴 Supabase 自動授權。

示意範例（替換成實際 Project Code 和物件；僅授予業務實際需要的操作）：

```sql
CREATE SCHEMA IF NOT EXISTS p139_data; -- 不加入 Data API Exposed Schemas
ALTER TABLE p139_data."TblP139Person" ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA p139_data TO authenticated;
GRANT SELECT ON TABLE p139_data."TblP139Person" TO authenticated; -- 僅供讀取 RPC 所需
REVOKE ALL ON TABLE p139_data."TblP139Person" FROM anon;
-- 同一 migration 建立逐操作 RLS policies，依 auth.uid() 與 P 專案角色驗證
-- RPC 位於已暴露 schema；預設 SECURITY INVOKER
REVOKE EXECUTE ON FUNCTION public."P139_ListPeople"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public."P139_ListPeople"() TO authenticated;
```

新增、修改、刪除 RPC 需各自精確授予底層操作與對應 RLS policy。若使用 identity/serial，僅在必要時授予對應 sequence 權限。以上為架構示意，不可原封不動套用到正式資料。

## 10. Edge Function 與 Storage

Edge Function 與 Storage bucket/policy 必須帶專案識別且僅處理本專案；secrets 與 `service_role` 不得進 GitHub。允許 Supabase Dashboard 手動部署，不強制 CLI。人物照片等內部資料不得放在 GitHub Pages 或公開 bucket；須使用受權限政策保護的私有 Storage。

## 11. Migration、Permissions 與 Health Check

有正式資料的專案一律以 migration 更新；未經授權不得 drop/rebuild。Permissions SQL 只修本專案物件。Health Check 須驗證 table、function、RLS、policy、grant、schema exposure、跨專案引用及 RPC 可執行性。

- 每一個新資料表均須於同一 migration 附逐表 grants、RLS policies 與測試；不得使用全域 grants 或 `ALTER DEFAULT PRIVILEGES` 取代。
- Health Check 必須核對 anon/authenticated/service_role 的實際 table 與 function 權限；檢查敏感 table 不在 Data API Exposed Schemas。
- 以 anon、一般 authenticated、具管理角色的 authenticated 分別測試允許與拒絕案例；測試 RPC 及直接 table endpoint 均得到預期結果。
- 遇到 `42501`／`permission denied`，先檢查角色、逐表 `GRANT`、schema `USAGE`、sequence 權限及 schema exposure；不得先加寬 RLS 或授予 ALL。

## 12. 新專案與 ZIP 交付清單

- 確定 Project Code、Stable Baseline 與專案物件命名。
- 提供 `config-sample.js`，不提交部署用 `config.js` 或密鑰。
- 共用 Auth、獨立 storageKey；帳號生命週期交由 P130。
- 專案權限與 shared Auth 分離；資料表全部啟用 RLS。
- 前端資料交換一律 RPC，禁止直接存取 Table/View；驗證 API Exposed Schemas 只暴露必要 RPC schema。
- 資料表位於適當 schema；GRANT、RLS policies 與 API schema exposure 一併設計。
- 每張新表的 migration 均含逐表精確 GRANT/REVOKE、RLS、policy、必要 sequence grants 與測試。
- Function 預設 SECURITY INVOKER；PUBLIC EXECUTE 撤除後明確授權；DEFINER 僅為受控例外。
- 管理與敏感 RPC 禁止 anon；登入者仍須通過專案角色與業務權限檢查。
- SQL 不得包含跨 public schema 全域權限變更或未經核准的 ALTER DEFAULT PRIVILEGES。
- 保留 Permissions 與 HealthCheck，並測試 anon、authenticated、管理者及直接 table endpoint。
- ZIP 含同名資料夾、README、database、docs。
- Web Version 與 CSS/JS cache busting 一致。
- 密碼欄位皆有顯示／隱藏功能。
- 展示型專案遵守 A3 海報規範。
- 執行第 16 節合規檢查並保留報告。

## 13. 舊專案遷移策略

既有 shared Auth 專案於下次改版檢查 storageKey、redirect、project role、RLS 與帳號維護入口；自建帳密專案以 migration 轉換並保留 ID 對應；公開專案不強制加入 Auth；高敏感系統評估獨立 Supabase Project。

- Supabase 宣告既有資料表 grants 不受 2026-10-30 變更影響；不需要僅為期限批次重授權或撤權。
- 下一次新增資料表時，採用逐表 grant/RLS/RPC 模板；若目前 schema 暴露過多，先做唯讀權限盤點及測試，再提出逐步遷移方案。
- 未經備份、staging 驗證與正式核准，不得直接把既有資料搬 schema、批次 revoke grants、改 Data API Exposed Schemas 或改 shared default privileges。
- 各專案須分別確認 schema exposure、RLS、table grants 與 RPC 權限；單一 P 專案不得自行調整共用 Supabase Project 的全域預設。

## 14. 核心原則摘要

- 帳號共用，權限分開；資料共庫，物件隔離。
- 前端分站，後端以 Project Code 嚴格分界。
- 各專案自行登入，帳號生命週期集中 P130。
- 新增功能優先 migration，不破壞既有資料。
- Web Version 可見可追蹤，與 cache busting 同步。
- 展示作品以一致海報標準交付。
- RLS Always On → No Direct Table Access → RPC Only → Least Data → Least Privilege。
- GRANT 與 RLS 同時設計；逐表最小授權；API 僅暴露必要 RPC schema。
- 交付前進行自動檢查及必要人工審查。

## 15. P 系列專案海報製作規範（承襲 v3.2）

### 15.1 適用與目的

適合教學展示、成果展、競賽或公開介紹的專案，原則上提供標準宣傳海報，讓首次接觸者理解專案價值、主要功能與體驗方式。

### 15.2 尺寸與格式

標準 A3 直式（297 × 420 mm）；標準交付 PDF + SVG。特定活動可另製 A2/A1，但保留 A3 基準版。

### 15.3 固定識別與內容

海報頂端原則上固定顯示「慈濟大學 經營管理學系 好玩實驗室 作品」；標明 Project Code、中英文正式名稱、網站 QR Code、核心概念、主要功能或操作流程。電子版「好玩實驗室」可連結 P101。不應直接將 README 或 schema 搬上海報。

### 15.4 視覺與交付驗證

延續專案網站風格；保持清楚層級、留白及遠距可讀性；中英文字不得亂碼、裁切或重疊。QR Code 必須由真實網址以程式或可信工具產生並實測掃描；確認正式名稱、機構名稱、URL、A3 尺寸、SVG viewBox，以及 PDF/SVG 內容一致。生成式圖片不得產生精確 QR Code 或關鍵文字。

### 15.5 建議檔名

`P132_ProgressiveImmersion_A3_Poster.pdf` ／ `P132_ProgressiveImmersion_A3_Poster.svg`

## 16. 交付前自動合規檢查

每次正式交付 ZIP、合併 Pull Request 或更新正式 GitHub 網站前，應執行合規檢查並保存報告。PASS：符合；FAIL：違反強制規範；REVIEW：自動化無法判定，須人工審核。任何 FAIL 不得視為合格交付。

| 編號 | 檢查內容 | 方式 |
|---|---|---|
| QA-01 | 所有 P 系列表啟用 RLS | 唯讀 catalog SQL |
| QA-02 | 前端未直接操作 Table/View | HTML/JS 靜態掃描 |
| QA-03 | 前端資料交換皆經 RPC | 靜態掃描＋人工審查 |
| QA-04 | API Exposed Schemas 僅含必要 RPC schema；敏感表所在 schema 未暴露 | 設定盤點＋Data API 測試 |
| QA-05 | 每張新表具逐表最小 GRANT/REVOKE；不依賴自動 grants | migration＋catalog 查詢 |
| QA-06 | RLS policies 覆蓋每個必要操作與角色 | SQL 審查＋允許/拒絕測試 |
| QA-07 | RPC 只回傳必要欄位 | Function 定義人工審查 |
| QA-08 | Function 未授權 PUBLIC EXECUTE；敏感 RPC 未授權 anon | catalog grants 查詢 |
| QA-09 | SECURITY INVOKER 預設；DEFINER 例外符合安全條件 | SQL 靜態掃描＋人工審查 |
| QA-10 | 必要 sequence 權限最小化；service_role 僅伺服器端 | catalog 查詢＋secret 掃描 |
| QA-11 | 密碼顯示／隱藏功能正常 | UI 鍵盤與操作測試 |
| QA-12 | 無真實 config.js、secrets、service_role 檔案與 Git 歷史掃描 | 檔案與 Git 歷史掃描 |
| QA-13 | SQL 物件及修改範圍符合 Project Code；無未核准全域 GRANT/default privileges | SQL 靜態掃描 |
| QA-14 | v3.2 原有交付及海報規範 | 既有檢查 |
| QA-15 | Web Version 與 cache busting 一致 | 靜態檢查 |

靜態掃描不得取代安全審查。特別是 Function 最小揭露、跨使用者存取、RLS 繞過、SECURITY DEFINER、dynamic SQL 及角色判斷，必須以實際執行身分測試。SQL catalog 檢查應使用唯讀查詢，不得藉檢查修改共用資料庫。

建議交付報告包含 Project Code、SDS 版本、Web Version、commit SHA、檢查時間、各項 PASS/FAIL/REVIEW、人工審核人與修正紀錄。GitHub Actions 可逐步導入，但未導入前仍須執行人工／本機檢查。

## 17. 版本紀錄

| 版本 | 變更重點 |
|---|---|
| v3.1 | shared Auth 與 P130 Account Center 分工 |
| v3.2 | Web Versioning、Cache Busting、Project Poster Standard |
| v3.3 | 密碼顯示／隱藏、RLS/RPC 強制安全規範、交付前合規檢查 |
| v3.4 | Supabase 新 public tables Data API grants 變更；逐表最小權限、schema exposure、RPC-only 邊界與安全測試 |

文件註：v3.4 承襲 v3.3 全文並補充 Supabase 2026-10-30 Data API 權限預設變更。若個別專案有例外需求，須事先形成書面風險評估與核准紀錄。
