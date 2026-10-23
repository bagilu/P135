# P135 V0.03 部署與驗證

## A. 事前準備

1. 備份 P135 原資料與 SQL 定義，確認能還原；另外保存兩個原 Edge Functions。不要把新聞全文、私人筆記或 Auth 使用者匯出放進公開 GitHub。
2. 記錄 P135 的 Supabase project、現有 config.js、兩個 Edge Functions Verify JWT 狀態與 AI_API_KEY。備份 secrets 在您的安全環境保存，不傳給 ChatGPT、不上傳 GitHub。
3. 先在 staging 用相同 schema 驗證 SQL、登入、RLS、公開讀取與寫入。只有您確認後才在正式維護時段執行。
4. 原 GitHub Pages 若曾追蹤 config.js，本包的 .gitignore 不會自動移除歷史或改變既有發佈流程。先保留可用部署設定；Git 追蹤／歷史的處理需另外規劃，避免網站斷線。

## B. 盤點與唯一編輯帳號

執行 `database/00_P135_Preflight.sql`。原 public 三表應啟用 RLS，anon／authenticated 不應有直接 data privileges。
對照 Authentication → Users 中您自己帳號的 User UID。不要把 GitHub username、Email 或 anon key 當成 UID。
文章篇數分布只用來協助核對；程式不會自動選擇作者或讓第一個登入者成為管理員。

到 Supabase 的 Data API 設定確認：`public` 依既有專案需求提供 RPC；`p135_data` 與 `p135_legacy` 都不能加入 Exposed Schemas。不要移除其他 P 專案合法需要的設定，也不要改共用 default privileges。

## C. 執行 migration

1. 正式切換時先停止編輯／暫停舊工作台入口，等待進行中的寫入完成。
2. 執行 `10_P135_Migrate.sql`，不要只執行其中幾行。它在同一 transaction 內完成 schema、資料複製、RLS、最小授權、十一個 INVOKER RPC、原表備份移位與 schema cache 通知。
3. 複製筆數會自動比對。原表保留在 p135_legacy，新的應用資料在 p135_data。所有舊文章 is_published=false，尚無任何公開快照。
4. 因為要保證複製一致，migration 會短暫鎖定 P135 三表；五秒內取不到鎖即整體失敗。失敗時先檢查訊息，不要刪除任何資料表。
5. 既有額外 View、外部外鍵、不同權限或重跑會被擋下。staging 應確認無其他專案／動態 SQL 依賴舊 public 表名；自動盤點不能識別所有動態 SQL。
6. 修改 20 檔唯一一行 `v_owner uuid := NULL;`，把 NULL 換成 `'您的 UID'::uuid`，執行。未設定時所有人都不能編輯；其他註冊帳號不會自動獲權。
7. 跑 99 HealthCheck，確認五個新表與三個 legacy 表 RLS 開啟、十一個 RPC 沒有 SECURITY DEFINER、只有三個公開 RPC 授予 anon。

## D. 更新 Edge Functions

兩個函式共用 `_shared/p135-auth.ts`。

### CLI（已有 CLI 的使用者）

在本包根目錄，先確認登入、project ref 都指向正確環境，再執行：

```sh
supabase functions deploy P135-analyze-news --project-ref YOUR_PROJECT_REF
supabase functions deploy P135-scrape-news --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` 兩個 Verify JWT=true。共用檔會隨 import 一起打包；保留既有 Secrets，不在命令列附 AI key。

### Dashboard

仍可手動部署，但編輯器必須包含共用檔及原相對 import 路徑。
若介面只能貼單檔，請使用本包 `docs/dashboard-single-file/` 內對應的自足版本（已把共用授權程式整合，仍保留 P135 命名）。
兩者擇一部署，不要同時建立另一組 generic 函式。部署後核對 Verify JWT 仍為 ON。

擷取函式會限制媒體主機、HTTPS 與重新導向；不支援的媒體請手動貼入。AI 回傳先做 JSON 結構檢查，失敗不會偽裝成功。

## E. 更新前端

保留原 config.js，只覆蓋：

- index.html
- editor.html
- css/library.css、css/style.css
- js/library.js、js/editor.js、js/supabase-client.js

index.html 要位於 Pages 原根目錄，不要多包一層資料夾。新環境才複製 config-sample.js 建立 config.js。
不需要上傳 database、docs、tests、supabase 或任何備份到 Pages。

## F. 必須在實際 Supabase 驗證

| 身分／操作 | 預期 |
|---|---|
| 未登入訪客開首頁、閱讀已公開文章 | 可閱讀、不需登入 |
| 未登入／其他帳號開工作台 | 看得到登入／拒絕訊息，無私人內容 |
| 其他登入帳號呼叫編輯 RPC 或兩個 Edge Functions | 拒絕 |
| 唯一編輯者新增文章、分析、儲存草稿 | 成功，訪客尚看不到 |
| 勾選公開並儲存 | 首頁出現；閱讀頁只含允許欄位 |
| 取消公開並儲存 | 首頁移除，直接文章連結也不可讀 |
| 不同日期與空日期，排序切換、搜尋、上一篇下一篇 | 跟隨同一排序；空日期最後 |
| anon、一般登入者、編輯者對私人 table endpoint | public 舊表端點不存在；Accept-Profile:p135_data／p135_legacy 不在允許 schemas |

只有公開內容表的 SQL SELECT 權限不代表 REST endpoint 可暴露。請確保 schema 未暴露，不能用「回空集合」替代端點邊界驗證。
若遇到 42501，先看 schema USAGE、逐表 grants、RLS 與 owner 設定；不要授予 ALL 或關閉 RLS。

## G. 中止與回復

- 要暫停所有公開讀取，可由管理者執行 `80_P135_SuspendPublicReading.sql`；恢復前先修復問題，確認後用 90 檔恢復本版設計權限。
- 90 檔只操作 P135 新 schema 與明列的 RPC，不重建資料、不更改共用設定。
- 原表備份不會自動包含切換後的新編輯。若需要退回舊版，先停止寫入並另外備份 p135_data，核對差異，再規劃保留新增資料的回復；不要直接把舊檔覆蓋回去或搬回原表當作完整回滾。
- 尚未執行 migration 時，單純還原前端即可回到原網站；執行後則須按前述資料差異處理。
