# P135 V0.06 私人知識庫

Browser login → Supabase Auth → P135_GetLibraryAccess → owner-only library RPCs → unexposed p135_data.

匿名首頁只顯示登入入口，不發送文章列表、全文或分析請求。每次開頁仍向 Auth 確認使用者，後端以原有 TblP135_Settings.editor_user_id 決定唯一擁有者，不能用「登入成功」代替專案授權。

P135_ListLibraryArticles、P135_GetLibraryNeighbors 與既有 P135_GetArticleDetail 讀取原私人文章表。列表不回全文或筆記；單篇按需讀取。尚未分析、曾為草稿或曾公開的文章都列入同一私人收藏庫。全文用 textContent 顯示，既有分析與事實／觀點區保留。

舊公開 RPC 全部撤銷呼叫權限，快照表本身撤權並移除寬鬆讀取 policy。快照 rows 保留為不可讀歷史資料；新儲存固定 is_published=false，不寫快照。RLS、SECURITY INVOKER、固定 search_path 與明確 grants 保留。

沒有新增公開 bucket、匯出真實資料到 GitHub 或把新聞存到瀏覽器持久儲存。Auth 在本專案 sessionStorage，登出通知其他支援 BroadcastChannel 的分頁。離開頁面／登出／失效清除 DOM，過期非同步回應不能回填；BFCache 返回重新驗證。

靜態 HTML/CSS/JS 仍由公開 GitHub Pages 提供登入外殼，程式碼公開不代表文章公開。正式資料是否已關閉對外存取，必須以執行 30 私人化更新及 Supabase 實際驗收為準。GitHub 更新不能代為修改 Supabase 權限。
