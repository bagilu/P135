# AI 呼叫修復：V0.04.2

## 實際證據

使用者提供的同次呼叫紀錄為：gemini-3.8-flash HTTP 503、gemini-2.5-flash HTTP 404、gemini-3.5-flash HTTP 503。V0.04.1 最後把這組上游 HTTP 失敗回成 502／「未回傳有效分析」，造成錯誤原因不清楚。這組證據沒有顯示 JSON 驗證失敗或 25 秒逾時。

## 本次處理

- 保留 3.8 Flash 為主，加入 3.5 Flash-Lite 作為不同能力／速度取向的備援；不保證個別帳戶的可用性或同等品質。
- 移除預設 2.5：本帳戶呼叫回 404，不等於宣稱 Google 全面停止該模型。舊 3.5 Flash 已由 Google 列為 deprecated／轉向 3.6，不再作為預設。
- 配置 AI_MODELS 時依其順序、去除 models/ 前綴及重複、最多三個 Gemini 模型；無效設定會在外部呼叫前拒絕。
- 每個候選先嘗試一次；僅對 HTTP 500／502／503／504 的候選，在全部候選失敗後等待約 0.8–1.2 秒額外重試一次。預設最多三次請求，自訂三模型最多四次；不做無限重試。
- 400／404／429、驗證不符不作額外重試；HTTP 401／403 直接回設定／使用權限訊息；內容封鎖直接停止，不切模型探測或放寬安全門檻。
- 區分 HTTP 暫時不可用、404 模型設定、429 配額、逾時、網路、空文字、MAX_TOKENS、無效 JSON／欄位；不因最後一次 404 而掩蓋先前 503。
- 成功回應仍為原四項分析格式，繼續嚴格驗證與欄位白名單；略過 API 明確標記的 thought parts，不把推理文字當成分析 JSON。
- 移除 temperature 設定以符合官方對新版模型的參數建議。新聞、API key、token 及上游錯誤本文均不進診斷訊息。

## 官方依據（2026-10-23 查閱）

- [Google Gemini 故障排除](https://ai.google.dev/gemini-api/docs/troubleshooting)：針對暫時性錯誤採有限重試與等待，避免重試無效參數／權限錯誤；新版模型 temperature 注意事項。
- [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)：穩定模型代碼、文字輸出與結構化輸出支援。
- [Gemini 模型清單](https://ai.google.dev/gemini-api/docs/models)：2.5 系列存取限制，不等同全面停用。
- [舊 Gemini 3.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash)：deprecated 與自動路由說明。

## 驗證限制

本地以合成資料及模擬 Gemini HTTP 重現原失敗序列，測試受控備援／重試、狀態分類、權限與診斷隱私；沒有使用老師的金鑰或呼叫付費 API。正式函式必須重新部署，並在老師的帳戶驗證模型實際可用。資料庫 SQL 與擷取函式和 V0.04.1 相同，不應再次初始化。
