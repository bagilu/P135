-- 在備份／staging 驗證並核准 migration 後，以 Supabase SQL Editor 管理角色執行。
-- 將下一段的 NULL 改成您 Authentication > Users 的 User UID，例如 '您的UUID'::uuid。
-- 這是資料庫端的編輯資格，不是公開 config.js 的設定。
BEGIN;
DO $owner$
DECLARE v_owner uuid := NULL; -- 必填：改成 '您的 User UID'::uuid
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION '請先將 v_owner 的 NULL 換成您的 Supabase User UID（帶引號並加 ::uuid）'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_owner) THEN RAISE EXCEPTION '該 UID 不存在於此專案的 Supabase Auth'; END IF;
  IF EXISTS(SELECT 1 FROM p135_data."TblP135_Settings" s WHERE s.editor_user_id<>v_owner) THEN RAISE EXCEPTION '已設定其他編輯者；本腳本不自動轉移擁有者'; END IF;
  INSERT INTO p135_data."TblP135_Settings"(singleton,editor_user_id) VALUES(true,v_owner) ON CONFLICT(singleton) DO NOTHING;
END $owner$;
COMMIT;
