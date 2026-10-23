# Changelog

## V0.04

- 依使用者確認，放棄 P135 舊測試資料，改以單一 FreshInstall SQL 建立新庫、RPC、RLS 與唯一編輯者。
- UID 先驗證，刪除使用精確 RESTRICT；新版 schema 存在時禁止重跑。其他 P 專案與 Auth 帳號不操作。
- 延續 V0.03 的公開首頁、分析閱讀與私人編輯功能，版本與 cache busting 同步更新。
- 移除部署目錄中的舊版重複後端及未使用編輯程式，保留既有部署 config.js。

## V0.03

公開文章庫首頁、日期排序、前後篇、草稿／公開、唯一編輯者與 INVOKER RPC。
