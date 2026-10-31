-- Fix #19: CHAN GIAO VIEC CHO NGUOI KHONG THUOC PHONG BAN DUOC CHON
--
-- Truoc day, ham create_ticket_with_task va reassign_ticket_task ghi thang
-- handler_user_id + assigned_dep_id vao ticket_task ma khong kiem tra nguoi xu ly
-- co thuoc phong ban do khong. Giao dien da loc danh sach theo phong ban, nhung
-- neu giao dien loi hoac goi API truc tiep thi van ghi duoc du lieu sai.
--
-- File nay them 1 trigger BEFORE INSERT/UPDATE tren ticket_task: nguoi duoc giao phai
--   (1) co vai tro Handler, va (2) thuoc dung phong ban assigned_dep_id.
-- Sai thi bao loi -> toan bo giao dich (tao ticket / giao lai) bi huy, khong luu gi.
-- Khong sua noi dung 2 ham cu; chi ap dung cho cac lan giao viec tu nay ve sau.
--
-- Chay toan bo file 1 lan trong Supabase > SQL Editor. Chay lai cung khong loi.

CREATE OR REPLACE FUNCTION public.check_task_handler_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "user" u
    JOIN role r ON r.role_id = u.role_id
    WHERE u.user_id = NEW.handler_user_id
      AND r.role_name = 'Handler'
      AND u.dep_id = NEW.assigned_dep_id
  ) THEN
    RAISE EXCEPTION 'HANDLER_NOT_IN_DEPARTMENT: Người xử lý không thuộc phòng ban được giao hoặc không có vai trò Handler'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_task_handler_department ON public.ticket_task;
CREATE TRIGGER trg_check_task_handler_department
  BEFORE INSERT OR UPDATE OF handler_user_id, assigned_dep_id ON public.ticket_task
  FOR EACH ROW EXECUTE FUNCTION public.check_task_handler_department();

-- ============================================================
-- KIEM TRA NHANH (dang chu thich): cac task cu dang bi giao sai phong ban (neu co)
-- SELECT t.task_id, t.ticket_id, u.full_name, t.assigned_dep_id, u.dep_id AS dep_that_su
-- FROM ticket_task t JOIN "user" u ON u.user_id = t.handler_user_id
-- WHERE u.dep_id IS DISTINCT FROM t.assigned_dep_id;
--
-- GO BO (neu can):
-- DROP TRIGGER IF EXISTS trg_check_task_handler_department ON public.ticket_task;
-- DROP FUNCTION IF EXISTS public.check_task_handler_department();
-- ============================================================
