-- 唯讀盤點。先備份，再於 staging 測試 migration。
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_any_data_privilege,
  has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated_any_data_privilege
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('TblP135_Articles','TblP135_Entities','TblP135_EntityEvents');
-- 僅列 UUID 與篇數，讓擁有者自行對照 Authentication > Users；不自動指定帳號。
SELECT user_id,count(*) AS article_count FROM public."TblP135_Articles" GROUP BY user_id ORDER BY article_count DESC;
SELECT current_setting('pgrst.db_schemas',true) AS visible_schema_setting,
 'NULL 不代表未暴露，必須人工核對 Dashboard Exposed Schemas；p135_data 不得列入' AS note;
