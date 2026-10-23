# 本機測試（非前端 build）

在 tests 目錄執行 npm install，再執行 npm test。此測試使用 PGlite PostgreSQL WASM、合成 Auth fixture 與模擬外部 HTTP，不使用真實帳號或收費 AI。
瀏覽器測試先執行 npx playwright install chromium，再執行 npm run test:browser。
如使用另外安裝的 Chromium，可設定 P135_CHROMIUM_PATH。browser.cjs 以實際本機 PostgreSQL RPC／RLS 提供資料，只有 Auth 及 AI 外部服務是模擬。

fixture 內的舊 DEFINER RPC 與舊 grants 只用於建立遷移前測試環境，不能當成本版正式 migration。
測試不連正式 Supabase，也不取代正式 gateway／Exposed Schemas／Redirect／模型可用性驗證。
測試輸出會更新 docs 的測試報告；執行之後原交付 SHA256SUMS 會因報告改變而不再相符，屬預期。
tests/scratch 截圖為測試用途，不含真實帳號。部署網站不需要 npm、不需要 tests，也不需要這些依賴。
