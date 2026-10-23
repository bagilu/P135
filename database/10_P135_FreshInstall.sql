-- P135 V0.04：放棄舊測試資料，直接建立公開閱讀／唯一編輯者資料庫。
-- 依使用者明確指示，只清除 public 的 P135 原三表；不清除 Auth 使用者、不操作其他 P 專案。
-- 只供尚未安裝新版的環境；p135_data／p135_legacy 已存在時會停止，避免重跑刪除新資料。
-- 執行前只修改下方 v_editor_user_id 的 NULL，填入 Authentication > Users 中您自己的 User UID。
-- 核對 Data API：public 提供 RPC；p135_data 不得列入 Exposed Schemas。
BEGIN;
SET LOCAL lock_timeout='5s';
DO $install_guard$
DECLARE
  v_editor_user_id uuid := NULL; -- 必填：改成 '您的 User UID'::uuid
  v_exposed text := current_setting('pgrst.db_schemas',true);
BEGIN
  IF v_editor_user_id IS NULL THEN
    RAISE EXCEPTION '請先把 v_editor_user_id 的 NULL 改成您的 Auth User UID（帶引號並加 ::uuid）';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_editor_user_id) THEN
    RAISE EXCEPTION '指定 UID 不存在於目前 Supabase Auth；已停止，舊資料未清除';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('p135_data','p135_legacy')) THEN
    RAISE EXCEPTION '新版 P135 schema 已存在，禁止重複初始化；請執行 99 HealthCheck，勿刪 schema 重跑';
  END IF;
  IF v_exposed IS NOT NULL AND (ARRAY['p135_data','p135_legacy'] && regexp_split_to_array(v_exposed,'\s*,\s*')) THEN
    RAISE EXCEPTION 'P135 資料 schema 列入 Exposed Schemas，請先核對設定；本程式不改共用 API 設定';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S') AND left(c.relname,8)='TblP135_'
      AND c.relname NOT IN ('TblP135_Articles','TblP135_Entities','TblP135_EntityEvents')) THEN
    RAISE EXCEPTION '發現交接基準以外的 public P135 物件，請先人工盤點；已停止';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND left(p.proname,5)='P135_'
      AND NOT(p.oid=ANY(array_remove(ARRAY[
      to_regprocedure('public."P135_GetEditorStatus"()'),
      to_regprocedure('public."P135_SaveArticle"(jsonb)'),
      to_regprocedure('public."P135_ListEditorArticles"(integer,integer)'),
      to_regprocedure('public."P135_GetArticleDetail"(uuid)'),
      to_regprocedure('public."P135_ListPublicArticles"(integer,integer,boolean,text)'),
      to_regprocedure('public."P135_GetPublicArticle"(uuid)'),
      to_regprocedure('public."P135_GetPublicNeighbors"(uuid,boolean,text)'),
      to_regprocedure('public."P135_AddEntityEvent"(text,text,date,text,text,text,uuid,text)'),
      to_regprocedure('public."P135_GetEntityDossier"(uuid)'),
      to_regprocedure('public."P135_GetArticles"(integer,integer)'),
      to_regprocedure('public."P135_UpsertArticle"(uuid,text,text,text,date,text,text,text,jsonb,jsonb,text,text[])')
      ],NULL)))) THEN
    RAISE EXCEPTION '發現未知 P135 函式或多載，請先人工盤點；已停止';
  END IF;
  PERFORM set_config('p135.install_editor_uid',v_editor_user_id::text,true);
END $install_guard$;

-- 精確列出原三表，使用 RESTRICT：外部 View／外鍵等依賴會令整筆交易回復。
-- 不使用 DROP SCHEMA、CASCADE、TRUNCATE 或跨專案清除。
DROP TABLE IF EXISTS public."TblP135_EntityEvents",public."TblP135_Entities",public."TblP135_Articles" RESTRICT;

CREATE SCHEMA p135_data;
REVOKE ALL ON SCHEMA p135_data FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA p135_data TO anon,authenticated;

CREATE TABLE p135_data."TblP135_Settings" (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  editor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE p135_data."TblP135_Settings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON p135_data."TblP135_Settings" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(singleton,editor_user_id) ON p135_data."TblP135_Settings" TO authenticated;
CREATE POLICY "P135_Settings_owner_read" ON p135_data."TblP135_Settings" FOR SELECT TO authenticated USING(editor_user_id=auth.uid());

INSERT INTO p135_data."TblP135_Settings"(singleton,editor_user_id)
VALUES(true,current_setting('p135.install_editor_uid')::uuid);

CREATE OR REPLACE FUNCTION public."P135_GetEditorStatus"() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
  SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM p135_data."TblP135_Settings" s WHERE s.editor_user_id=auth.uid());
$f$;
REVOKE EXECUTE ON FUNCTION public."P135_GetEditorStatus"() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public."P135_GetEditorStatus"() TO authenticated;


CREATE TABLE p135_data."TblP135_Articles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "source_media" text,
  "source_url" text,
  "published_date" date,
  "original_content" text NOT NULL,
  "neutral_content" text,
  "flipped_content" text,
  "sentiment_data" jsonb DEFAULT '{}'::jsonb,
  "fact_opinion_data" jsonb DEFAULT '{"facts": [], "opinions": []}'::jsonb,
  "personal_notes" text,
  "tags" text[] DEFAULT ARRAY[]::text[],
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  flipped_feeling text,
  CONSTRAINT "TblP135_Articles_pkey" PRIMARY KEY (id),
  CONSTRAINT "TblP135_Articles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE p135_data."TblP135_Articles" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON p135_data."TblP135_Articles" FROM PUBLIC,anon,authenticated,service_role;

GRANT SELECT,INSERT,UPDATE ON p135_data."TblP135_Articles" TO authenticated;

CREATE POLICY "P135_TblP135_Articles_select" ON p135_data."TblP135_Articles" FOR SELECT TO authenticated USING (user_id=auth.uid() AND public."P135_GetEditorStatus"());

CREATE POLICY "P135_TblP135_Articles_insert" ON p135_data."TblP135_Articles" FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND public."P135_GetEditorStatus"());

CREATE POLICY "P135_TblP135_Articles_update" ON p135_data."TblP135_Articles" FOR UPDATE TO authenticated USING (user_id=auth.uid() AND public."P135_GetEditorStatus"()) WITH CHECK (user_id=auth.uid() AND public."P135_GetEditorStatus"());



CREATE TABLE p135_data."TblP135_Entities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "entity_type" text NOT NULL,
  "current_role" text,
  "stance_tags" text[] DEFAULT ARRAY[]::text[],
  "summary_bio" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "TblP135_Entities_pkey" PRIMARY KEY (id),
  CONSTRAINT "TblP135_Entities_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "TblP135_Entities_user_id_name_key" UNIQUE (user_id, name)
);

ALTER TABLE p135_data."TblP135_Entities" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON p135_data."TblP135_Entities" FROM PUBLIC,anon,authenticated,service_role;

GRANT SELECT,INSERT,UPDATE ON p135_data."TblP135_Entities" TO authenticated;

CREATE POLICY "P135_TblP135_Entities_select" ON p135_data."TblP135_Entities" FOR SELECT TO authenticated USING (user_id=auth.uid() AND public."P135_GetEditorStatus"());

CREATE POLICY "P135_TblP135_Entities_insert" ON p135_data."TblP135_Entities" FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND public."P135_GetEditorStatus"());

CREATE POLICY "P135_TblP135_Entities_update" ON p135_data."TblP135_Entities" FOR UPDATE TO authenticated USING (user_id=auth.uid() AND public."P135_GetEditorStatus"()) WITH CHECK (user_id=auth.uid() AND public."P135_GetEditorStatus"());



CREATE TABLE p135_data."TblP135_EntityEvents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "article_id" uuid,
  "event_date" date NOT NULL,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "evidence_quote" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "TblP135_EntityEvents_article_id_fkey" FOREIGN KEY (article_id) REFERENCES p135_data."TblP135_Articles"(id) ON DELETE SET NULL,
  CONSTRAINT "TblP135_EntityEvents_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES p135_data."TblP135_Entities"(id) ON DELETE CASCADE,
  CONSTRAINT "TblP135_EntityEvents_pkey" PRIMARY KEY (id),
  CONSTRAINT "TblP135_EntityEvents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE p135_data."TblP135_EntityEvents" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON p135_data."TblP135_EntityEvents" FROM PUBLIC,anon,authenticated,service_role;

GRANT SELECT,INSERT ON p135_data."TblP135_EntityEvents" TO authenticated;

CREATE POLICY "P135_TblP135_EntityEvents_select" ON p135_data."TblP135_EntityEvents" FOR SELECT TO authenticated USING (user_id=auth.uid() AND public."P135_GetEditorStatus"());

CREATE POLICY "P135_TblP135_EntityEvents_insert" ON p135_data."TblP135_EntityEvents" FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND public."P135_GetEditorStatus"());



CREATE TABLE p135_data."TblP135_Publications" (
  article_id uuid PRIMARY KEY REFERENCES p135_data."TblP135_Articles"(id) ON DELETE CASCADE,
  title text NOT NULL, source_media text,source_url text,published_date date,
  neutral_content text,flipped_content text,flipped_feeling text,
  sentiment_data jsonb NOT NULL DEFAULT '{}',fact_opinion_data jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE p135_data."TblP135_Publications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON p135_data."TblP135_Publications" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON p135_data."TblP135_Publications" TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON p135_data."TblP135_Publications" TO authenticated;
CREATE POLICY "P135_Publications_read" ON p135_data."TblP135_Publications" FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY "P135_Publications_insert" ON p135_data."TblP135_Publications" FOR INSERT TO authenticated WITH CHECK(public."P135_GetEditorStatus"());
CREATE POLICY "P135_Publications_update" ON p135_data."TblP135_Publications" FOR UPDATE TO authenticated USING(public."P135_GetEditorStatus"()) WITH CHECK(public."P135_GetEditorStatus"());
CREATE POLICY "P135_Publications_delete" ON p135_data."TblP135_Publications" FOR DELETE TO authenticated USING(public."P135_GetEditorStatus"());
CREATE INDEX "P135_Publications_date_idx" ON p135_data."TblP135_Publications"(published_date,article_id);
CREATE INDEX "P135_Articles_owner_created_idx" ON p135_data."TblP135_Articles"(user_id,created_at DESC);
CREATE INDEX "P135_Events_entity_date_idx" ON p135_data."TblP135_EntityEvents"(entity_id,event_date DESC);


-- RPC definitions follow in this SAME transaction.
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
  v_publish:=coalesce((p_article->>'is_published')::boolean,false);
  IF length(v_title)=0 OR length(v_title)>1000 OR length(btrim(v_original))=0 OR length(v_original)>100000 THEN RAISE EXCEPTION '請填寫標題與內文（標題最多 1000 字、內文最多 100000 字）'; END IF;
  IF v_url IS NOT NULL AND v_url !~* '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION '原文連結必須是有效的 HTTP 或 HTTPS 網址'; END IF;
  IF v_publish AND (nullif(btrim(p_article->>'neutral_content'),'') IS NULL OR nullif(btrim(p_article->>'flipped_content'),'') IS NULL) THEN RAISE EXCEPTION '公開前請先完成中性改寫與立場對調分析'; END IF;
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
  IF v_publish THEN
    SELECT jsonb_build_object('overall_tone',v_sentiment->'overall_tone','bias_rating',v_sentiment->'bias_rating','loaded_words',coalesce(jsonb_agg(jsonb_build_object('word_or_phrase',w->'word_or_phrase','category',w->'category','explanation',w->'explanation')),'[]'::jsonb))
    INTO v_public_sentiment
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_sentiment->'loaded_words')='array' THEN v_sentiment->'loaded_words' ELSE '[]'::jsonb END) AS x(w);
    INSERT INTO p135_data."TblP135_Publications"(article_id,title,source_media,source_url,published_date,neutral_content,flipped_content,flipped_feeling,sentiment_data,fact_opinion_data)
    SELECT a.id,a.title,a.source_media,a.source_url,a.published_date,a.neutral_content,a.flipped_content,a.flipped_feeling,v_public_sentiment,
      jsonb_build_object('facts',CASE WHEN jsonb_typeof(v_fact->'facts')='array' THEN v_fact->'facts' ELSE '[]'::jsonb END,'opinions',CASE WHEN jsonb_typeof(v_fact->'opinions')='array' THEN v_fact->'opinions' ELSE '[]'::jsonb END)
    FROM p135_data."TblP135_Articles" a WHERE a.id=v_id AND a.user_id=auth.uid()
    ON CONFLICT(article_id) DO UPDATE SET title=EXCLUDED.title,source_media=EXCLUDED.source_media,source_url=EXCLUDED.source_url,published_date=EXCLUDED.published_date,neutral_content=EXCLUDED.neutral_content,flipped_content=EXCLUDED.flipped_content,flipped_feeling=EXCLUDED.flipped_feeling,sentiment_data=EXCLUDED.sentiment_data,fact_opinion_data=EXCLUDED.fact_opinion_data;
  ELSE
    DELETE FROM p135_data."TblP135_Publications" WHERE article_id=v_id;
  END IF;
  RETURN v_id;
END $f$;

CREATE OR REPLACE FUNCTION public."P135_ListEditorArticles"(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,title text,source_media text,published_date date,is_published boolean,updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
  IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 編輯權限'; END IF;
  RETURN QUERY SELECT a.id,a.title,a.source_media,a.published_date,a.is_published,a.updated_at FROM p135_data."TblP135_Articles" a WHERE a.user_id=auth.uid()
    ORDER BY a.published_date DESC NULLS LAST,a.updated_at DESC,a.id LIMIT least(greatest(coalesce(p_limit,100),1),100) OFFSET greatest(coalesce(p_offset,0),0);
END $f$;

CREATE OR REPLACE FUNCTION public."P135_GetArticleDetail"(p_article_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE result jsonb;
BEGIN
  IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 編輯權限'; END IF;
  SELECT jsonb_build_object('id',a.id,'title',a.title,'source_media',a.source_media,'source_url',a.source_url,'published_date',a.published_date,'original_content',a.original_content,'neutral_content',a.neutral_content,'flipped_content',a.flipped_content,'flipped_feeling',a.flipped_feeling,'sentiment_data',a.sentiment_data,'fact_opinion_data',a.fact_opinion_data,'personal_notes',a.personal_notes,'is_published',a.is_published,'updated_at',a.updated_at)
    INTO result FROM p135_data."TblP135_Articles" a WHERE a.id=p_article_id AND a.user_id=auth.uid();
  IF result IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='找不到文章或無讀取權限'; END IF;
  RETURN result;
END $f$;

CREATE OR REPLACE FUNCTION public."P135_ListPublicArticles"(p_limit integer DEFAULT 40,p_offset integer DEFAULT 0,p_ascending boolean DEFAULT false,p_query text DEFAULT '')
RETURNS TABLE(id uuid,title text,source_media text,published_date date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
 SELECT a.article_id,a.title,a.source_media,a.published_date FROM p135_data."TblP135_Publications" a
 WHERE coalesce(p_query,'')='' OR a.title ILIKE '%'||left(p_query,150)||'%' OR coalesce(a.source_media,'') ILIKE '%'||left(p_query,150)||'%'
 ORDER BY CASE WHEN p_ascending THEN a.published_date END ASC NULLS LAST,CASE WHEN NOT p_ascending THEN a.published_date END DESC NULLS LAST,a.article_id
 LIMIT least(greatest(coalesce(p_limit,40),1),100) OFFSET greatest(coalesce(p_offset,0),0);
$f$;

CREATE OR REPLACE FUNCTION public."P135_GetPublicArticle"(p_article_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
 SELECT jsonb_build_object('id',a.article_id,'title',a.title,'source_media',a.source_media,'source_url',a.source_url,'published_date',a.published_date,'neutral_content',a.neutral_content,'flipped_content',a.flipped_content,'flipped_feeling',a.flipped_feeling,'sentiment_data',a.sentiment_data,'fact_opinion_data',a.fact_opinion_data)
 FROM p135_data."TblP135_Publications" a WHERE a.article_id=p_article_id;
$f$;

CREATE OR REPLACE FUNCTION public."P135_GetPublicNeighbors"(p_article_id uuid,p_ascending boolean DEFAULT false,p_query text DEFAULT '') RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
 WITH ordered AS (
   SELECT a.article_id,
     lag(a.article_id) OVER w AS prev_id,lag(a.title) OVER w AS prev_title,
     lead(a.article_id) OVER w AS next_id,lead(a.title) OVER w AS next_title
   FROM p135_data."TblP135_Publications" a
   WHERE coalesce(p_query,'')='' OR a.title ILIKE '%'||left(p_query,150)||'%' OR coalesce(a.source_media,'') ILIKE '%'||left(p_query,150)||'%'
   WINDOW w AS (ORDER BY CASE WHEN p_ascending THEN a.published_date END ASC NULLS LAST,CASE WHEN NOT p_ascending THEN a.published_date END DESC NULLS LAST,a.article_id)
 )
 SELECT jsonb_build_object('previous',CASE WHEN o.prev_id IS NULL THEN NULL ELSE jsonb_build_object('id',o.prev_id,'title',o.prev_title) END,'next',CASE WHEN o.next_id IS NULL THEN NULL ELSE jsonb_build_object('id',o.next_id,'title',o.next_title) END)
 FROM ordered o WHERE o.article_id=p_article_id;
$f$;

CREATE OR REPLACE FUNCTION public."P135_AddEntityEvent"(p_entity_name text,p_entity_type text,p_event_date date,p_event_type text,p_title text,p_description text,p_article_id uuid DEFAULT NULL,p_evidence_quote text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE entity_id uuid;event_id uuid;
BEGIN
 IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 編輯權限'; END IF;
 IF nullif(btrim(p_entity_name),'') IS NULL OR nullif(btrim(p_title),'') IS NULL OR p_entity_type NOT IN ('person','party','organization') OR p_event_type NOT IN ('negative','positive','controversy') THEN RAISE EXCEPTION '事蹟欄位無效'; END IF;
 IF p_article_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM p135_data."TblP135_Articles" a WHERE a.id=p_article_id AND a.user_id=auth.uid()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='無權連結該文章'; END IF;
 INSERT INTO p135_data."TblP135_Entities"(user_id,name,entity_type) VALUES(auth.uid(),btrim(p_entity_name),p_entity_type)
 ON CONFLICT(user_id,name) DO UPDATE SET updated_at=clock_timestamp() RETURNING id INTO entity_id;
 INSERT INTO p135_data."TblP135_EntityEvents"(user_id,entity_id,article_id,event_date,event_type,title,description,evidence_quote)
 VALUES(auth.uid(),entity_id,p_article_id,coalesce(p_event_date,CURRENT_DATE),p_event_type,p_title,coalesce(p_description,p_title),p_evidence_quote) RETURNING id INTO event_id;
 RETURN event_id;
END $f$;

CREATE OR REPLACE FUNCTION public."P135_GetEntityDossier"(p_entity_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE result jsonb;
BEGIN
 IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 編輯權限'; END IF;
 SELECT jsonb_build_object('entity',jsonb_build_object('id',e.id,'name',e.name,'entity_type',e.entity_type,'current_role',e.current_role,'stance_tags',e.stance_tags,'summary_bio',e.summary_bio),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',ev.id,'article_id',ev.article_id,'event_date',ev.event_date,'event_type',ev.event_type,'title',ev.title,'description',ev.description,'evidence_quote',ev.evidence_quote) ORDER BY ev.event_date DESC,ev.id) FROM p135_data."TblP135_EntityEvents" ev WHERE ev.entity_id=e.id AND ev.user_id=auth.uid()),'[]'::jsonb))
 INTO result FROM p135_data."TblP135_Entities" e WHERE e.id=p_entity_id AND e.user_id=auth.uid();
 RETURN result;
END $f$;

-- 相容舊版 P135 RPC 名稱，仍限制為唯一編輯者並採 INVOKER。
CREATE OR REPLACE FUNCTION public."P135_GetArticles"(p_limit integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,title text,source_media text,published_date date,tags text[],created_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 IF NOT public."P135_GetEditorStatus"() THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='此帳號沒有 P135 編輯權限'; END IF;
 RETURN QUERY SELECT a.id,a.title,a.source_media,a.published_date,a.tags,a.created_at FROM p135_data."TblP135_Articles" a WHERE a.user_id=auth.uid() ORDER BY a.created_at DESC,a.id LIMIT least(greatest(coalesce(p_limit,20),1),100) OFFSET greatest(coalesce(p_offset,0),0);
END $f$;

CREATE OR REPLACE FUNCTION public."P135_UpsertArticle"(p_article_id uuid DEFAULT NULL,p_title text DEFAULT '',p_source_media text DEFAULT NULL,p_source_url text DEFAULT NULL,p_published_date date DEFAULT CURRENT_DATE,p_original_content text DEFAULT '',p_neutral_content text DEFAULT NULL,p_flipped_content text DEFAULT NULL,p_sentiment_data jsonb DEFAULT '{}',p_fact_opinion_data jsonb DEFAULT '{"facts":[],"opinions":[]}',p_personal_notes text DEFAULT NULL,p_tags text[] DEFAULT ARRAY[]::text[]) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE result uuid;
BEGIN
 result:=public."P135_SaveArticle"(jsonb_build_object('id',p_article_id,'title',p_title,'source_media',p_source_media,'source_url',p_source_url,'published_date',p_published_date,'original_content',p_original_content,'neutral_content',p_neutral_content,'flipped_content',p_flipped_content,'sentiment_data',p_sentiment_data,'fact_opinion_data',p_fact_opinion_data,'personal_notes',p_personal_notes,'is_published',false));
 UPDATE p135_data."TblP135_Articles" SET tags=coalesce(p_tags,ARRAY[]::text[]) WHERE id=result AND user_id=auth.uid();
 RETURN result;
END $f$;

-- 對明確列出的 P135 API 撤除預設 EXECUTE，再逐類授權；不改 shared defaults。
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

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT 'V0.04 初始化完成；舊測試資料已清除，新文章庫為空' AS installation_status,
  to_regprocedure('public."P135_ListPublicArticles"(integer,integer,boolean,text)') IS NOT NULL AS list_rpc_exists,
  to_regclass('p135_data."TblP135_Publications"') IS NOT NULL AS publications_table_exists,
  EXISTS(SELECT 1 FROM p135_data."TblP135_Settings") AS editor_configured;
