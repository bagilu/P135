# V0.06 私人知識庫部署

## 已正常運作的 V0.05.1 網站

1. 到原 Supabase 專案 → SQL Editor，執行完整 `database/30_P135_PrivateLibrary.sql`。不需再填 UID。只執行 30，不執行 10。
2. 結果四個 boolean 欄位全部為 true：private_library_installed、anonymous_reading_disabled、former_public_paths_disabled、editor_configured。saved_article_count 顯示原有文章數。
3. GitHub 使用本版前端並保留 config.js；不要改 Secrets 或重新部署 Edge。
4. 無痕視窗開啟首頁與舊文章連結，應只出現登入頁。使用已指定的擁有者 Email／密碼登入，才會看見所有收藏與全文。其他帳號不可讀取。
5. 新增文章可直接私人儲存，無須先分析，不再提供公開勾選框。閱讀頁顯示保存原文與分析；HTML 原樣作為文字，不執行。
6. 按登出後全文、分析及標題應立即清除；重新整理與重開舊文章連結仍需登入。可執行 99 唯讀檢查。

只更新 GitHub 會先顯示登入入口，但不會自動撤銷正式 Supabase 的舊公開 API。必須完成第 1 步。新版前端在無法確認 P135_GetLibraryAccess 時保持鎖定，不回退舊公開讀取。

## 資料保留與回復

30 是同一筆 transaction，保留既有資料與 UID，可重跑，不 drop 表或搬 schema。正式 SQL 若失敗，停止後貼回錯誤；不要改成舊初始化或舊權限修復檔。90 是私人模式，不會恢復公開。

本次沒有自動提供重新公開的腳本。要恢復公開必須另行設計並明確授權，避免歷史快照或全文意外再次公開。

## 全新環境

只有從未建立 p135_data 者才使用 10，填入已存在的 Auth User UID。10 在同一交易的最終狀態啟用 V0.06 私人權限。維持 p135_data 未暴露，依原部署方式建立 Edge 與 config.js。
