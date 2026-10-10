-- Fix #16: chuan bi vong danh gia v2
--   (1) Luu ket qua v1 cua bo thu sang bang ai_eval_archive (de so sanh ve sau)
--   (2) Xoa goi y v1 cua bo thu khoi ai_suggestion -> n8n se phan tich lai voi prompt v2
--   (3) Bo dau hieu "TEST-AI" khoi source_system (AI da dung no lam bang chung o ca T20)
--   (4) Bo sung mo ta cho loai su co 7
-- Chi dong cham den 40 canh bao thu va loai su co 7. Chay lai nhieu lan khong loi, khong nhan doi.

BEGIN;

-- (1) Bang luu tru: cung cau truc ai_suggestion + cot run_label
CREATE TABLE IF NOT EXISTS public.ai_eval_archive AS
  SELECT * FROM public.ai_suggestion WITH NO DATA;
ALTER TABLE public.ai_eval_archive ADD COLUMN IF NOT EXISTS run_label varchar;

ALTER TABLE public.ai_eval_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_ai_eval_archive" ON public.ai_eval_archive;
CREATE POLICY "admin_select_ai_eval_archive" ON public.ai_eval_archive
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.my_role() = 'Admin');
REVOKE ALL ON public.ai_eval_archive FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_eval_archive FROM authenticated;
GRANT SELECT ON public.ai_eval_archive TO authenticated;

INSERT INTO public.ai_eval_archive
SELECT s.*, 'v1' AS run_label
FROM public.ai_suggestion s
WHERE s.incident_id IN (SELECT incident_id FROM public.ai_test_case)
  AND NOT EXISTS (SELECT 1 FROM public.ai_eval_archive a WHERE a.suggestion_id = s.suggestion_id);

-- (2) Xoa goi y cua bo thu khoi bang chinh (da luu o buoc 1)
DELETE FROM public.ai_suggestion
WHERE incident_id IN (SELECT incident_id FROM public.ai_test_case);

-- (3) Canh bao thu mang nguon giong canh bao that; van nhan dien qua source_event_id 'TEST-AI-...'
UPDATE public.incident_alert
SET source_system = 'SIEM'
WHERE source_system = 'TEST-AI' AND source_event_id LIKE 'TEST-AI-%';

-- (4) Mo ta cho loai 7 (truoc day de trong)
UPDATE public.incident_category
SET description = 'Quét cổng lặp lại theo chu kỳ từ cùng một nguồn bên ngoài; rủi ro thấp nhưng vẫn cần ghi nhận và chặn nguồn'
WHERE category_id = 7 AND (description IS NULL OR description = '' OR description = 'null');

COMMIT;

-- Kiem tra nhanh (chay rieng):
-- SELECT run_label, status, count(*) FROM ai_eval_archive GROUP BY 1, 2;          -- v1 / OK = 40 (+ vai dong ERROR neu co)
-- SELECT count(*) FROM ai_suggestion WHERE incident_id IN (SELECT incident_id FROM ai_test_case);  -- = 0
-- SELECT source_system, count(*) FROM incident_alert WHERE source_event_id LIKE 'TEST-AI-%' GROUP BY 1;  -- SIEM = 40