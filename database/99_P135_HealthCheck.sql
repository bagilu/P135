-- 全部唯讀；不模擬 JWT、不更改角色、不呼叫寫入 RPC。
SELECT n.nspname,c.relname,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('p135_data','p135_legacy') AND c.relkind='r' ORDER BY c.relname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='p135_data' ORDER BY tablename,policyname;
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute,p.proacl::text AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND left(p.proname,5)='P135_' ORDER BY p.proname;
SELECT c.relname,r.role_name,has_table_privilege(r.role_name,c.oid,'SELECT') AS can_select,
  has_table_privilege(r.role_name,c.oid,'INSERT') AS can_insert,has_table_privilege(r.role_name,c.oid,'UPDATE') AS can_update,
  has_table_privilege(r.role_name,c.oid,'DELETE') AS can_delete,has_table_privilege(r.role_name,c.oid,'TRUNCATE') AS can_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role_name)
WHERE n.nspname IN ('p135_data','p135_legacy') AND c.relkind='r' ORDER BY c.relname,r.role_name;
SELECT count(*) AS configured_editor_count FROM p135_data."TblP135_Settings";
SELECT (SELECT count(*) FROM p135_data."TblP135_Articles") AS private_articles,
 (SELECT count(*) FROM p135_data."TblP135_Publications") AS public_articles;
SELECT current_setting('pgrst.db_schemas',true) AS visible_exposed_schemas,
 'REVIEW：Dashboard 必須排除 p135_data 與 p135_legacy，並以 anon/authenticated 測試 table endpoint 不存在' AS required_manual_check;
