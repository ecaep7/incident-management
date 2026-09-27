import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // 1. Kiểm tra "chìa khóa" của Hệ thống nguồn
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey || apiKey !== Deno.env.get('INGEST_API_KEY')) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'UNAUTHORIZED', message: 'Sai hoặc thiếu X-API-Key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 2. Đọc dữ liệu Hệ thống nguồn gửi lên
  const body = await req.json()
  const { source_system, source_event_id, device_ip, severity_level, alert_summary, details } = body

  if (!source_system || !source_event_id || !device_ip) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'MISSING_FIELD', message: 'Thiếu trường bắt buộc' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 3. Dùng quyền cao nhất — vì đây là máy gọi vào, không có JWT/RLS nào áp dụng được
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 4. Chống trùng lặp
  const { data: existing } = await supabase
    .from('incident_alert')
    .select('incident_id, received_at, current_status')
    .eq('source_system', source_system)
    .eq('source_event_id', source_event_id)
    .maybeSingle()

  if (existing) {
    return new Response(
      JSON.stringify({ status: 'success', message: 'Duplicate event, returning existing alert', data: existing }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 5. Kiểm tra thiết bị đã đăng ký chưa
  const { data: device } = await supabase
    .from('device')
    .select('device_id')
    .eq('management_ip', device_ip)
    .maybeSingle()

  if (!device) {
    return new Response(
      JSON.stringify({
        status: 'error', error_code: 'DEVICE_NOT_REGISTERED',
        message: `device_ip ${device_ip} chưa được đăng ký`,
        details: { field: 'device_ip' },
      }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 6. Ghi cảnh báo mới
  const { data: newAlert, error } = await supabase
    .from('incident_alert')
    .insert({
      source_system, source_event_id, device_ip, severity_level, alert_summary,
      raw_payload: JSON.stringify(details ?? {}),
      received_at: new Date().toISOString(),
      current_status: 'NEW',
    })
    .select('incident_id, received_at, current_status')
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'INTERNAL_ERROR', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ status: 'success', message: 'Alert ingested successfully', data: newAlert }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  )
})