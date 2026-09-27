import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey || apiKey !== Deno.env.get('INGEST_API_KEY')) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'UNAUTHORIZED', message: 'Sai hoặc thiếu X-API-Key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await req.json()
  const { verification_id, response_payload } = body

  if (!verification_id || !response_payload) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'MISSING_FIELD', message: 'Thiếu trường bắt buộc' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data, error } = await supabase
    .from('incident_verification')
    .update({ response_payload, responded_at: new Date().toISOString() })
    .eq('verification_id', verification_id)
    .select()
    .single()

  if (error || !data) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'VERIFICATION_NOT_FOUND', message: 'Không tìm thấy yêu cầu xác minh này' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ status: 'success', data: { verification_id: data.verification_id, responded_at: data.responded_at } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})