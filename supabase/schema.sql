CREATE TABLE attachment (
  attachment_id integer NOT NULL,
  entity_id integer NOT NULL,
  entity_type character varying NOT NULL,
  file_name character varying,
  file_url text,
  uploaded_at timestamp with time zone,
  CONSTRAINT attachment_pkey PRIMARY KEY (attachment_id)
);

CREATE TABLE dashboard_dept_performance (
  dep_name character varying,
  total_closed bigint,
  avg_hours_to_close numeric
);

CREATE TABLE dashboard_sla_compliance (
  total_closed bigint,
  closed_on_time bigint,
  compliance_rate_percent numeric
);

CREATE TABLE dashboard_sla_summary (
  total_open bigint,
  total_breached bigint
);

CREATE TABLE dashboard_ticket_trend (
  week_start date,
  total bigint
);

CREATE TABLE dashboard_tickets_by_department (
  dep_name character varying,
  total bigint
);

CREATE TABLE dashboard_tickets_by_priority (
  priority_level character varying,
  total bigint
);

CREATE TABLE dashboard_tickets_by_status (
  status character varying,
  total bigint
);

CREATE TABLE department (
  dep_id integer NOT NULL,
  dep_code character varying,
  dep_name character varying,
  description text,
  CONSTRAINT department_pkey PRIMARY KEY (dep_id)
);

CREATE TABLE device (
  device_id integer NOT NULL,
  device_code character varying,
  management_ip character varying NOT NULL,
  device_name character varying,
  devicetype_id integer NOT NULL,
  location character varying,
  manufacturer character varying,
  status character varying,
  CONSTRAINT device_pkey PRIMARY KEY (device_id),
  CONSTRAINT device_management_ip_key UNIQUE (management_ip),
  CONSTRAINT device_devicetype_id_fkey FOREIGN KEY (devicetype_id) REFERENCES devicetype(devicetype_id) DEFERRABLE
);

CREATE TABLE devicetype (
  devicetype_id integer NOT NULL,
  devicetype_name character varying,
  CONSTRAINT devicetype_pkey PRIMARY KEY (devicetype_id)
);

CREATE TABLE incident_alert (
  incident_id integer NOT NULL,
  source_system character varying NOT NULL,
  source_event_id character varying NOT NULL,
  device_ip character varying NOT NULL,
  severity_level character varying,
  alert_summary character varying,
  raw_payload text,
  received_at timestamp with time zone,
  is_hvbt boolean,
  current_status character varying,
  verified_by uuid,
  verified_at timestamp with time zone,
  closed_at timestamp with time zone,
  closed_reason character varying,
  CONSTRAINT incident_alert_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES "user"(user_id) DEFERRABLE,
  CONSTRAINT incident_alert_device_ip_fkey FOREIGN KEY (device_ip) REFERENCES device(management_ip) DEFERRABLE,
  CONSTRAINT incident_alert_pkey PRIMARY KEY (incident_id)
);

CREATE TABLE incident_category (
  category_id integer NOT NULL,
  category_name character varying,
  sla_hours integer,
  priority_level character varying,
  description text,
  CONSTRAINT incident_category_pkey PRIMARY KEY (category_id)
);

CREATE TABLE incident_verification (
  verification_id integer NOT NULL,
  incident_id integer NOT NULL,
  request_note text,
  requested_at timestamp with time zone,
  requested_by uuid NOT NULL,
  response_payload text,
  responded_at timestamp with time zone,
  CONSTRAINT incident_verification_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES "user"(user_id) DEFERRABLE,
  CONSTRAINT incident_verification_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_alert(incident_id) DEFERRABLE,
  CONSTRAINT incident_verification_pkey PRIMARY KEY (verification_id)
);

CREATE TABLE my_task_performance (
  total_tasks bigint,
  passed bigint,
  failed bigint,
  pending bigint,
  avg_hours_to_submit numeric
);

CREATE TABLE role (
  role_id integer NOT NULL,
  role_name character varying,
  description text,
  CONSTRAINT role_pkey PRIMARY KEY (role_id)
);

CREATE TABLE ticket (
  ticket_id integer NOT NULL,
  ticket_code character varying,
  incident_id integer NOT NULL,
  category_id integer NOT NULL,
  direction character varying NOT NULL,
  assigned_dep_id integer NOT NULL,
  sla_deadline timestamp with time zone,
  is_sla_breached boolean,
  status character varying,
  created_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_by uuid NOT NULL,
  CONSTRAINT ticket_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incident_alert(incident_id),
  CONSTRAINT ticket_incident_id_key UNIQUE (incident_id),
  CONSTRAINT ticket_pkey PRIMARY KEY (ticket_id),
  CONSTRAINT ticket_created_by_fkey FOREIGN KEY (created_by) REFERENCES "user"(user_id) DEFERRABLE,
  CONSTRAINT ticket_assigned_dep_id_fkey FOREIGN KEY (assigned_dep_id) REFERENCES department(dep_id) DEFERRABLE,
  CONSTRAINT ticket_category_id_fkey FOREIGN KEY (category_id) REFERENCES incident_category(category_id) DEFERRABLE
);

CREATE TABLE ticket_task (
  task_id integer NOT NULL,
  ticket_id integer NOT NULL,
  handler_user_id uuid NOT NULL,
  direction character varying NOT NULL,
  assigned_dep_id integer NOT NULL,
  handler_description text,
  submitted_at timestamp with time zone,
  admin_review_notes text,
  is_passed boolean,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ticket_task_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES "user"(user_id) DEFERRABLE,
  CONSTRAINT ticket_task_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(ticket_id) DEFERRABLE,
  CONSTRAINT ticket_task_assigned_dep_id_fkey FOREIGN KEY (assigned_dep_id) REFERENCES department(dep_id) DEFERRABLE,
  CONSTRAINT ticket_task_handler_user_id_fkey FOREIGN KEY (handler_user_id) REFERENCES "user"(user_id) DEFERRABLE,
  CONSTRAINT ticket_task_pkey PRIMARY KEY (task_id)
);

CREATE TABLE user (
  user_id uuid NOT NULL,
  user_code character varying,
  full_name character varying,
  email character varying,
  phone character varying,
  is_active boolean,
  role_id integer NOT NULL,
  dep_id integer NOT NULL
);
ALTER TABLE user ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE role ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE department ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE devicetype ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE device ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE incident_category ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE incident_verification ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE incident_alert ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE ticket ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE ticket_task ENABLE ROW LEVEL SECURITY; -- ON
ALTER TABLE attachment ENABLE ROW LEVEL SECURITY; -- ON
CREATE POLICY "admin_all_user" ON user AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

-- (Da xoa) "authenticated_read_user" USING(true) -- cho phep moi authenticated
-- doc TOAN BO cot (email, phone...) cua TOAN BO nhan su. Thay bang policy sau:
CREATE POLICY "self_read_user" ON user AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "admin_all_role" ON role AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "authenticated_read_role" ON role AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_department" ON department AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "authenticated_read_department" ON department AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_devicetype" ON devicetype AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "authenticated_read_devicetype" ON devicetype AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_device" ON device AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "handler_select_related_device" ON device AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((my_role())::text = 'Handler'::text) AND ((management_ip)::text IN ( SELECT ia.device_ip
   FROM ((incident_alert ia
     JOIN ticket t ON ((t.incident_id = ia.incident_id)))
     JOIN ticket_task tt ON ((tt.ticket_id = t.ticket_id)))
  WHERE (tt.handler_user_id = auth.uid())))));

CREATE POLICY "admin_all_incident_category" ON incident_category AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "authenticated_read_incident_category" ON incident_category AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_incident_verification" ON incident_verification AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "admin_all_incident_alert" ON incident_alert AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "handler_select_related_incident_alert" ON incident_alert AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((my_role())::text = 'Handler'::text) AND (incident_id IN ( SELECT t.incident_id
   FROM (ticket t
     JOIN ticket_task tt ON ((tt.ticket_id = t.ticket_id)))
  WHERE (tt.handler_user_id = auth.uid())))));

CREATE POLICY "admin_all_ticket" ON ticket AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "handler_select_related_ticket" ON ticket AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((my_role())::text = 'Handler'::text) AND (ticket_id IN ( SELECT ticket_task.ticket_id
   FROM ticket_task
  WHERE (ticket_task.handler_user_id = auth.uid())))));

CREATE POLICY "viewer_select_ticket" ON ticket AS PERMISSIVE FOR SELECT TO authenticated
  USING (((my_role())::text = 'Viewer'::text));

CREATE POLICY "admin_all_ticket_task" ON ticket_task AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "handler_select_own_ticket_task" ON ticket_task AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((my_role())::text = 'Handler'::text) AND (handler_user_id = auth.uid())));

CREATE POLICY "viewer_select_ticket_task" ON ticket_task AS PERMISSIVE FOR SELECT TO authenticated
  USING (((my_role())::text = 'Viewer'::text));

CREATE POLICY "admin_all_attachment" ON attachment AS PERMISSIVE FOR ALL TO public
  USING (((my_role())::text = 'Admin'::text))
  WITH CHECK (((my_role())::text = 'Admin'::text));

CREATE POLICY "handler_insert_own_attachment" ON attachment AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((my_role())::text = 'Handler'::text) AND ((entity_type)::text = 'TASK'::text) AND (entity_id IN ( SELECT ticket_task.task_id
   FROM ticket_task
  WHERE (ticket_task.handler_user_id = auth.uid())))));

CREATE POLICY "handler_select_own_attachment" ON attachment AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((my_role())::text = 'Handler'::text) AND ((entity_type)::text = 'TASK'::text) AND (entity_id IN ( SELECT ticket_task.task_id
   FROM ticket_task
  WHERE (ticket_task.handler_user_id = auth.uid())))));

CREATE POLICY "viewer_select_attachment" ON attachment AS PERMISSIVE FOR SELECT TO authenticated
  USING ((((my_role())::text = 'Viewer'::text) AND ((entity_type)::text = 'TASK'::text)));

CREATE OR REPLACE FUNCTION public.create_ticket_with_task(p_incident_id integer, p_category_id integer, p_direction character varying, p_assigned_dep_id integer, p_handler_user_id uuid)
 RETURNS TABLE(out_ticket_id integer, out_ticket_code character varying, out_sla_deadline timestamp without time zone, out_ticket_status character varying, out_task_id integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sla_hours int;
  v_ticket_id int;
  v_ticket_code varchar;
  v_sla_deadline timestamp;
  v_task_id int;
BEGIN
IF EXISTS (SELECT 1 FROM ticket WHERE incident_id = p_incident_id) THEN
  RAISE EXCEPTION 'TICKET_ALREADY_EXISTS';
END IF;
  SELECT sla_hours INTO v_sla_hours FROM incident_category WHERE category_id = p_category_id;
  IF v_sla_hours IS NULL THEN
    RAISE EXCEPTION 'CATEGORY_NOT_FOUND';
  END IF;

  v_sla_deadline := now() + (v_sla_hours || ' hours')::interval;
  v_ticket_code := 'INC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('ticket_code_seq')::text, 4, '0');

  UPDATE incident_alert
  SET is_hvbt = true, verified_by = auth.uid(), verified_at = now(), current_status = 'Ticket_Created'
  WHERE incident_id = p_incident_id;

  INSERT INTO ticket (ticket_code, incident_id, category_id, direction, assigned_dep_id, sla_deadline, status, created_at, created_by)
  VALUES (v_ticket_code, p_incident_id, p_category_id, p_direction, p_assigned_dep_id, v_sla_deadline, 'Assigned', now(), auth.uid())
  RETURNING ticket.ticket_id INTO v_ticket_id;

  INSERT INTO ticket_task (ticket_id, handler_user_id, direction, assigned_dep_id)
  VALUES (v_ticket_id, p_handler_user_id, p_direction, p_assigned_dep_id)
  RETURNING ticket_task.task_id INTO v_task_id;

  RETURN QUERY SELECT v_ticket_id, v_ticket_code, v_sla_deadline, 'Assigned'::varchar, v_task_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public."user" (user_id, email, full_name, role_id, dep_id, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role_id')::int, (SELECT role_id FROM public.role WHERE role_name = 'Viewer')),
    COALESCE((NEW.raw_user_meta_data->>'dep_id')::int, (SELECT dep_id FROM public.department WHERE dep_code = 'OPS')),
    true
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.my_dep_id()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT dep_id
  FROM "user"
  WHERE user_id = auth.uid()
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.reassign_ticket_task(p_ticket_id integer, p_direction character varying, p_assigned_dep_id integer, p_handler_user_id uuid)
 RETURNS TABLE(out_task_id integer, out_ticket_id integer, out_handler_user_id uuid, out_direction character varying, out_assigned_dep_id integer, out_ticket_status character varying)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_status varchar;
  v_task_id int;
  v_latest_submitted_at timestamptz;
  v_latest_is_passed boolean;
BEGIN
  SELECT status INTO v_current_status FROM ticket WHERE ticket_id = p_ticket_id;
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND';
  END IF;
  IF v_current_status = 'Closed' THEN
    RAISE EXCEPTION 'TICKET_ALREADY_CLOSED';
  END IF;

  SELECT submitted_at, is_passed INTO v_latest_submitted_at, v_latest_is_passed
  FROM ticket_task WHERE ticket_id = p_ticket_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_latest_submitted_at IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_SUBMITTED_YET';
  END IF;
  IF v_latest_is_passed IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_REVIEWED_YET';
  END IF;
  IF v_latest_is_passed = true THEN
    RAISE EXCEPTION 'TASK_ALREADY_PASSED';
  END IF;

  INSERT INTO ticket_task (ticket_id, handler_user_id, direction, assigned_dep_id)
  VALUES (p_ticket_id, p_handler_user_id, p_direction, p_assigned_dep_id)
  RETURNING task_id INTO v_task_id;

  UPDATE ticket
  SET direction = p_direction, assigned_dep_id = p_assigned_dep_id, status = 'Assigned'
  WHERE ticket_id = p_ticket_id;

  RETURN QUERY SELECT v_task_id, p_ticket_id, p_handler_user_id, p_direction, p_assigned_dep_id, 'Assigned'::varchar;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.review_ticket_task(p_task_id integer, p_is_passed boolean, p_admin_review_notes text DEFAULT NULL::text)
 RETURNS TABLE(out_task_id integer, out_reviewed_by uuid, out_reviewed_at timestamp without time zone, out_ticket_status character varying, out_ticket_closed_at timestamp without time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_id int;
  v_submitted_at timestamp;
  v_is_passed boolean;
  v_reviewed_at timestamp;
  v_ticket_status varchar;
  v_closed_at timestamp;
BEGIN
   IF my_role() != 'Admin' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  IF p_is_passed = false AND (p_admin_review_notes IS NULL OR p_admin_review_notes = '') THEN
    RAISE EXCEPTION 'REVIEW_NOTES_REQUIRED';
  END IF;

  SELECT ticket_id, submitted_at, is_passed INTO v_ticket_id, v_submitted_at, v_is_passed
  FROM ticket_task WHERE task_id = p_task_id;
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  -- Chan review mot task chua duoc handler nop
  IF v_submitted_at IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_SUBMITTED_YET';
  END IF;

  -- Chan review LAI mot task da co ket qua roi (is_passed da khac NULL)
  IF v_is_passed IS NOT NULL THEN
    RAISE EXCEPTION 'TASK_ALREADY_REVIEWED';
  END IF;

  UPDATE ticket_task
  SET is_passed = p_is_passed, admin_review_notes = p_admin_review_notes,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE task_id = p_task_id
  RETURNING reviewed_at INTO v_reviewed_at;

  IF p_is_passed THEN
    v_ticket_status := 'Closed';
    v_closed_at := now();
    UPDATE ticket SET status = v_ticket_status, closed_at = v_closed_at WHERE ticket_id = v_ticket_id;
  ELSE
    v_ticket_status := 'Assigned';
    UPDATE ticket SET status = v_ticket_status WHERE ticket_id = v_ticket_id;
  END IF;

  RETURN QUERY SELECT p_task_id, auth.uid(), v_reviewed_at, v_ticket_status, v_closed_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_ticket_task(p_task_id integer, p_handler_description text)
 RETURNS TABLE(out_task_id integer, out_submitted_at timestamp without time zone, out_ticket_status character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket_id int;
  v_handler_id uuid;
  v_submitted_at timestamp;
BEGIN
  SELECT ticket_id, handler_user_id INTO v_ticket_id, v_handler_id
  FROM ticket_task WHERE task_id = p_task_id;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'TASK_NOT_FOUND';
  END IF;

  -- Chan neu nguoi goi khong co role Handler (truoc day chi check ownership,
  -- nen mot Viewer bi gan nham handler_user_id van submit duoc)
  IF my_role() != 'Handler' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF v_handler_id != auth.uid() THEN
    RAISE EXCEPTION 'NOT_YOUR_TASK';
  END IF;

  UPDATE ticket_task
  SET handler_description = p_handler_description, submitted_at = now()
  WHERE task_id = p_task_id
  RETURNING submitted_at INTO v_submitted_at;

  UPDATE ticket SET status = 'Pending Review' WHERE ticket_id = v_ticket_id;

  RETURN QUERY SELECT p_task_id, v_submitted_at, 'Pending Review'::varchar;
END;
$function$;

-- Danh ba noi bo an toan (khong co email/phone), dung cho cac man hinh
-- can hien thi ten nguoi khac (lich su xu ly ticket, dropdown chon Handler)
CREATE OR REPLACE FUNCTION public.list_user_directory()
 RETURNS TABLE(user_id uuid, full_name character varying, role_name character varying, dep_id integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.user_id, u.full_name, r.role_name, u.dep_id
  FROM "user" u
  JOIN role r ON r.role_id = u.role_id;
$function$;

-- Cac ham boc lai 7 view dashboard (khong ho tro RLS truc tiep) bang kiem tra
-- role thu cong; da REVOKE SELECT truc tiep vao view khoi authenticated/anon.
CREATE OR REPLACE FUNCTION public.get_dashboard_sla_summary()
 RETURNS SETOF dashboard_sla_summary
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() != 'Admin' THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_sla_summary;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_tickets_by_status()
 RETURNS SETOF dashboard_tickets_by_status
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() NOT IN ('Admin','Viewer') THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_tickets_by_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_tickets_by_priority()
 RETURNS SETOF dashboard_tickets_by_priority
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() NOT IN ('Admin','Viewer') THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_tickets_by_priority;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_tickets_by_department()
 RETURNS SETOF dashboard_tickets_by_department
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() NOT IN ('Admin','Viewer') THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_tickets_by_department;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_ticket_trend()
 RETURNS SETOF dashboard_ticket_trend
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() != 'Viewer' THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_ticket_trend;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_sla_compliance()
 RETURNS SETOF dashboard_sla_compliance
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() != 'Viewer' THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_sla_compliance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_dept_performance()
 RETURNS SETOF dashboard_dept_performance
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF my_role() != 'Viewer' THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  RETURN QUERY SELECT * FROM dashboard_dept_performance;
END;
$function$
