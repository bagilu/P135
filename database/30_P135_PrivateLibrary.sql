-- P135 V0.06：保留資料改為單人私人知識庫。整份執行，可安全重跑。
-- 不需再填 UID，不刪表／文章，不移動 schema，不改其他專案或共用 Auth。
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
 IF to_regclass('p135_data."TblP135_Articles"') IS NULL OR to_regclass('p135_data."TblP135_Settings"') IS NULL THEN
  RAISE EXCEPTION '未找到既有 P135 資料庫；已停止，沒有刪除資料';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM p135_data."TblP135_Settings" s JOIN auth.users u ON u.id=s.editor_user_id) THEN
  RAISE EXCEPTION '請先確認 P135 唯一擁有者帳號；本更新不猜測或變更 UID';
 END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public."P135_SaveArticle"(p_article jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE
  v_id uuid; v_title text; v_original text; v_url text;
  v_publish boolean; v_sentiment jsonb; v_fact jsonb; v_public_sentiment jsonb;
BEGIN
  IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 編輯權限'; END IF;
  IF jsonb_typeof(p_article) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '文章格式必須是 JSON object'; END IF;
  v_title:=btrim(coalesce(p_article->>'title',''));
  v_original:=coalesce(p_article->>'original_content','');
  v_url:=nullif(btrim(p_article->>'source_url'),'');
  v_publish:=false; -- Private mode ignores any caller request to publish.
  IF length(v_title)=0 OR length(v_title)>1000 OR length(btrim(v_original))=0 OR length(v_original)>100000 THEN RAISE EXCEPTION '請填寫標題與內文（標題最多 1000 字、內文最多 100000 字）'; END IF;
  IF v_url IS NOT NULL AND v_url !~* '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION '原文連結必須是有效的 HTTP 或 HTTPS 網址'; END IF;
  v_sentiment:=CASE WHEN jsonb_typeof(p_article->'sentiment_data')='object' THEN p_article->'sentiment_data' ELSE '{}'::jsonb END;
  v_fact:=CASE WHEN jsonb_typeof(p_article->'fact_opinion_data')='object' THEN p_article->'fact_opinion_data' ELSE '{}'::jsonb END;
  v_id:=nullif(p_article->>'id','')::uuid;
  IF v_id IS NULL THEN
    INSERT INTO p135_data."TblP135_Articles"(user_id,title,source_media,source_url,published_date,original_content,neutral_content,flipped_content,flipped_feeling,sentiment_data,fact_opinion_data,personal_notes,tags,is_published)
    VALUES(auth.uid(),v_title,p_article->>'source_media',v_url,nullif(p_article->>'published_date','')::date,v_original,p_article->>'neutral_content',p_article->>'flipped_content',p_article->>'flipped_feeling',v_sentiment,v_fact,p_article->>'personal_notes',ARRAY[]::text[],v_publish)
    RETURNING id INTO v_id;
  ELSE
    UPDATE p135_data."TblP135_Articles" SET title=v_title,source_media=p_article->>'source_media',source_url=v_url,published_date=nullif(p_article->>'published_date','')::date,
      original_content=v_original,neutral_content=p_article->>'neutral_content',flipped_content=p_article->>'flipped_content',flipped_feeling=p_article->>'flipped_feeling',
      sentiment_data=v_sentiment,fact_opinion_data=v_fact,personal_notes=p_article->>'personal_notes',is_published=v_publish,updated_at=clock_timestamp()
    WHERE id=v_id AND user_id=auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='找不到文章或無修改權限'; END IF;
  END IF;
  RETURN v_id;
END $f$;

CREATE OR REPLACE FUNCTION public."P135_GetLibraryAccess"() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
 SELECT public."P135_GetEditorStatus"();
$f$;

CREATE OR REPLACE FUNCTION public."P135_ListLibraryArticles"(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0,p_ascending boolean DEFAULT false,p_query text DEFAULT '')
RETURNS TABLE(id uuid,title text,source_media text,published_date date)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 私人知識庫權限'; END IF;
 RETURN QUERY SELECT a.id,a.title,a.source_media,a.published_date FROM p135_data."TblP135_Articles" a
 WHERE a.user_id=auth.uid() AND (coalesce(p_query,'')='' OR a.title ILIKE '%'||left(p_query,150)||'%' OR coalesce(a.source_media,'') ILIKE '%'||left(p_query,150)||'%')
 ORDER BY CASE WHEN p_ascending THEN a.published_date END ASC NULLS LAST,CASE WHEN NOT p_ascending THEN a.published_date END DESC NULLS LAST,a.id
 LIMIT least(greatest(coalesce(p_limit,100),1),100) OFFSET greatest(coalesce(p_offset,0),0);
END $f$;

CREATE OR REPLACE FUNCTION public."P135_GetLibraryNeighbors"(p_article_id uuid,p_ascending boolean DEFAULT false,p_query text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE result jsonb;
BEGIN
 IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 私人知識庫權限'; END IF;
 WITH ordered AS (
  SELECT a.id,
   lag(a.id) OVER w AS prev_id,lag(a.title) OVER w AS prev_title,
   lead(a.id) OVER w AS next_id,lead(a.title) OVER w AS next_title
  FROM p135_data."TblP135_Articles" a
  WHERE a.user_id=auth.uid() AND (coalesce(p_query,'')='' OR a.title ILIKE '%'||left(p_query,150)||'%' OR coalesce(a.source_media,'') ILIKE '%'||left(p_query,150)||'%')
  WINDOW w AS (ORDER BY CASE WHEN p_ascending THEN a.published_date END ASC NULLS LAST,CASE WHEN NOT p_ascending THEN a.published_date END DESC NULLS LAST,a.id)
 )
 SELECT jsonb_build_object('previous',CASE WHEN o.prev_id IS NULL THEN NULL ELSE jsonb_build_object('id',o.prev_id,'title',o.prev_title) END,'next',CASE WHEN o.next_id IS NULL THEN NULL ELSE jsonb_build_object('id',o.next_id,'title',o.next_title) END)
 INTO result FROM ordered o WHERE o.id=p_article_id;
 RETURN result;
END $f$;

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
SELECT
 to_regprocedure('public."P135_ListLibraryArticles"(integer,integer,boolean,text)') IS NOT NULL AS private_library_installed,
 NOT has_function_privilege('anon','public."P135_ListPublicArticles"(integer,integer,boolean,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public."P135_GetPublicArticle"(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public."P135_GetPublicNeighbors"(uuid,boolean,text)','EXECUTE')
  AND NOT has_schema_privilege('anon','p135_data','USAGE') AS anonymous_reading_disabled,
 NOT has_function_privilege('authenticated','public."P135_ListPublicArticles"(integer,integer,boolean,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public."P135_GetPublicArticle"(uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public."P135_GetPublicNeighbors"(uuid,boolean,text)','EXECUTE')
  AND NOT has_table_privilege('authenticated','p135_data."TblP135_Publications"','SELECT') AS former_public_paths_disabled,
 EXISTS(SELECT 1 FROM p135_data."TblP135_Settings" s JOIN auth.users u ON u.id=s.editor_user_id) AS editor_configured,
 (SELECT count(*) FROM p135_data."TblP135_Articles") AS saved_article_count;
