-- Fix #18: CHUAN BI CHO GIAO DIEN QUAN TRI DANH MUC (thiet bi, loai su co)
--
-- Giao dien moi cho phep Admin THEM / SUA thiet bi va loai su co ngay tren web.
-- Phan quyen da co san (policy admin_all_device, admin_all_incident_category),
-- nen file nay chi bao dam 2 viec:
--   1. Cot khoa chinh device_id, category_id tu sinh so khi them moi
--      (neu cot chua co gia tri mac dinh thi tao sequence bat dau tu max hien tai + 1).
--   2. Rang buoc du lieu hop le: muc uu tien, so gio SLA, trang thai thiet bi.
--
-- KHONG co chuc nang xoa: thiet bi / loai su co dang duoc canh bao va ticket tham chieu,
-- nen chi cho phep chuyen thiet bi sang trang thai 'inactive' (ngung su dung).
--
-- Chay toan bo file 1 lan trong Supabase > SQL Editor. Chay lai cung khong loi.

-- ============================================================
-- 1. Khoa chinh tu sinh
-- ============================================================
DO $$
DECLARE
  t record;
  v_seq text;
  v_max bigint;
BEGIN
  FOR t IN SELECT * FROM (VALUES ('device', 'device_id'), ('incident_category', 'category_id')) AS x(tbl, col) LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t.tbl AND column_name = t.col
        AND column_default IS NULL AND is_identity = 'NO'
    ) THEN
      v_seq := t.tbl || '_' || t.col || '_seq';
      EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I OWNED BY public.%I.%I', v_seq, t.tbl, t.col);
      EXECUTE format('SELECT COALESCE(max(%I), 0) FROM public.%I', t.col, t.tbl) INTO v_max;
      EXECUTE format('SELECT setval(%L, %s, true)', 'public.' || v_seq, GREATEST(v_max, 1));
      IF v_max = 0 THEN
        EXECUTE format('SELECT setval(%L, 1, false)', 'public.' || v_seq);
      END IF;
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT nextval(%L)', t.tbl, t.col, 'public.' || v_seq);
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated, service_role', v_seq);
      RAISE NOTICE 'Da tao gia tri tu sinh cho %.%', t.tbl, t.col;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2. Rang buoc du lieu hop le (NOT VALID: khong kiem tra lai du lieu cu,
--    chi ap dung cho cac lan them / sua tu nay ve sau)
-- ============================================================
ALTER TABLE public.incident_category DROP CONSTRAINT IF EXISTS incident_category_priority_check;
ALTER TABLE public.incident_category ADD CONSTRAINT incident_category_priority_check
  CHECK (priority_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) NOT VALID;

ALTER TABLE public.incident_category DROP CONSTRAINT IF EXISTS incident_category_sla_check;
ALTER TABLE public.incident_category ADD CONSTRAINT incident_category_sla_check
  CHECK (sla_hours > 0 AND sla_hours <= 720) NOT VALID;

ALTER TABLE public.device DROP CONSTRAINT IF EXISTS device_status_check;
ALTER TABLE public.device ADD CONSTRAINT device_status_check
  CHECK (status IN ('active', 'inactive')) NOT VALID;

-- ============================================================
-- KIEM TRA NHANH (dang chu thich):
-- SELECT column_name, column_default FROM information_schema.columns
--   WHERE table_name IN ('device','incident_category') AND column_name IN ('device_id','category_id');
-- ============================================================
