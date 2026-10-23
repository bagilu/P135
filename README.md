# P135 翻轉新聞 FlipNews — V0.01

本次是版本號與快取參數更新，沿用原 V0.0004 的功能、Gemini 分析、資料結構與登入流程。
來源：bagilu/P135 的 main，提交 5fc4448465c5c5cdfdf3a19b5a8d8657b53d8c92。

## 本次部署到原 GitHub Pages

1. 解壓縮 ZIP，進入 P135_FlipNews_V0.01 資料夾。
2. 將下列五個網頁檔案覆蓋到原 P135 儲存庫，保留 css、js 資料夾結構：
   - index.html
   - config.js
   - css/style.css
   - js/supabase-client.js
   - js/app.js
3. index.html 應直接位於原儲存庫根目錄，不要再多包一層 P135_FlipNews_V0.01。
4. 等待 GitHub Pages 部署完成，重新整理；必要時按 Ctrl+F5。右上應顯示 V0.01。
5. 登入後測試新聞擷取、四項 AI 分析、儲存及從歷史文章庫重新載入。

**本次版本測試不必執行 SQL、不必重新部署 Edge Functions，也不必修改 Verify JWT。**
部署至原 P135 網址，以沿用原登入環境與資料。

## 設定檔

- config.js 保留原專案已公開的 Supabase URL 與 anon key，供原環境直接測試。
- config.sample.js 是正式設定範本，填入公開連線資訊後可另存為 config.js。
- 不要把 config.sample.js 的佔位文字覆蓋到實際部署用 config.js。
- 沒有包含 AI_API_KEY、service_role key、JWT secret 或登入 Token。

## 後端交接參考

- backend/supabase/functions/P135-analyze-news/index.ts：使用者提供的 AI 分析程式。
- backend/supabase/functions/P135-scrape-news/index.ts：使用者提供的新聞擷取程式。
- backend/supabase/config.toml：兩個函式的 verify_jwt 均為 true，依使用者確認的設定記錄。
- backend/sql/database-definition.json：交接的三個資料表定義快照。
- backend/sql/01_schema_reference.sql：依快照重建的建表及 Policy SQL，僅供全新環境參考。
- backend/sql/02_rpc_reference.sql：五個 RPC 的交接程式。
- backend/sql/03_permissions_reference.sql：依交接 ACL 重建的權限 SQL，僅供全新環境參考。

後端來源是本次對話提供的交接內容，並非透過 Supabase API 重新下載。
SQL 參考檔若用於全新環境，順序為 01、02、03；必須由管理者先審閱，並準備既有 Supabase Auth 環境。
不要在已經運作的專案重新執行建表檔。後端參考檔不必上傳至 GitHub Pages。
AI_API_KEY 仍由 Supabase Secrets 管理，須由環境自行設定。本包不包含資料備份或帳號設定匯出。

## 已知待修項目（本版保留原行為）

- 抓取新新聞時未清空舊分析及筆記。
- 心理感受分析 reading_feeling 尚未持久化。
- 動態文字以 innerHTML 顯示，尚待處理內容注入風險。
- 事蹟連結文章尚未驗證兩者擁有者一致。
- 登入使用 prompt，帳號維護尚未整合 P130。
- Gemini 候選模型、重試及回應結構驗證待另次維護。

## 驗證範圍

完成網頁檔案與來源比對、版本與快取參數一致性、JavaScript 語法、HTML 靜態引用及 ZIP 完整性檢查。
未執行真實登入、新聞擷取、付費 AI 呼叫、資料庫寫入或新環境 SQL 還原測試。
V0.0004 的最近使用成功狀態由使用者回報；V0.01 請依前述步驟部署驗證。
