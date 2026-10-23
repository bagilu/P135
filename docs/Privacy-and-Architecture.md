# 公開閱讀與唯一編輯者

## 訪客取得的資料

清單 RPC：id、標題、來源媒體、報導日期。畫面標籤僅顯示標題與日期；媒體供搜尋。
閱讀 RPC：上述欄位及來源 URL、中性改寫、立場對調、閱讀感受、情緒分析、事實／觀點分類。
相鄰文章 RPC：前後文章的 id、標題。

三個公開 RPC 均只讀取 `p135_data.TblP135_Publications`。這張表不包含原新聞全文、私人筆記、Auth UID、Email 或人物事蹟，且 schema 不對 Data API 暴露。
公開欄位來自編輯者明確勾選並儲存的內容快照。更改為草稿會在同一筆交易刪除公開快照，原私人文章保留。

## 編輯者資格

Supabase Auth 驗證身分，`TblP135_Settings.editor_user_id` 指定唯一 P135 擁有者。登入不等於編輯權。
本版沒有第一位登入者自動成為管理員、前端寫死 Email、依公開 API key 判定授權或讓訪客自行改權限的流程。
編輯 RPC 與 Edge Functions 均檢查資格；工作台也檢查資格以避免載入私有內容。
P130 處理帳號生命週期，P135 不修改 P130 的資料表、權限或 Auth 觸發器。

## RLS 與 grants

五個應用表全部啟用 RLS。Settings 只有編輯者能讀取自己的授權列；私人三表採 auth.uid() 加 P135 資格的逐操作政策。
公開快照允許 anon/authenticated SQL SELECT，但不暴露 table endpoint；只有指定編輯者可建立／更新／取消快照。
所有業務 RPC SECURITY INVOKER，撤除 PUBLIC EXECUTE，anon 僅取得三個公開讀取函式。Edge Functions 以使用者 token 呼叫 RPC，沒有 service_role key。
原三表保留在未暴露的 p135_legacy，應用角色沒有該 schema 的 USAGE。沒有全域 default privileges 或跨 P 業務物件修改。

## 解讀限制

原新聞全文只在私人工作台呈現。公開頁提供原文超連結與分析，不重製全文。
「事實與觀點」是原文陳述類型分類，不表示已完成外部查證；立場對調是模擬示例。
所有文章內容、標題、錯誤與分析均以 DOM textContent／文字節點呈現，不執行輸入中的 HTML。

## 來源文件

- 本包 `SBI-P-SDS_v3.4.md`：使用者提供的正式規範。
- [Supabase：Securing your API](https://supabase.com/docs/guides/api/securing-your-api)：grants、RLS 與未暴露資料 schema 的界線。
- `docs/*_Test_Results.json`：本機測試證據。實際 Supabase gateway、正式 Exposed Schemas、Auth 設定及 Gemini 可用性仍需部署後驗證。
