-- P135 V0.01：依使用者交接的五個 RPC 定義整理，保留原行為。
-- 本次更新原網站不需執行。全新環境參考順序為 01、02、03。
-- 請以 postgres 管理角色執行；尚未做新環境還原測試。
BEGIN;

CREATE OR REPLACE FUNCTION public."P135_AddEntityEvent"(p_entity_name text, p_entity_type text, p_event_date date, p_event_type text, p_title text, p_description text, p_article_id uuid DEFAULT NULL::uuid, p_evidence_quote text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id UUID;
    v_entity_id UUID;
    v_event_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '未經認證的請求 (Unauthorized)';
    END IF;

    -- 自動建立或取得實體 ID
    INSERT INTO public."TblP135_Entities" (user_id, name, entity_type)
    VALUES (v_user_id, p_entity_name, p_entity_type)
    ON CONFLICT (user_id, name) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_entity_id;

    -- 新增事蹟
    INSERT INTO public."TblP135_EntityEvents" (
        user_id, entity_id, article_id, event_date, event_type, title, description, evidence_quote
    ) VALUES (
        v_user_id, v_entity_id, p_article_id, p_event_date, p_event_type, p_title, p_description, p_evidence_quote
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public."P135_GetArticleDetail"(p_article_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT to_jsonb(a)
    INTO v_result
    FROM public."TblP135_Articles" a
    WHERE a.id = p_article_id AND a.user_id = auth.uid();

    IF v_result IS NULL THEN
        RAISE EXCEPTION '找不到該文章或無讀取權限';
    END IF;

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public."P135_GetArticles"(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, source_media text, published_date date, tags text[], created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    RETURN QUERY
    SELECT a.id, a.title, a.source_media, a.published_date, a.tags, a.created_at
    FROM public."TblP135_Articles" a
    WHERE a.user_id = auth.uid()
    ORDER BY a.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public."P135_GetEntityDossier"(p_entity_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'entity', to_jsonb(e),
        'events', COALESCE(jsonb_agg(to_jsonb(ev) ORDER BY ev.event_date DESC), '[]'::jsonb)
    )
    INTO v_result
    FROM public."TblP135_Entities" e
    LEFT JOIN public."TblP135_EntityEvents" ev ON ev.entity_id = e.id
    WHERE e.id = p_entity_id AND e.user_id = auth.uid()
    GROUP BY e.id;

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public."P135_UpsertArticle"(p_article_id uuid DEFAULT NULL::uuid, p_title text DEFAULT ''::text, p_source_media text DEFAULT NULL::text, p_source_url text DEFAULT NULL::text, p_published_date date DEFAULT CURRENT_DATE, p_original_content text DEFAULT ''::text, p_neutral_content text DEFAULT NULL::text, p_flipped_content text DEFAULT NULL::text, p_sentiment_data jsonb DEFAULT '{}'::jsonb, p_fact_opinion_data jsonb DEFAULT '{"facts": [], "opinions": []}'::jsonb, p_personal_notes text DEFAULT NULL::text, p_tags text[] DEFAULT ARRAY[]::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user_id UUID;
    v_ret_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '未經認證的請求 (Unauthorized)';
    END IF;

    IF p_article_id IS NULL THEN
        INSERT INTO public."TblP135_Articles" (
            user_id, title, source_media, source_url, published_date,
            original_content, neutral_content, flipped_content,
            sentiment_data, fact_opinion_data, personal_notes, tags
        ) VALUES (
            v_user_id, p_title, p_source_media, p_source_url, p_published_date,
            p_original_content, p_neutral_content, p_flipped_content,
            p_sentiment_data, p_fact_opinion_data, p_personal_notes, p_tags
        ) RETURNING id INTO v_ret_id;
    ELSE
        UPDATE public."TblP135_Articles"
        SET
            title = p_title,
            source_media = p_source_media,
            source_url = p_source_url,
            published_date = p_published_date,
            original_content = p_original_content,
            neutral_content = p_neutral_content,
            flipped_content = p_flipped_content,
            sentiment_data = p_sentiment_data,
            fact_opinion_data = p_fact_opinion_data,
            personal_notes = p_personal_notes,
            tags = p_tags,
            updated_at = now()
        WHERE id = p_article_id AND user_id = v_user_id
        RETURNING id INTO v_ret_id;

        IF v_ret_id IS NULL THEN
            RAISE EXCEPTION '找不到該文章或無權限修改';
        END IF;
    END IF;

    RETURN v_ret_id;
END;
$function$;

COMMIT;
