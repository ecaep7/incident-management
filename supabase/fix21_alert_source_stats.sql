-- Fix #21: Thong ke canh bao theo nguon gui (source_system) cho dashboard
--
-- Chi THEM 1 ham moi, khong sua bang / policy / ham nao dang co.
-- Ham chay SECURITY DEFINER va tu gioi han du lieu theo vai tro (giong list_device_summary):
--   - Admin : thay day du moi nguon -> tong canh bao, so thanh ticket, so canh bao sai, so dang cho
--   - Viewer: chi thay so canh bao DA thanh ticket (su co that) theo nguon;
--             khong thay tong canh bao / canh bao sai / dang cho (Viewer khong duoc doc canh bao tho)
-- Loc theo thoi diem tiep nhan canh bao (received_at). Bo qua du lieu thu nghiem danh gia AI
-- (source_event_id bat dau bang 'TEST-AI-').
--
-- Chay toan bo file nay 1 lan trong Supabase > SQL Editor.

CREATE OR REPLACE FUNCTION public.get_alert_source_stats(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
)
RETURNS TABLE(
  source_system  character varying,
  total_alerts   bigint,
  ticket_alerts  bigint,
  false_alerts   bigint,
  pending_alerts bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_role varchar := my_role();
BEGIN
  IF COALESCE(v_role, '') NOT IN ('Admin', 'Viewer') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT
    ia.source_system,
    CASE WHEN v_role = 'Admin' THEN count(*) END,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM ticket t WHERE t.incident_id = ia.incident_id)),
    CASE WHEN v_role = 'Admin' THEN count(*) FILTER (WHERE ia.current_status = 'Closed_False') END,
    CASE WHEN v_role = 'Admin' THEN count(*) FILTER (WHERE ia.current_status IN ('NEW', 'Verifying')) END
  FROM incident_alert ia
  WHERE (p_from IS NULL OR ia.received_at >= p_from)
    AND (p_to IS NULL OR ia.received_at <= p_to)
    AND ia.source_event_id NOT LIKE 'TEST-AI-%'
    -- Viewer chi tinh cac canh bao da thanh ticket
    AND (v_role = 'Admin' OR EXISTS (SELECT 1 FROM ticket t WHERE t.incident_id = ia.incident_id))
  GROUP BY ia.source_system
  ORDER BY count(*) DESC, ia.source_system;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_alert_source_stats(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_alert_source_stats(timestamptz, timestamptz) TO authenticated;

-- ============================================================
-- KIEM TRA NHANH (dang chu thich): goi thu voi quyen cua nguoi dang dang nhap tren web
-- SELECT * FROM public.get_alert_source_stats();
-- (Trong SQL Editor khong co nguoi dang nhap nen ham se bao NOT_AUTHORIZED - day la binh thuong.)
--
-- GO BO (neu can):
-- DROP FUNCTION IF EXISTS public.get_alert_source_stats(timestamptz, timestamptz);
-- ============================================================
