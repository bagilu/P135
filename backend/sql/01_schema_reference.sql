-- P135 V0.01：依交接的資料庫定義重建，非本次部署所需。
-- 僅供全新 Supabase 環境參考；既有專案請勿重新執行。
-- 本交付包未在新資料庫執行驗證；未包含使用者資料、Auth 設定或秘密金鑰。


BEGIN;

CREATE TABLE public."TblP135_Articles" (
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
  CONSTRAINT "TblP135_Articles_pkey" PRIMARY KEY (id),
  CONSTRAINT "TblP135_Articles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public."TblP135_Articles" OWNER TO postgres;

ALTER TABLE public."TblP135_Articles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "P135_Articles_owner_policy" ON public."TblP135_Articles" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE TABLE public."TblP135_Entities" (
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

ALTER TABLE public."TblP135_Entities" OWNER TO postgres;

ALTER TABLE public."TblP135_Entities" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "P135_Entities_owner_policy" ON public."TblP135_Entities" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE TABLE public."TblP135_EntityEvents" (
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
  CONSTRAINT "TblP135_EntityEvents_article_id_fkey" FOREIGN KEY (article_id) REFERENCES "TblP135_Articles"(id) ON DELETE SET NULL,
  CONSTRAINT "TblP135_EntityEvents_entity_id_fkey" FOREIGN KEY (entity_id) REFERENCES "TblP135_Entities"(id) ON DELETE CASCADE,
  CONSTRAINT "TblP135_EntityEvents_pkey" PRIMARY KEY (id),
  CONSTRAINT "TblP135_EntityEvents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public."TblP135_EntityEvents" OWNER TO postgres;

ALTER TABLE public."TblP135_EntityEvents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "P135_EntityEvents_owner_policy" ON public."TblP135_EntityEvents" AS PERMISSIVE FOR ALL TO "authenticated" USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

COMMIT;
