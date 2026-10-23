# P135 V0.06 — SDS v3.4 私人化檢查

本次 57 項本機檢查通過、0 項失敗：資料庫 19、UI 13、分批載入 8、Chromium 17。

本次為保留資料的私人模式更新。所有 SQL 均只操作 P135 物件，不搬 schema、不刪原資料、不更動 shared Auth 或其他 P 專案。

| 檢查 | 結果 | 證據與限制 |
|---|---|---|
| PRIVATE-01 | PASS | Actual local PostgreSQL upgrade preserves all articles, originals, notes, timestamps, historical snapshots and configured UID. |
| PRIVATE-02 | PASS | Old anonymous/authenticated public paths and snapshot direct reads denied; all reading requires the existing designated owner. |
| PRIVATE-03 | PASS | RLS remains on; all project functions SECURITY INVOKER; no shared defaults, Auth changes or cross-project writes. |
| PRIVATE-04 | PASS | List returns metadata only. Detail uses existing owner-only RPC; originals rendered with textContent, not HTML. |
| PRIVATE-05 | PASS | Pending auth/list/detail responses cannot refill data after logout; DOM cleared on sign-out, expiry and pagehide; pageshow revalidates. |
| PRIVATE-06 | PASS | New save ignores publication request. New permissions repair and fresh installation finish in private mode. |
| DEPLOY-01 | REVIEW | Formal Supabase has not been modified. User must execute 30 migration and confirm four true results before the backend is private. |
| DEPLOY-02 | REVIEW | Existing deployment config.js remains untouched in GitHub. ZIP has config-sample.js only; p135_data must remain excluded from exposed schemas. |

測試總數以四份當版 Results.json 為準；原 Edge 報告保留為前版證據，不重算。正式 Supabase 的 SQL 尚未執行，不能將本地通過或 GitHub 部署說成已完成後端關閉。
