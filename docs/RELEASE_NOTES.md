# V0.06

改為指定帳號專用的私人新聞知識庫。登入後閱讀所有收藏，單篇首先顯示已保存新聞全文，再顯示原有四項分析。保留彩色標籤、分批載入與綠色／紅色事實觀點區，移除公開操作。

**既有環境必須執行 database/30_P135_PrivateLibrary.sql 才會真正關閉後端公開入口。不要執行 10 初始化。** 更新保留文章、筆記、UID 與歷史快照；舊快照及公開 RPC 全部撤權。Edge 與 Secrets 無需變更。

本地驗證結果見 Database／UI／Pagination／Browser_Test_Results.json。Edge_Test_Results.json 為前版保留證據，未重算。
