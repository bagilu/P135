# P135 V0.06 驗證

在 tests 執行 npm install。`npm test` 包含 database.cjs、edge.cjs、ui.cjs 與 pagination.cjs；`npm run test:browser` 需 Chromium，或指定 P135_CHROMIUM_PATH。

本次私人化測試：database 19、ui 13、pagination 8，browser 17，合計 57 項。資料庫測試先從 v0051-install.sql.fixture 建立可公開讀取的合成舊庫，再執行 30 私人化並驗證拒絕與資料保留；browser 使用當版全新安裝、本地 PostgreSQL/RLS/RPC 及合成 Auth／AI。

包含匿名／其他帳號拒絕、原文與筆記保留、舊公開路徑拒絕、100→200→243、全文純文字、登入／登出／失效、延遲回應不回填、同分頁進入編輯工作台、跨分頁登出與 BFCache 生命週期。SDK 將 session 指向 sessionStorage 的設定另由 UI VM 驗證。

Edge 程式碼未修改，其既有報告保留而未重新計入本次測試數。所有測試使用假資料，沒有連線正式 Supabase 或呼叫付費 AI。fixtures 不能部署；tests/scratch 的內部截圖不納入 ZIP/GitHub。
