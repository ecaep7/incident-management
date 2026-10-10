-- Fix #15: BO DU LIEU THU de danh gia goi y AI (chi dung cho khoa luan, du lieu GIA LAP).
--
-- Gom 2 phan:
--   (1) Bang ai_test_case: luu DAP AN DUNG cua tung canh bao thu (ket luan, loai su co, huong xu ly).
--       Doc lap voi luong loi; chi Admin doc duoc.
--   (2) 40 canh bao thu (source_system = 'TEST-AI'), trang thai NEW -> n8n se tu phan tich dan.
--       Phan bo: 20 su co that (du 7 loai) / 12 canh bao sai / 8 ca mo ho can xac minh.
--
-- Quy uoc dap an "huong xu ly":
--   ONSITE = can nguoi den tan noi thao tac vat ly (cach ly/cai lai may, kiem tra phan cung, cong/cap, console)
--   SYSTEM = xu ly tu xa qua he thong (chan IP, doi/khoi phuc cau hinh, khoa tai khoan, bat chong DDoS)
--
-- Chay 1 lan trong SQL Editor. Chay lai se KHONG tao trung (bo qua case_code da co).
-- Cuoi file co cau truy van danh gia va cau don dep (dang chu thich).

-- ============================================================
-- 1. Bang dap an
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_test_case (
  case_code            varchar PRIMARY KEY,
  incident_id          integer NOT NULL UNIQUE REFERENCES public.incident_alert(incident_id),
  expected_verdict     varchar NOT NULL CHECK (expected_verdict IN ('TRUE_INCIDENT', 'FALSE_POSITIVE', 'NEED_VERIFICATION')),
  expected_category_id integer REFERENCES public.incident_category(category_id),
  expected_direction   varchar CHECK (expected_direction IN ('ONSITE', 'SYSTEM')),
  difficulty           varchar CHECK (difficulty IN ('Dễ', 'Trung bình', 'Khó')),
  scenario_note        text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_test_case ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_ai_test_case" ON public.ai_test_case;
CREATE POLICY "admin_select_ai_test_case" ON public.ai_test_case
  AS PERMISSIVE FOR SELECT TO authenticated USING (public.my_role() = 'Admin');
REVOKE ALL ON public.ai_test_case FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_test_case FROM authenticated;
GRANT SELECT ON public.ai_test_case TO authenticated;

-- ============================================================
-- 2. 40 canh bao thu + dap an
-- ============================================================
DROP TABLE IF EXISTS _cases;
CREATE TEMP TABLE _cases (
  case_code varchar, device_ip varchar, severity varchar, summary varchar, payload jsonb,
  verdict varchar, category_id int, direction varchar, difficulty varchar, note text, minutes_ago int
);

INSERT INTO _cases VALUES
-- ---------- SU CO THAT (20) ----------
-- Brute-force (1)
('T01','10.14.22.1','HIGH','Phát hiện 320 lần đăng nhập SSH thất bại trong 5 phút từ IP 203.0.113.45',
 '{"src_ip":"203.0.113.45","dst_port":22,"failed_logins":320,"window_minutes":5,"usernames_tried":["admin","root","cisco"]}',
 'TRUE_INCIDENT',1,'SYSTEM','Dễ','Brute-force SSH điển hình từ IP ngoài; chặn IP/siết ACL từ xa',120),
('T02','10.14.30.25','HIGH','Hàng loạt đăng nhập IMAP thất bại vào nhiều hộp thư từ cùng một IP',
 '{"src_ip":"198.51.100.77","protocol":"IMAP","failed_logins":540,"distinct_accounts":63,"window_minutes":10}',
 'TRUE_INCIDENT',1,'SYSTEM','Trung bình','Password spraying vào server mail; khóa IP, bật giới hạn đăng nhập',117),
('T03','10.20.5.254','HIGH','Đăng nhập VPN thất bại liên tục vào tài khoản quản trị firewall',
 '{"src_ip":"192.0.2.150","service":"SSL-VPN","failed_logins":210,"target_account":"fwadmin","window_minutes":15}',
 'TRUE_INCIDENT',1,'SYSTEM','Dễ','Dò mật khẩu tài khoản quản trị qua VPN',114),
('T04','10.30.1.1','MEDIUM','Nhiều lần đăng nhập Telnet thất bại vào router chi nhánh Đà Nẵng',
 '{"src_ip":"203.0.113.201","dst_port":23,"failed_logins":95,"window_minutes":30}',
 'TRUE_INCIDENT',1,'SYSTEM','Trung bình','Số lần ít hơn nhưng vẫn là dò mật khẩu; Telnet còn mở',111),
-- Loi cau hinh thiet bi (2)
('T05','10.14.22.105','MEDIUM','VLAN 120 bị xóa khỏi trunk sau thay đổi cấu hình, nhiều máy mất kết nối',
 '{"vlan_id":120,"change":"trunk allowed list removed","changed_by":"netadmin","change_ticket":null,"affected_hosts":46}',
 'TRUE_INCIDENT',2,'SYSTEM','Trung bình','Thay đổi KHÔNG có phiếu yêu cầu và gây gián đoạn -> lỗi cấu hình; khôi phục cấu hình từ xa',108),
('T06','10.20.5.1','HIGH','Spanning-tree thay đổi root bridge liên tục, mạng chi nhánh HCM chập chờn',
 '{"stp_topology_changes":38,"window_minutes":10,"new_root":"unknown-mac","port":"Gi1/0/24"}',
 'TRUE_INCIDENT',2,'ONSITE','Khó','Nghi thiết bị lạ cắm vào cổng Gi1/0/24; cần kiểm tra tại chỗ',105),
('T07','10.20.6.20','MEDIUM','AP tầng 3 HCM phát sai SSID và không cấp được IP cho người dùng',
 '{"ssid_broadcast":"default","dhcp_failures":120,"config_version":"factory-reset"}',
 'TRUE_INCIDENT',2,'ONSITE','Trung bình','AP bị reset về mặc định; cần kiểm tra/cấu hình lại tại chỗ',102),
-- DDoS (3)
('T08','10.14.22.254','CRITICAL','Lưu lượng SYN tăng đột biến 40 lần vào firewall biên Hà Nội',
 '{"pps":1800000,"baseline_pps":45000,"syn_ratio":0.97,"distinct_src_ips":12450}',
 'TRUE_INCIDENT',3,'SYSTEM','Dễ','SYN flood từ hàng nghìn nguồn; bật chống DDoS từ xa',99),
('T09','10.20.5.254','CRITICAL','Băng thông vào firewall HCM bão hòa bởi lưu lượng UDP 53 phản xạ',
 '{"inbound_gbps":9.4,"link_capacity_gbps":10,"protocol":"UDP","src_port":53,"distinct_src_ips":8300}',
 'TRUE_INCIDENT',3,'SYSTEM','Dễ','DNS amplification',96),
('T10','10.14.30.25','HIGH','Số kết nối HTTP tới cổng webmail tăng gấp 25 lần từ nhiều quốc gia',
 '{"rps":15000,"baseline_rps":600,"distinct_src_ips":5200,"top_path":"/login"}',
 'TRUE_INCIDENT',3,'SYSTEM','Trung bình','HTTP flood tầng ứng dụng',93),
-- Quet cong bat thuong (4)
('T11','10.14.22.254','MEDIUM','IP bên ngoài quét tuần tự 65.000 cổng của firewall biên trong 3 phút',
 '{"src_ip":"198.51.100.33","ports_scanned":65000,"window_minutes":3,"scan_type":"SYN"}',
 'TRUE_INCIDENT',4,'SYSTEM','Dễ','Quét cổng toàn dải từ nguồn lạ',90),
('T12','10.20.5.50','HIGH','Máy chủ kế toán HCM bị quét cổng từ một máy trạm nội bộ không quen thuộc',
 '{"src_ip":"10.20.7.88","src_hostname":"unknown","ports_scanned":1200,"targets":["10.20.5.50"]}',
 'TRUE_INCIDENT',4,'SYSTEM','Trung bình','Quét từ nội bộ, nguồn không phải hệ thống giám sát',87),
('T13','10.30.1.1','MEDIUM','Dò quét các cổng quản trị SNMP/SSH/Telnet của router Đà Nẵng',
 '{"src_ip":"203.0.113.90","ports":[22,23,161,443,8443],"attempts":480}',
 'TRUE_INCIDENT',4,'SYSTEM','Trung bình','Quét có chủ đích vào cổng quản trị',84),
-- Truy cap trai phep (5)
('T14','10.14.22.1','HIGH','Đăng nhập thành công tài khoản admin router từ IP nước ngoài lúc 2 giờ sáng',
 '{"src_ip":"185.220.101.4","geo":"NL","account":"admin","login_time":"02:13","prior_failed_logins":0}',
 'TRUE_INCIDENT',5,'SYSTEM','Dễ','Đăng nhập thành công từ IP không xác định; khóa tài khoản, đổi mật khẩu',81),
('T15','10.14.30.25','HIGH','Tài khoản email nội bộ đăng nhập thành công đồng thời từ Hà Nội và nước ngoài',
 '{"account":"ketoan01","locations":["Hà Nội","BR"],"interval_minutes":4,"mfa":false}',
 'TRUE_INCIDENT',5,'SYSTEM','Trung bình','Impossible travel',78),
('T16','10.20.5.254','HIGH','Tài khoản đã nghỉ việc đăng nhập thành công vào firewall HCM',
 '{"account":"nv_old_2025","account_status":"should_be_disabled","src_ip":"10.20.9.14","result":"success"}',
 'TRUE_INCIDENT',5,'SYSTEM','Trung bình','Tài khoản lẽ ra đã bị vô hiệu hóa',75),
-- Ma doc (6)
('T17','10.20.5.50','CRITICAL','Phát hiện mã độc mã hóa tệp trên máy chủ kế toán HCM',
 '{"detection":"Ransom.Win32.LockBit","files_encrypted":1340,"process":"svch0st.exe","action":"quarantine_failed"}',
 'TRUE_INCIDENT',6,'ONSITE','Dễ','Ransomware; cần cách ly và xử lý máy tại chỗ',72),
('T18','10.14.30.25','HIGH','Server mail Hà Nội kết nối định kỳ tới máy chủ điều khiển trong danh sách đen',
 '{"dst_ip":"192.0.2.66","threat_intel":"C2 - Emotet","beacon_interval_s":60,"process":"w3wp.exe"}',
 'TRUE_INCIDENT',6,'ONSITE','Trung bình','Beaconing C2; cần cách ly và rà soát máy chủ',69),
('T19','10.14.23.10','HIGH','Phát hiện firmware lạ có chữ ký mã độc trên AP tầng 5',
 '{"firmware_hash":"9f2c...e1","signature_match":"IoT.Mirai.variant","reboots_last_hour":6}',
 'TRUE_INCIDENT',6,'ONSITE','Khó','Thiết bị IoT nhiễm mã độc; cần nạp lại firmware tại chỗ',66),
-- Quet cong dinh ky (7)
('T20','10.14.22.254','LOW','Cùng một IP bên ngoài quét các cổng phổ biến của firewall vào 0h mỗi ngày',
 '{"src_ip":"198.51.100.12","ports":[21,22,80,443,3389],"occurrences_last_30d":30,"schedule":"daily 00:00"}',
 'TRUE_INCIDENT',7,'SYSTEM','Khó','Quét lặp theo chu kỳ từ nguồn ngoài -> loại "Quét cổng định kỳ", ưu tiên thấp',63),

-- ---------- CANH BAO SAI (12) ----------
('F01','10.14.22.105','LOW','Thay đổi cấu hình VLAN trên switch lõi Hà Nội',
 '{"vlan_id":130,"change":"add vlan","changed_by":"netadmin","change_ticket":"CR-2026-131","window":"maintenance 22:00-23:00"}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Thay đổi có phiếu CR và trong khung bảo trì',60),
('F02','10.14.22.254','LOW','Quét cổng từ máy chủ giám sát nội bộ vào firewall biên',
 '{"src_ip":"10.14.40.5","src_hostname":"nms-scanner-01","ports_scanned":1000,"schedule":"weekly"}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Quét định kỳ của chính hệ thống giám sát',58),
('F03','10.14.30.25','LOW','3 lần đăng nhập thất bại rồi thành công vào hộp thư từ IP nội bộ',
 '{"account":"hanhchinh02","src_ip":"10.14.25.31","failed_logins":3,"then":"success","window_minutes":2}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Người dùng gõ sai mật khẩu',56),
('F04','10.20.5.50','MEDIUM','Lưu lượng ra ngoài tăng cao từ máy chủ kế toán lúc 1 giờ sáng',
 '{"egress_mbps":85,"baseline_mbps":5,"dst":"backup.noibo.local","schedule_match":"nightly-backup 01:00"}',
 'FALSE_POSITIVE',NULL,NULL,'Trung bình','Trùng lịch sao lưu đêm tới đích sao lưu nội bộ',54),
('F05','10.14.22.1','LOW','Router biên Hà Nội khởi động lại',
 '{"reason":"scheduled firmware upgrade","change_ticket":"CR-2026-140","uptime_before_days":210}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Khởi động lại theo kế hoạch nâng cấp',52),
('F06','10.20.6.20','LOW','AP tầng 3 HCM mất kết nối 2 phút rồi tự kết nối lại',
 '{"downtime_s":120,"cause":"power maintenance","building_notice":"Bảo trì điện tầng 3, 14:00-14:05"}',
 'FALSE_POSITIVE',NULL,NULL,'Trung bình','Do bảo trì điện đã thông báo',50),
('F07','10.14.22.254','MEDIUM','Lưu lượng HTTPS tăng gấp 3 lần vào firewall biên',
 '{"rps":1800,"baseline_rps":600,"top_destination":"portal.noibo.local/dang-ky","event":"mở đăng ký dịch vụ đợt 2"}',
 'FALSE_POSITIVE',NULL,NULL,'Khó','Tăng tải do sự kiện kinh doanh, nguồn đa dạng hợp lệ',48),
('F08','10.30.1.1','LOW','Cảnh báo cấu hình NTP thay đổi trên router Đà Nẵng',
 '{"change":"ntp server updated","changed_by":"automation-bot","change_ticket":"CR-2026-145"}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Thay đổi tự động có phiếu',46),
('F09','10.14.23.10','LOW','AP tầng 5 phát hiện SSID trùng tên ở khu vực lân cận',
 '{"ssid":"VNPT-Guest","bssid_owner":"10.14.23.11","owner_registered":true}',
 'FALSE_POSITIVE',NULL,NULL,'Trung bình','SSID trùng do AP chính chủ khác trong cùng hệ thống',44),
('F10','10.20.5.1','LOW','Cổng Gi1/0/12 trên switch HCM chuyển trạng thái down/up',
 '{"port":"Gi1/0/12","flaps":1,"connected_device":"máy in tầng 2","note":"người dùng rút cáp di chuyển máy in"}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Rút cắm cáp thông thường',42),
('F11','10.14.30.25','MEDIUM','Phần mềm diệt virus trên server mail cảnh báo tệp đính kèm nghi ngờ',
 '{"file":"bao_cao_Q3.xlsm","verdict_after_sandbox":"clean","sandbox":"passed","action":"released"}',
 'FALSE_POSITIVE',NULL,NULL,'Trung bình','Sandbox xác nhận sạch',40),
('F12','10.14.22.105','LOW','Switch lõi Hà Nội ghi nhận CPU 85% trong 1 phút',
 '{"cpu_percent":85,"duration_s":60,"cause":"scheduled config backup job","recovered":true}',
 'FALSE_POSITIVE',NULL,NULL,'Dễ','Tác vụ sao lưu cấu hình định kỳ',38),

-- ---------- CA MO HO, CAN XAC MINH (8) ----------
('V01','10.20.5.50','MEDIUM','Lưu lượng ra ngoài tăng đột biến từ máy chủ kế toán tới IP chưa xác định',
 '{"egress_mbps":48,"baseline_mbps":6,"dst":"198.51.100.20","protocol":"HTTPS","schedule_match":null}',
 'NEED_VERIFICATION',NULL,NULL,'Trung bình','Có thể là đồng bộ dữ liệu hợp lệ hoặc rò rỉ dữ liệu',36),
('V02','10.14.22.1','MEDIUM','Tài khoản quản trị đăng nhập router ngoài giờ hành chính từ IP nội bộ',
 '{"account":"netadmin","src_ip":"10.14.25.40","login_time":"21:40","change_ticket":null}',
 'NEED_VERIFICATION',NULL,NULL,'Khó','Có thể là trực ca xử lý sự cố; cần xác minh với người trực',34),
('V03','10.20.6.20','MEDIUM','AP tầng 3 HCM phát hiện thiết bị lạ kết nối vào mạng nội bộ',
 '{"mac":"3C:5A:B4:11:22:33","vendor":"unknown","vlan":"staff","registered":false}',
 'NEED_VERIFICATION',NULL,NULL,'Trung bình','Có thể là thiết bị cá nhân của nhân viên mới',32),
('V04','10.14.30.25','MEDIUM','Một hộp thư gửi 900 email ra ngoài trong 1 giờ',
 '{"account":"marketing01","sent":900,"baseline_per_hour":40,"recipients_domain_count":850}',
 'NEED_VERIFICATION',NULL,NULL,'Khó','Có thể là chiến dịch marketing hoặc tài khoản bị chiếm để gửi spam',30),
('V05','10.20.5.254','LOW','Quy tắc firewall HCM bị thay đổi, mở thêm cổng 8443',
 '{"rule":"allow any -> 10.20.5.50:8443","changed_by":"fwadmin","change_ticket":null}',
 'NEED_VERIFICATION',NULL,NULL,'Trung bình','Thay đổi bởi quản trị hợp lệ nhưng thiếu phiếu yêu cầu',28),
('V06','10.30.1.1','MEDIUM','Router Đà Nẵng ghi nhận độ trễ tăng cao và mất gói 15%',
 '{"latency_ms":340,"baseline_ms":25,"packet_loss_pct":15,"uplink":"ISP-B"}',
 'NEED_VERIFICATION',NULL,NULL,'Khó','Có thể do sự cố nhà mạng hoặc tấn công; cần hỏi nhà cung cấp',26),
('V07','10.14.22.105','MEDIUM','Switch lõi Hà Nội phát hiện địa chỉ MAC trùng trên hai cổng khác nhau',
 '{"mac":"00:1A:2B:3C:4D:5E","ports":["Gi1/0/3","Gi2/0/17"],"duration_minutes":12}',
 'NEED_VERIFICATION',NULL,NULL,'Khó','Có thể do vòng lặp mạng, máy ảo di chuyển hoặc giả mạo MAC',24),
('V08','10.14.23.10','LOW','AP tầng 5 ghi nhận số lần xác thực WPA thất bại tăng nhẹ',
 '{"auth_failures":25,"baseline":5,"window_minutes":60,"distinct_clients":4}',
 'NEED_VERIFICATION',NULL,NULL,'Trung bình','Có thể do đổi mật khẩu Wi-Fi gần đây hoặc dò mật khẩu',22);

-- Tao canh bao (bo qua ca da tao truoc do)
INSERT INTO public.incident_alert (source_system, source_event_id, device_ip, severity_level, alert_summary, raw_payload, received_at, current_status)
SELECT 'TEST-AI', 'TEST-AI-' || c.case_code, c.device_ip, c.severity, c.summary, c.payload::text,
       now() - make_interval(mins => c.minutes_ago), 'NEW'
FROM _cases c
WHERE NOT EXISTS (SELECT 1 FROM public.ai_test_case t WHERE t.case_code = c.case_code)
  AND NOT EXISTS (SELECT 1 FROM public.incident_alert a WHERE a.source_system = 'TEST-AI' AND a.source_event_id = 'TEST-AI-' || c.case_code);

-- Ghi dap an
INSERT INTO public.ai_test_case (case_code, incident_id, expected_verdict, expected_category_id, expected_direction, difficulty, scenario_note)
SELECT c.case_code, a.incident_id, c.verdict, c.category_id, c.direction, c.difficulty, c.note
FROM _cases c
JOIN public.incident_alert a ON a.source_system = 'TEST-AI' AND a.source_event_id = 'TEST-AI-' || c.case_code
ON CONFLICT (case_code) DO NOTHING;

DROP TABLE IF EXISTS _cases;

-- ============================================================
-- 3. (Tham khao) DANH GIA - chay rieng sau khi n8n phan tich xong
-- ============================================================
-- 3a. Bang chi tiet tung ca:
-- WITH s AS (
--   SELECT DISTINCT ON (incident_id) * FROM ai_suggestion WHERE status = 'OK' ORDER BY incident_id, created_at DESC
-- )
-- SELECT t.case_code, t.difficulty, t.expected_verdict, s.verdict AS ai_verdict,
--        t.expected_category_id, s.suggested_category_id AS ai_category,
--        t.expected_direction, s.suggested_direction AS ai_direction,
--        s.confidence, s.latency_ms, (s.verdict = t.expected_verdict) AS dung_ket_luan, s.reasoning
-- FROM ai_test_case t LEFT JOIN s ON s.incident_id = t.incident_id
-- ORDER BY t.case_code;
--
-- 3b. Tong hop so lieu:
-- WITH s AS (
--   SELECT DISTINCT ON (incident_id) * FROM ai_suggestion WHERE status = 'OK' ORDER BY incident_id, created_at DESC
-- ), j AS (
--   SELECT t.*, s.verdict, s.suggested_category_id, s.suggested_direction, s.confidence, s.latency_ms
--   FROM ai_test_case t JOIN s ON s.incident_id = t.incident_id
-- )
-- SELECT
--   count(*)                                                                         AS so_ca_da_phan_tich,
--   round(100.0 * avg((verdict = expected_verdict)::int), 1)                         AS ty_le_dung_ket_luan,
--   round(100.0 * avg((suggested_category_id = expected_category_id)::int)
--         FILTER (WHERE expected_verdict = 'TRUE_INCIDENT' AND verdict = 'TRUE_INCIDENT'), 1) AS ty_le_dung_loai_su_co,
--   round(100.0 * avg((suggested_direction = expected_direction)::int)
--         FILTER (WHERE expected_verdict = 'TRUE_INCIDENT' AND verdict = 'TRUE_INCIDENT'), 1) AS ty_le_dung_huong_xu_ly,
--   round(avg(confidence) FILTER (WHERE verdict = expected_verdict), 2)              AS tin_cay_tb_khi_dung,
--   round(avg(confidence) FILTER (WHERE verdict <> expected_verdict), 2)             AS tin_cay_tb_khi_sai,
--   percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)                          AS thoi_gian_phan_hoi_trung_vi_ms
-- FROM j;
--
-- 3c. Ma tran nham lan (dap an x AI):
-- WITH s AS (
--   SELECT DISTINCT ON (incident_id) * FROM ai_suggestion WHERE status = 'OK' ORDER BY incident_id, created_at DESC
-- )
-- SELECT t.expected_verdict AS dap_an, s.verdict AS ai_ket_luan, count(*)
-- FROM ai_test_case t JOIN s ON s.incident_id = t.incident_id
-- GROUP BY 1, 2 ORDER BY 1, 2;

-- ============================================================
-- 4. (Tham khao) DON DEP du lieu thu - chi chay khi muon xoa
--    (khong xoa canh bao nao da duoc tao ticket)
-- ============================================================
--    Luu y: fix16 da doi source_system cua du lieu thu tu 'TEST-AI' sang 'SIEM'
--    (de AI khong nhan ra day la du lieu thu), nen phai loc theo source_event_id.
-- DELETE FROM ai_test_case;
-- DELETE FROM ai_eval_archive WHERE incident_id IN (SELECT incident_id FROM incident_alert WHERE source_event_id LIKE 'TEST-AI-%');
-- DELETE FROM ai_suggestion WHERE incident_id IN (SELECT incident_id FROM incident_alert WHERE source_event_id LIKE 'TEST-AI-%');
-- DELETE FROM incident_verification WHERE incident_id IN (SELECT incident_id FROM incident_alert WHERE source_event_id LIKE 'TEST-AI-%');
-- DELETE FROM incident_alert a WHERE a.source_event_id LIKE 'TEST-AI-%'
--   AND NOT EXISTS (SELECT 1 FROM ticket t WHERE t.incident_id = a.incident_id);