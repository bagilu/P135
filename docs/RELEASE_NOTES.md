# V0.04.1

修正舊庫含 TblP135_SwapRules 時無法初始化。請改用本版完整 10_P135_FreshInstall.sql，重新填入自己的 Auth UID。新增清除範圍僅此一張已確認的 P135 舊測試表；保留 RESTRICT、同筆交易與防重跑。若先前停於未知物件檢查，尚未建立新版 schema，可執行修正版。兩個 Edge 的程式碼與 V0.04 相同。
