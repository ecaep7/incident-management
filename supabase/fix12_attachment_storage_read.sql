-- Fix #12: cho phep xem tep bang chung (bucket 'attachments' dang rieng tu, chua co policy SELECT
-- tren storage.objects nen Admin/Viewer/Handler deu khong tao duoc signed URL).
-- Chi cap quyen DOC (SELECT); viec tai len van di qua edge function upload-attachment nhu cu.
--   Admin  : doc moi tep trong bucket
--   Viewer : doc tep bang chung cua task (thu muc task/...)  -- khop voi viewer_select_attachment
--   Handler: doc tep cua task do chinh minh xu ly            -- khop voi handler_select_own_attachment

DROP POLICY IF EXISTS "attachments_read_by_role" ON storage.objects;

CREATE POLICY "attachments_read_by_role" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (
      public.my_role() = 'Admin'
      OR (public.my_role() = 'Viewer' AND (storage.foldername(name))[1] = 'task')
      OR (
        public.my_role() = 'Handler'
        AND (storage.foldername(name))[1] = 'task'
        AND (storage.foldername(name))[2] IN (
          SELECT t.task_id::text FROM public.ticket_task t WHERE t.handler_user_id = auth.uid()
        )
      )
    )
  );
