-- 可選：緊急暫停公開 RPC。只撤除 P135 三個公開讀取 RPC 的呼叫權限，不刪資料。
-- 訪客頁會顯示無法載入；編輯 RPC 不受影響。恢復時執行 90 檔。
BEGIN;
REVOKE EXECUTE ON FUNCTION public."P135_ListPublicArticles"(integer,integer,boolean,text) FROM anon,authenticated;
REVOKE EXECUTE ON FUNCTION public."P135_GetPublicArticle"(uuid) FROM anon,authenticated;
REVOKE EXECUTE ON FUNCTION public."P135_GetPublicNeighbors"(uuid,boolean,text) FROM anon,authenticated;
COMMIT;
