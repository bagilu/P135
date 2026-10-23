# P135 V0.04.2 更新

## 已有 V0.04.1 資料庫的本次部署

**這次不執行任何 SQL，不清除文章，不需再設定編輯者。**

1. 在 Supabase Edge Functions 的 P135-analyze-news → Code，覆蓋本包 docs/dashboard-single-file/P135-analyze-news.ts 全部原碼後部署；Verify JWT 保持 ON。
2. Edge Functions → Secrets 設定 AI_MODELS：gemini-3.8-flash,gemini-3.5-flash-lite。保留原 AI_API_KEY。已有 AI_MODELS 時覆蓋舊清單，否則舊 Secret 會繼續優先於程式預設值。
3. P135-scrape-news 與 _shared/p135-auth.ts 沒有修改，不需為本次更新重新部署擷取函式。CLI 使用者只部署 P135-analyze-news，其共用 auth import 一起打包。
4. GitHub 前端版本為 V0.04.2，現有 config.js 保留。登入編輯工作台測試一次分析，再確認草稿／公開儲存。
5. 成功執行紀錄會記錄實際模型與 V0.04.2；失敗時 P135 AI attempt 顯示模型、kind 與 HTTP status，不記錄原文、上游錯誤本文、key 或 token。

全部 database/*.sql 與 V0.04.1 相同；下方初始化步驟只供從未安裝新版的環境使用。

---

# P135 V0.04.1 全新安裝

## 適用範圍與授權

使用者明確確認 P135 原資料為可捨棄的測試資料，改採直接初始化；本輪不執行保留原資料的 V0.03 schema 搬移。已下載的原資料匯出可自行留存。本版本只準備／交付 SQL，不表示 ChatGPT 已登入或執行 Supabase SQL。

## 1. 指定原有帳號

在正確專案 Authentication → Users 複製自己帳號的 User UID。修改 `database/10_P135_FreshInstall.sql` 的唯一一行：

```sql
v_editor_user_id uuid := '您的 User UID'::uuid;
```

預設 NULL、未知 UID 都會在刪除前停止，不自動選第一個帳號或依文章數猜擁有者。原有共用 Auth 帳號不清除。

## 2. 核對資料 API 邊界

Data API Exposed Schemas 中，public 依其他專案需求保留；p135_data 不得列入。不要改其他專案的設定或 shared default privileges。SQL current_setting 查不到時必須人工核對，不可將 NULL 當成安全證據。

## 3. 執行唯一初始化 SQL

先暫停 P135 舊編輯操作。在正確專案 SQL Editor 開新查詢，貼入修改 UID 後的完整 10 檔並執行。

一次交易的操作範圍：驗證 UID 與目標狀態 → DROP 精確四張舊 P135 表 RESTRICT → 建立 p135_data 五表、RLS、精確 grants、十一 RPC、唯一編輯者 → 通知 API schema cache → COMMIT。

刪除的原資料表只有 public.TblP135_Articles、public.TblP135_Entities、public.TblP135_EntityEvents、public.TblP135_SwapRules。它們的資料不搬移；其他表不刪除。未知 P135 物件、函式多載、已存在新版 schema、外部 FK／View 等依賴或取鎖逾時會讓操作停止。失敗時先 ROLLBACK（如查詢顯示交易未結束），保留錯誤訊息檢查，不能加 CASCADE 繞過。

成功輸出三個 true。初始化已指定編輯者，一般不需另跑 20 補設定檔。**不要重跑 10 來修復其他問題。**

## 4. 更新兩個 Edge Functions

Dashboard 的 P135-analyze-news 與 P135-scrape-news，分別貼入 `docs/dashboard-single-file/` 中的對應 TypeScript 原碼並部署。保留 Secrets 中既有 AI_API_KEY；不要把 key 貼入程式或聊天。兩個 Verify JWT 均維持 ON，函式內再檢查真實使用者與 P135 編輯資格。

CLI 使用者也可以用 supabase/functions 多檔版部署；共用 _shared/p135-auth.ts 隨 import 打包。兩種版本選一種，不另建泛用函式。原 Gemini 候選順序未變；實際可用性依帳戶與執行紀錄驗證。

## 5. GitHub 與前端

根目錄 index.html、editor.html、css/、js/ 為 V0.04.1。保留既有部署 config.js；更新不會重建 Supabase 專案或換 URL／公開 anon key。新環境才由 config-sample.js 建立 config.js。

ZIP／新增程式只提供範本。既有 GitHub 曾追蹤的 config.js 需維持現有發佈相容，這次不覆蓋、不清除 Git 歷史；合規報告將此列 REVIEW。資料備份、密碼、secret 不能上傳 GitHub。

## 6. 實際驗收

1. 99 HealthCheck：五表 RLS 開啟、十一 RPC 都為 INVOKER，anon 只有三個公開 RPC，編輯者數為一。
2. 訪客首頁可載入，最初無文章；指定 UID 登入工作台後可新增、擷取、分析與儲存。
3. 普通登入帳號無編輯資格、無私人資料；呼叫編輯 RPC／Edge 均拒絕。
4. 草稿不公開；勾選公開並儲存後可讀，取消公開後清單與直接文章連結都不可讀。
5. 公開讀取無原文、筆記、UID 或人物事蹟；日期排序、搜尋、前後篇及手機換行正常。
6. 對 p135_data 直接 table endpoint 的 anon/authenticated profile 請求由 gateway 拒絕；不能用「只回空集合」當作未暴露證據。

## 故障處理

- 找不到 RPC：核對 10 的三個 true 與 config.js 是否指向同一專案。10 已含 NOTIFY pgrst,'reload schema'。
- 42501：核對 UID、schema USAGE、逐表 grants／RLS；不要授予 ALL 或關閉 RLS。90 檔只修復既有 P135 新物件的設計權限。
- AI／擷取失敗：看對應 Edge 執行紀錄與 Secrets，不貼出金鑰。公開頁載入與 Edge 部署為兩個不同驗收項。
- 需要暫停公開：80 檔撤除三公開 RPC 的執行權，90 可恢復；不刪文章。
- 10 成功後舊資料無法由本版自動還原；將來已儲存的正式新資料不可藉重跑初始化清除。
