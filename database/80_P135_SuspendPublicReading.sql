-- P135 V0.06：只關閉舊公開入口，不刪資料。完整版私人化請執行 30 檔。
BEGIN;
REVOKE ALL ON SCHEMA p135_data FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA p135_data TO authenticated;
REVOKE ALL ON p135_data."TblP135_Settings" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(singleton,editor_user_id) ON p135_data."TblP135_Settings" TO authenticated;
REVOKE ALL ON p135_data."TblP135_Articles" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON p135_data."TblP135_Articles" TO authenticated;
REVOKE ALL ON p135_data."TblP135_Entities" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON p135_data."TblP135_Entities" TO authenticated;
REVOKE ALL ON p135_data."TblP135_EntityEvents" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON p135_data."TblP135_EntityEvents" TO authenticated;
-- Retain former snapshots as inaccessible historical data, never expose or republish them.
REVOKE ALL ON p135_data."TblP135_Publications" FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE p135_data."TblP135_Publications" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "P135_Publications_read" ON p135_data."TblP135_Publications";
DROP POLICY IF EXISTS "P135_Publications_locked" ON p135_data."TblP135_Publications";
CREATE POLICY "P135_Publications_locked" ON p135_data."TblP135_Publications" FOR SELECT TO authenticated USING(false);
DO $permissions$
DECLARE r record;sig text;
BEGIN
 FOR r IN SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('P135_GetEditorStatus','P135_SaveArticle','P135_ListEditorArticles','P135_GetArticleDetail','P135_ListPublicArticles','P135_GetPublicArticle','P135_GetPublicNeighbors','P135_AddEntityEvent','P135_GetEntityDossier','P135_GetArticles','P135_UpsertArticle','P135_GetLibraryAccess','P135_ListLibraryArticles','P135_GetLibraryNeighbors')
 LOOP
  sig:=format('public.%I(%s)',r.proname,r.args);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',sig);
  IF r.proname NOT IN ('P135_ListPublicArticles','P135_GetPublicArticle','P135_GetPublicNeighbors') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',sig);
  END IF;
 END LOOP;
END $permissions$;
NOTIFY pgrst, 'reload schema';
COMMIT;
