# P135 翻轉新聞 FlipNews — V0.05

## V0.05 更新方式

已正常運作的網站只需更新前端 `index.html`、`editor.html`、`css/library.css`、`js/library.js`、`js/editor.js`，保留原 `config.js`。**不執行任何 SQL，不需重新部署 Edge Functions 或修改 Secrets。**

- 緊湊的兩行文章標籤：日期為獨立色塊，與標題共用兩行；完整標題保留在閱讀頁與連結提示。
- 五種柔和彩色底依文章 ID 固定分配，僅供視覺區隔，不代表政治立場或媒體分類。
- 縮小頁首及介紹區；文章區更早出現。
- 每批 100 篇，接近底部自動載入下一批，保留手動「載入更多」備援。
- 搜尋與排序由既有 RPC 處理整個公開文章庫；切換條件重新從第一批開始。返回文章庫保留已載入清單與捲動位置。
- 追加載入失敗時保留已載入文章，按「重新載入」接續失敗批次；避免重複請求與過期搜尋結果混入。

本次 37 項檢查通過：DOM 17、分批載入 8、Chromium／本地 PostgreSQL 整合 12；正式 Supabase 的資料不曾改動。全部 SQL 與 Edge Functions 和 V0.04.2 逐位元組相同，原資料庫及 Edge 測試報告保留為該版的歷史證據，沒有重新計入本次測試總數。

## V0.04.2 AI 修復紀錄（已完成者略過）

**既有資料庫與文章保留，不要再次執行任何初始化 SQL。**

1. 在 Supabase Edge Functions → P135-analyze-news → Code，以 `docs/dashboard-single-file/P135-analyze-news.ts` 全部原碼覆蓋並重新部署。Verify JWT 保持 ON。擷取函式不需重新部署。
2. 在 Edge Functions → Secrets 將 AI_MODELS 設為 `gemini-3.8-flash,gemini-3.5-flash-lite`，保留原 AI_API_KEY。設定值不放入 config.js 或 GitHub。兩個模型會依序嘗試；Flash-Lite 是不同能力／速度取向的備援，不宣稱輸出品質相同。
3. 重新整理網站，登入後對同一篇新聞再執行一次分析。成功時 Logs 顯示 `P135 analysis model <模型> V0.04.2`。
4. 若仍失敗，回傳會包含模型名稱、HTTP 狀態或逾時／格式原因；Logs 的 `P135 AI attempt` 只記錄受控診斷，沒有新聞或金鑰。503 仍可能是外部服務尚未恢復，本版不保證上游供應狀態。

修正：移除預設 2.5／舊 3.5 Flash 候選，保留 3.8 主模型並加入支援中的 3.5 Flash-Lite；暫時 HTTP 失敗在備援之後最多額外重試一次（短暫等待），不對 400／404／429 或內容封鎖額外重試。最長仍受每次 25 秒與最多四次外部請求限制，沒有無限重試。Google 新版模型已不建議自訂 temperature，本版移除該參數。

頁面版本與 cache 更新為 V0.04.2；資料庫格式／全部 SQL 和 V0.04.1 逐位元組相同。更新 GitHub 不會自動部署 Supabase Edge Functions。

來源與限制見 `docs/AI_Recovery.md`；完整測試結果見 `docs/SDS34_Audit.md`。

## 以下只供全新環境安裝（已安裝者不要執行初始化）


公開閱讀、唯一編輯者維護的個人政治新聞分析庫。延續 V0.03 的文章標籤首頁、日期雙向排序、搜尋、分析閱讀、上一篇／下一篇及底部編輯入口。

## V0.04.1 修正

依實際盤點補入舊測試表 `public.TblP135_SwapRules`。四張已確認的舊 P135 表在同一筆交易精確清除；保留未知物件、外部依賴與重跑保護。

## 本次採全新安裝

老師已確認舊 P135 資料僅為測試資料，可以捨棄。V0.04.1 提供一份初始化 SQL：清除 P135 原四張測試表，建立五張 RLS 資料表、十一個 INVOKER RPC、精確授權與唯一編輯者設定。原新聞、筆記、人物事蹟不搬移，首頁與私人庫都從空白開始。

不需要操作先前提供的 Staging Kit 或 V0.03 的保留資料 migration。本次改採直接初始化，仍有本地隔離測試與實際環境驗收；不是宣稱已通過正式 Supabase 平台驗證。

## 部署順序

1. 在目前 Supabase 專案的 Authentication → Users 找到**您自己的 User UID**。共用帳號保留，不重新註冊；不是 Email、GitHub username 或 API key。
2. 核對 Data API 的 Exposed Schemas：保留其他專案需要的設定；`p135_data` 不可列入。初始化 SQL 不會修改共用設定；SQL 查到 NULL 不代表已確認。
3. 用文字編輯器開啟 `database/10_P135_FreshInstall.sql`，把唯一的 `v_editor_user_id uuid := NULL;` 改為 `v_editor_user_id uuid := '您的 User UID'::uuid;`。
4. 到正確 Supabase 專案 SQL Editor **執行整個 10 檔**。成功後 list_rpc_exists、publications_table_exists、editor_configured 均為 true。整個檔案是一筆 transaction；錯誤時停止，貼上錯誤訊息，勿分段刪表。新版 schema 已存在時會停止，不能當成日常重設鈕。
5. 更新兩個 Edge Functions：使用 `docs/dashboard-single-file/` 對應的自足 TypeScript 原碼，Verify JWT 兩者均保持 ON。**TypeScript 貼在 Edge Functions 編輯器，不貼 SQL Editor。** 既有 AI_API_KEY 保留；不要提供給 ChatGPT。CLI 使用 `supabase/functions/` 多檔版，二選一。
6. GitHub Pages 使用本版 index.html、editor.html、css、js；保留部署現有的 config.js。ZIP 只提供 config-sample.js，不包含實際設定。
7. 執行 `database/99_P135_HealthCheck.sql`，依 `docs/Deployment.md` 實測訪客、指定編輯者及其他帳號。
8. 登入工作台新增新聞 → 分析 → 儲存草稿 → 勾選公開並儲存。首頁初始沒有文章是預期結果。

**10 已指定唯一編輯者，這次不必再執行 20 檔。**

## 資料與權限

- 私人表與無原文／筆記／UID 的公開快照都在未暴露的 p135_data；public 只提供 P135 RPC。
- 五表 RLS 全開、逐操作政策與最小 grants、十一 RPC 全為 SECURITY INVOKER；anon 只有三個公開讀取 RPC。
- 只有指定的 Auth UID 可編輯；其他登入者仍無 P135 編輯資格。Edge 同樣驗證資格。
- 不更動其他 P 專案、shared Auth 帳號、P130、共用預設權限或全域 schema 設定。清除原四表使用 RESTRICT，外部依賴會停止並回復，沒有 CASCADE。
- 已安裝新版時阻止重跑，避免誤刪未來正式文章。
- 原文僅在私人工作台顯示；公開頁提供來源超連結及分析。事實／觀點分類不等於外部事實查核，立場對調是模擬改寫。

## 檔案

- database：一次性全新安裝、補設定編輯者、逐表權限修復、唯讀健康檢查、緊急暫停公開讀取。
- supabase：兩個 Edge、多檔共用授權與 Verify JWT 設定。
- docs：部署、架構、SDS v3.4、檢查及測試報告、Dashboard 單檔 Edge。
- tests：本地測試與合成資料；不用上傳至 Pages 或執行在 SQL Editor。

完整部署與限制見 `docs/Deployment.md`、`docs/SDS34_Audit.md`。本包不包含真實資料、User UID、AI key 或登入 token。
