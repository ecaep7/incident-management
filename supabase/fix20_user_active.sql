-- Fix #20: Vo hieu hoa / kich hoat lai tai khoan nguoi dung (chi Admin)
--
-- Truoc day cot user.is_active chi duoc gan khi tao tai khoan, khong noi nao doc toi:
-- dat is_active = false thi nguoi do van dang nhap va thao tac binh thuong.
-- File nay lam cho is_active co hieu luc o 3 lop:
--   1. Dang nhap  : khoa tai khoan trong Supabase Auth (banned_until) + xoa cac phien dang mo
--                   -> khong dang nhap moi duoc, khong gia han phien cu duoc.
--   2. Du lieu    : my_role() tra ve NULL voi tai khoan bi khoa -> moi chinh sach RLS va
--                   ham nghiep vu tu chan, ke ca khi ma JWT cu chua het han (toi da ~1 gio).
--   3. Phan cong  : khong giao duoc nhiem vu moi cho Handler da bi khoa.
-- Thao tac duoc ghi vao audit_log qua trigger audit_user co san.
--
-- Chay toan bo file nay 1 lan trong Supabase > SQL Editor.

-- ============================================================
-- 1. my_role(): tai khoan bi khoa -> NULL (moi policy dang "my_role() = 'X'" se khong khop)
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS character varying
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.role_name
  FROM "user" u
  JOIN role r ON r.role_id = u.role_id
  WHERE u.user_id = auth.uid()
    AND COALESCE(u.is_active, true)
$function$;

-- ============================================================
-- 2. Danh ba nguoi dung: tra them is_active de giao dien an Handler bi khoa khoi danh sach
--    phan cong (van giu ten de hien thi lich su cac ticket cu)
-- ============================================================
DROP FUNCTION IF EXISTS public.list_user_directory();
CREATE FUNCTION public.list_user_directory()
 RETURNS TABLE(user_id uuid, full_name character varying, role_name character varying, dep_id integer, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.user_id, u.full_name, r.role_name, u.dep_id, COALESCE(u.is_active, true)
  FROM "user" u
  JOIN role r ON r.role_id = u.role_id
  WHERE my_role() IS NOT NULL;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_user_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_user_directory() TO authenticated;

-- ============================================================
-- 3. Trigger fix19: them dieu kien Handler phai dang hoat dong khi duoc giao / giao lai
--    (trigger chi chay khi doi handler_user_id / assigned_dep_id nen khong anh huong
--     viec Admin duyet nhiem vu cu cua nguoi da bi khoa)
-- ============================================================
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
      AND COALESCE(u.is_active, true)
  ) THEN
    RAISE EXCEPTION 'HANDLER_NOT_IN_DEPARTMENT: Người xử lý không thuộc phòng ban được giao, không có vai trò Handler hoặc đã bị vô hiệu hóa'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. Ham Admin goi tu giao dien de khoa / mo khoa tai khoan
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_user_active(p_user_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.my_role() IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Chỉ Admin được thay đổi trạng thái tài khoản';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_DEACTIVATE_SELF: Không thể tự thay đổi trạng thái tài khoản của chính mình';
  END IF;

  UPDATE public."user" SET is_active = p_active WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Không tìm thấy người dùng';
  END IF;

  -- Khoa / mo khoa o tang dang nhap cua Supabase Auth
  UPDATE auth.users
  SET banned_until = CASE WHEN p_active THEN NULL ELSE now() + interval '100 years' END
  WHERE id = p_user_id;

  -- Khoa thi dang xuat ngay moi phien dang mo (refresh token bi xoa theo phien)
  IF NOT p_active THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_active(uuid, boolean) TO authenticated;

-- ============================================================
-- KIEM TRA NHANH (dang chu thich, chay rieng tung cau):
-- SELECT u.full_name, u.is_active, a.banned_until
-- FROM public."user" u JOIN auth.users a ON a.id = u.user_id ORDER BY u.full_name;
--
-- GO BO (quay ve trang thai cu): mo khoa tat ca tai khoan
-- UPDATE public."user" SET is_active = true;
-- UPDATE auth.users SET banned_until = NULL;
-- ============================================================
