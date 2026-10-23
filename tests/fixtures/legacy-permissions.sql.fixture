-- P135 V0.01：依交接 ACL 整理，只操作 P135 的三個表及五個 RPC。
-- 本次更新原網站不需執行。請以 postgres 管理角色審閱／執行。
BEGIN;

REVOKE ALL ON TABLE public."TblP135_Articles", public."TblP135_Entities", public."TblP135_EntityEvents" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public."TblP135_Articles", public."TblP135_Entities", public."TblP135_EntityEvents" TO service_role;

ALTER FUNCTION public."P135_AddEntityEvent"(text, text, date, text, text, text, uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public."P135_AddEntityEvent"(text, text, date, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."P135_AddEntityEvent"(text, text, date, text, text, text, uuid, text) TO authenticated, service_role;

ALTER FUNCTION public."P135_GetArticleDetail"(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public."P135_GetArticleDetail"(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."P135_GetArticleDetail"(uuid) TO authenticated, service_role;

ALTER FUNCTION public."P135_GetArticles"(integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public."P135_GetArticles"(integer, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."P135_GetArticles"(integer, integer) TO authenticated, service_role;

ALTER FUNCTION public."P135_GetEntityDossier"(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public."P135_GetEntityDossier"(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."P135_GetEntityDossier"(uuid) TO authenticated, service_role;

ALTER FUNCTION public."P135_UpsertArticle"(uuid, text, text, text, date, text, text, text, jsonb, jsonb, text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public."P135_UpsertArticle"(uuid, text, text, text, date, text, text, text, jsonb, jsonb, text, text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public."P135_UpsertArticle"(uuid, text, text, text, date, text, text, text, jsonb, jsonb, text, text[]) TO authenticated, service_role;

COMMIT;
