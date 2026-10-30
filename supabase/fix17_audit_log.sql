-- Fix #17: NHAT KY THAO TAC (audit log)
--
-- Muc dich: ghi lai MOI thay doi (them / sua / xoa) tren cac bang nghiep vu:
--   ai lam, lam gi, tren ban ghi nao, luc nao, gia tri truoc va sau.
--
-- Nguyen tac:
--   - KHONG sua bang / ham / policy loi nao. Chi them 1 bang + 1 ham trigger + gan trigger.
--   - Trigger chay SAU khi ghi (AFTER). Neu viec ghi nhat ky gap loi thi chi bao WARNING,
--     KHONG lam hong thao tac nghiep vu (an toan cho luong chinh).
--   - Chi Admin duoc DOC nhat ky. Khong ai (ke ca Admin) duoc sua / xoa nhat ky qua API.
--   - changed_by = NULL nghia la thay doi do he thong / tich hop thuc hien
--     (vi du: API tiep nhan canh bao, n8n, Edge Function dung service_role).
--
-- Chay toan bo file 1 lan trong Supabase > SQL Editor. Chay lai cung khong loi.

-- ============================================================
-- 1. Bang nhat ky
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  log_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name      varchar NOT NULL,
  record_id       text,
  action          varchar NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by      uuid,              -- auth.uid() cua nguoi thao tac; NULL = he thong
  actor_role      varchar,           -- vai tro tai thoi diem thao tac
  old_data        jsonb,             -- UPDATE: chi cac cot thay doi; DELETE: ca dong
  new_data        jsonb,             -- UPDATE: chi cac cot thay doi; INSERT: ca dong
  changed_fields  text[],            -- UPDATE: danh sach cot thay doi
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON public.audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_record_idx ON public.audit_log (table_name, record_id);

-- ============================================================
-- 2. Phan quyen: chi Admin doc; khong ai ghi / sua / xoa truc tiep
--    (trigger chay SECURITY DEFINER nen van ghi duoc)
-- ============================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_audit_log" ON public.audit_log;
CREATE POLICY "admin_select_audit_log" ON public.audit_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.my_role() = 'Admin');

REVOKE ALL ON public.audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated;   -- RLS o tren loc con moi Admin

-- ============================================================
-- 3. Ham trigger dung chung cho moi bang
--    Tham so TG_ARGV[0] = ten cot khoa chinh cua bang
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pk     text := TG_ARGV[0];
  v_old    jsonb;
  v_new    jsonb;
  v_fields text[];
  v_uid    uuid;
  v_role   varchar;
BEGIN
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN others THEN
    v_uid := NULL;
  END;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k ORDER BY k) INTO v_fields
    FROM jsonb_object_keys(v_new) AS k
    WHERE (v_new -> k) IS DISTINCT FROM (v_old -> k);

    -- UPDATE khong doi gia tri nao -> khong ghi
    IF v_fields IS NULL THEN
      RETURN NULL;
    END IF;

    -- Chi giu lai cac cot co thay doi cho gon
    SELECT jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      INTO v_old, v_new
    FROM unnest(v_fields) AS k;

    -- id lay tu dong goc (khoa chinh khong nam trong danh sach cot doi)
    INSERT INTO public.audit_log (table_name, record_id, action, changed_by, actor_role, old_data, new_data, changed_fields)
    SELECT TG_TABLE_NAME, to_jsonb(NEW) ->> v_pk, TG_OP, v_uid,
           (SELECT r.role_name FROM "user" u JOIN role r ON r.role_id = u.role_id WHERE u.user_id = v_uid),
           v_old, v_new, v_fields;
    RETURN NULL;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT r.role_name INTO v_role FROM "user" u JOIN role r ON r.role_id = u.role_id WHERE u.user_id = v_uid;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, changed_by, actor_role, old_data, new_data, changed_fields)
  VALUES (TG_TABLE_NAME, COALESCE(v_new ->> v_pk, v_old ->> v_pk), TG_OP, v_uid, v_role, v_old, v_new, NULL);

  RETURN NULL;
EXCEPTION WHEN others THEN
  -- Khong de loi ghi nhat ky lam hong thao tac nghiep vu
  RAISE WARNING 'audit_trigger(%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4. Gan trigger vao cac bang nghiep vu
-- ============================================================
DROP TRIGGER IF EXISTS audit_incident_alert ON public.incident_alert;
CREATE TRIGGER audit_incident_alert AFTER INSERT OR UPDATE OR DELETE ON public.incident_alert
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('incident_id');

DROP TRIGGER IF EXISTS audit_incident_verification ON public.incident_verification;
CREATE TRIGGER audit_incident_verification AFTER INSERT OR UPDATE OR DELETE ON public.incident_verification
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('verification_id');

DROP TRIGGER IF EXISTS audit_ticket ON public.ticket;
CREATE TRIGGER audit_ticket AFTER INSERT OR UPDATE OR DELETE ON public.ticket
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('ticket_id');

DROP TRIGGER IF EXISTS audit_ticket_task ON public.ticket_task;
CREATE TRIGGER audit_ticket_task AFTER INSERT OR UPDATE OR DELETE ON public.ticket_task
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('task_id');

DROP TRIGGER IF EXISTS audit_attachment ON public.attachment;
CREATE TRIGGER audit_attachment AFTER INSERT OR UPDATE OR DELETE ON public.attachment
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('attachment_id');

DROP TRIGGER IF EXISTS audit_device ON public.device;
CREATE TRIGGER audit_device AFTER INSERT OR UPDATE OR DELETE ON public.device
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('device_id');

DROP TRIGGER IF EXISTS audit_devicetype ON public.devicetype;
CREATE TRIGGER audit_devicetype AFTER INSERT OR UPDATE OR DELETE ON public.devicetype
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('devicetype_id');

DROP TRIGGER IF EXISTS audit_incident_category ON public.incident_category;
CREATE TRIGGER audit_incident_category AFTER INSERT OR UPDATE OR DELETE ON public.incident_category
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('category_id');

DROP TRIGGER IF EXISTS audit_department ON public.department;
CREATE TRIGGER audit_department AFTER INSERT OR UPDATE OR DELETE ON public.department
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('dep_id');

DROP TRIGGER IF EXISTS audit_user ON public."user";
CREATE TRIGGER audit_user AFTER INSERT OR UPDATE OR DELETE ON public."user"
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('user_id');

DROP TRIGGER IF EXISTS audit_role ON public.role;
CREATE TRIGGER audit_role AFTER INSERT OR UPDATE OR DELETE ON public.role
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger('role_id');

-- ============================================================
-- KIEM TRA NHANH (chay rieng tung cau, dang chu thich):
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'audit_%';
-- SELECT * FROM public.audit_log ORDER BY changed_at DESC LIMIT 20;
--
-- GO BO (neu can quay lai trang thai cu):
-- DO $$ DECLARE t record; BEGIN
--   FOR t IN SELECT tgname, tgrelid::regclass AS tbl FROM pg_trigger WHERE tgname LIKE 'audit\_%' LOOP
--     EXECUTE format('DROP TRIGGER %I ON %s', t.tgname, t.tbl);
--   END LOOP; END $$;
-- DROP FUNCTION IF EXISTS public.audit_trigger();
-- DROP TABLE IF EXISTS public.audit_log;
-- ============================================================
