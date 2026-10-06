-- Fix #13: Gợi ý của AI (Gemini) cho bước phân loại cảnh báo.
-- Nguyên tắc: KHÔNG sửa bảng/hàm lõi. AI chỉ ghi vào bảng mới ai_suggestion,
-- Admin vẫn tự quyết định (từ chối / xác minh / tạo ticket) như cũ.
--
-- AI gợi ý: kết luận (sự cố thật / cảnh báo sai / cần xác minh), loại sự cố, hướng xử lý.
-- Phòng ban và handler: Admin tự chọn.
--
-- Chạy toàn bộ file này 1 lần trong Supabase > SQL Editor. Chạy lại cũng không lỗi.

-- ============================================================
-- 1. Bảng lưu gợi ý của AI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_suggestion (
  suggestion_id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id           integer NOT NULL REFERENCES public.incident_alert(incident_id),
  status                varchar NOT NULL CHECK (status IN ('OK', 'ERROR')),
  verdict               varchar CHECK (verdict IN ('TRUE_INCIDENT', 'FALSE_POSITIVE', 'NEED_VERIFICATION')),
  suggested_category_id integer REFERENCES public.incident_category(category_id),
  suggested_direction   varchar CHECK (suggested_direction IN ('ONSITE', 'SYSTEM')),
  confidence            numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  reasoning             text,
  model_name            varchar,
  prompt_version        varchar,
  latency_ms            integer,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  -- Gợi ý OK thì bắt buộc có kết luận; kết luận "sự cố thật" thì bắt buộc có loại sự cố + hướng xử lý
  CONSTRAINT ai_suggestion_ok_has_verdict CHECK (status = 'ERROR' OR verdict IS NOT NULL),
  CONSTRAINT ai_suggestion_true_has_detail CHECK (
    verdict IS DISTINCT FROM 'TRUE_INCIDENT'
    OR (suggested_category_id IS NOT NULL AND suggested_direction IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ai_suggestion_incident_idx
  ON public.ai_suggestion (incident_id, created_at DESC);

-- ============================================================
-- 2. Phân quyền: chỉ Admin được ĐỌC; chỉ n8n (service_role) được GHI
--    (service_role bỏ qua RLS nên không cần policy INSERT)
-- ============================================================
ALTER TABLE public.ai_suggestion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_ai_suggestion" ON public.ai_suggestion;
CREATE POLICY "admin_select_ai_suggestion" ON public.ai_suggestion
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.my_role() = 'Admin');

REVOKE ALL ON public.ai_suggestion FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_suggestion FROM authenticated;
GRANT SELECT ON public.ai_suggestion TO authenticated;          -- RLS ở trên lọc còn mỗi Admin
GRANT SELECT, INSERT ON public.ai_suggestion TO service_role;   -- n8n ghi gợi ý

-- ============================================================
-- 3. Hàm cho n8n: lấy các cảnh báo đang chờ AI phân tích, kèm ngữ cảnh
--    - Cảnh báo còn mở (NEW / Verifying), chưa có gợi ý OK nào
--    - Bỏ qua cảnh báo đã lỗi 3 lần (tránh gọi Gemini lặp vô hạn)
--    - Ngữ cảnh: thiết bị + lịch sử 30 ngày của thiết bị
--    Chỉ service_role gọi được (n8n), người dùng web không gọi được.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ai_pending_alerts(p_limit integer DEFAULT 5)
RETURNS TABLE(
  incident_id integer,
  source_system varchar,
  device_ip varchar,
  severity_level varchar,
  alert_summary varchar,
  raw_payload text,
  received_at timestamptz,
  device_name varchar,
  devicetype_name varchar,
  device_location varchar,
  alerts_30d bigint,
  false_alerts_30d bigint,
  tickets_30d bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ia.incident_id, ia.source_system, ia.device_ip, ia.severity_level, ia.alert_summary,
    ia.raw_payload, ia.received_at,
    d.device_name, dt.devicetype_name, d.location,
    (SELECT count(*) FROM incident_alert h
      WHERE h.device_ip = ia.device_ip AND h.incident_id <> ia.incident_id
        AND h.received_at >= now() - interval '30 days'),
    (SELECT count(*) FROM incident_alert h
      WHERE h.device_ip = ia.device_ip AND h.incident_id <> ia.incident_id
        AND h.received_at >= now() - interval '30 days' AND h.current_status = 'Closed_False'),
    (SELECT count(*) FROM incident_alert h
      WHERE h.device_ip = ia.device_ip AND h.incident_id <> ia.incident_id
        AND h.received_at >= now() - interval '30 days' AND h.current_status = 'Ticket_Created')
  FROM incident_alert ia
  LEFT JOIN device d ON d.management_ip = ia.device_ip
  LEFT JOIN devicetype dt ON dt.devicetype_id = d.devicetype_id
  WHERE ia.current_status IN ('NEW', 'Verifying')
    AND NOT EXISTS (SELECT 1 FROM ai_suggestion s WHERE s.incident_id = ia.incident_id AND s.status = 'OK')
    AND (SELECT count(*) FROM ai_suggestion s WHERE s.incident_id = ia.incident_id AND s.status = 'ERROR') < 3
  ORDER BY ia.received_at ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 20)
$function$;

REVOKE EXECUTE ON FUNCTION public.ai_pending_alerts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_pending_alerts(integer) TO service_role;

-- ============================================================
-- 4. View đánh giá độ chính xác (chỉ để lấy số liệu cho khóa luận)
--    So gợi ý OK GẦN NHẤT TRƯỚC KHI Admin quyết định với kết quả thực tế:
--      Ticket_Created -> sự cố thật, so thêm loại sự cố + hướng xử lý với ticket
--      Closed_False   -> cảnh báo sai
--    security_invoker: view tôn trọng RLS -> chỉ Admin (hoặc SQL Editor) đọc được.
-- ============================================================
CREATE OR REPLACE VIEW public.v_ai_evaluation
WITH (security_invoker = true) AS
SELECT
  ia.incident_id,
  s.suggestion_id,
  s.prompt_version,
  s.model_name,
  s.verdict,
  s.suggested_category_id,
  s.suggested_direction,
  s.confidence,
  s.latency_ms,
  CASE ia.current_status
    WHEN 'Ticket_Created' THEN 'TRUE_INCIDENT'
    WHEN 'Closed_False'   THEN 'FALSE_POSITIVE'
  END AS actual_verdict,
  t.category_id AS actual_category_id,
  t.direction   AS actual_direction,
  CASE WHEN ia.current_status IN ('Ticket_Created', 'Closed_False') AND s.verdict <> 'NEED_VERIFICATION'
       THEN s.verdict = CASE ia.current_status WHEN 'Ticket_Created' THEN 'TRUE_INCIDENT' ELSE 'FALSE_POSITIVE' END
  END AS verdict_correct,
  CASE WHEN t.ticket_id IS NOT NULL AND s.verdict = 'TRUE_INCIDENT'
       THEN s.suggested_category_id = t.category_id END AS category_correct,
  CASE WHEN t.ticket_id IS NOT NULL AND s.verdict = 'TRUE_INCIDENT'
       THEN s.suggested_direction = t.direction END AS direction_correct
FROM public.incident_alert ia
LEFT JOIN public.ticket t ON t.incident_id = ia.incident_id
JOIN LATERAL (
  SELECT *
  FROM public.ai_suggestion s
  WHERE s.incident_id = ia.incident_id
    AND s.status = 'OK'
    AND s.created_at <= COALESCE(t.created_at, ia.closed_at, now())
  ORDER BY s.created_at DESC
  LIMIT 1
) s ON true;

REVOKE ALL ON public.v_ai_evaluation FROM anon;
GRANT SELECT ON public.v_ai_evaluation TO authenticated, service_role;  -- RLS của ai_suggestion vẫn áp dụng

-- ============================================================
-- 5. (Tham khảo) Câu truy vấn tổng hợp số liệu cho khóa luận — chạy riêng khi cần
-- ============================================================
-- SELECT
--   prompt_version,
--   count(*)                                                    AS so_canh_bao_da_quyet_dinh,
--   round(100.0 * avg(verdict_correct::int), 1)                 AS ty_le_dung_ket_luan,
--   round(100.0 * avg((verdict = 'NEED_VERIFICATION')::int), 1) AS ty_le_can_xac_minh,
--   round(100.0 * avg(category_correct::int), 1)                AS ty_le_dung_loai_su_co,
--   round(100.0 * avg(direction_correct::int), 1)               AS ty_le_dung_huong_xu_ly,
--   round(avg(latency_ms))                                      AS thoi_gian_phan_hoi_tb_ms
-- FROM v_ai_evaluation
-- WHERE actual_verdict IS NOT NULL
-- GROUP BY prompt_version;
