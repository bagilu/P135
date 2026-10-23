# P135 V0.05 測試

在 tests 目錄 npm install。

本次前端變更：執行 `node ui.cjs`（17 項）、`node pagination.cjs`（8 項）及 `npm run test:browser`（12 項），共 37 項。瀏覽器需先 `npx playwright install chromium`，或設定 P135_CHROMIUM_PATH 指向 Chromium。

browser.cjs 使用本版原有 SQL 在隔離 PGlite PostgreSQL 建立 243 篇合成文章，實測 100 → 200 → 243 捲動載入、等高不同寬標籤、五種底色、日期色塊、頁首高度、390px 手機版及既有編輯／閱讀權限流程；Auth 與外部 AI 模擬。pagination.cjs 使用受控 observer／RPC，涵蓋同時請求、網路失敗、接續重試、搜尋競態與終止條件。

`npm test` 額外包括原資料庫及 Edge 測試。此次 SQL／Edge 沒有改動，因此保留舊版 DB／Edge 報告，沒有重跑或計入上述 37 項。

所有測試不連遠端 Supabase、不使用真實資料或付費 AI。fixtures 僅為隔離測試起點，不能部署。tests/scratch 為內部檢查，不包含於 ZIP 或 GitHub。測試會更新 docs 結果，校驗碼需重新生成。
