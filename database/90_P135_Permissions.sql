-- P135 V0.04.1：僅修復本版五個資料表與十一個 RPC 的精確權限。
-- 必須先完成 10 初始化；不搬 schema、不建立資料表、不更改 RLS。
BEGIN;
REVOKE ALL ON SCHEMA p135_data FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA p135_data TO anon,authenticated;
REVOKE ALL ON p135_data."TblP135_Settings" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(singleton,editor_user_id) ON p135_data."TblP135_Settings" TO authenticated;
REVOKE ALL ON p135_data."TblP135_Articles" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON p135_data."TblP135_Articles" TO authenticated;
REVOKE ALL ON p135_data."TblP135_Entities" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON p135_data."TblP135_Entities" TO authenticated;
REVOKE ALL ON p135_data."TblP135_EntityEvents" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON p135_data."TblP135_EntityEvents" TO authenticated;
REVOKE ALL ON p135_data."TblP135_Publications" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON p135_data."TblP135_Publications" TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON p135_data."TblP135_Publications" TO authenticated;
DO $permissions$
DECLARE r record;sig text;
BEGIN
 FOR r IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('P135_GetEditorStatus','P135_SaveArticle','P135_ListEditorArticles','P135_GetArticleDetail','P135_ListPublicArticles','P135_GetPublicArticle','P135_GetPublicNeighbors','P135_AddEntityEvent','P135_GetEntityDossier','P135_GetArticles','P135_UpsertArticle')
 LOOP
   sig:=format('public.%I(%s)',r.proname,r.args);
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',sig);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',sig);
   IF r.proname IN ('P135_ListPublicArticles','P135_GetPublicArticle','P135_GetPublicNeighbors') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',sig); END IF;
 END LOOP;
END $permissions$;
COMMIT;
