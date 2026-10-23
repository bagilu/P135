# 本機測試

在 tests 目錄執行 npm install，再執行 npm test。瀏覽器測試執行 npx playwright install chromium 後執行 npm run test:browser；也可設定 P135_CHROMIUM_PATH 指向已安裝 Chromium。

本版：database 27、edge 12、ui 17、browser 12，合計 68。使用隔離 PGlite PostgreSQL、合成 Auth UID 與模擬外部 HTTP；不是正式 Supabase 部署驗收。

資料庫測試覆蓋直接全新安裝、原表捨棄、失敗回復、外部依賴、其他專案不受影響、重跑保護、公開／私有 API 與 RLS。browser.cjs 以實際本地資料庫執行本版 FreshInstall，再用 RPC／RLS 供應網頁資料。

fixtures 的舊 DEFINER、三表與 grants 只是舊版測試起點，不能當成正式安裝檔。所有執行均不連遠端 Supabase、不使用真實帳號或收費 AI。tests/scratch 截圖為內部測試，不包含於交付 ZIP 或 GitHub。

執行測試會更新 docs 測試結果，與原 SHA256SUMS 不同屬預期。前端部署不需要 npm 或 tests。
