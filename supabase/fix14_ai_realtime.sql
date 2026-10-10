-- Fix #14: bat Supabase Realtime cho bang ai_suggestion.
-- Muc dich: khi n8n vua ghi goi y AI, trang chi tiet canh bao cua Admin nhan duoc ngay
-- va hien card goi y lien, khong phai cho lan kiem tra dinh ky.
-- Realtime van ton trong RLS: chi Admin (nguoi doc duoc bang nay) moi nhan duoc thong bao.
-- Khong sua bang/ham nao; chay lai nhieu lan cung khong loi.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_suggestion'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_suggestion;
  END IF;
END $$;