import { createClient } from 'jsr:@supabase/supabase-js@2'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json()
  const { task_id, is_passed, admin_review_notes } = body

  if (task_id === undefined || is_passed === undefined) {
    const missing = []
    if (task_id === undefined) missing.push('task_id')
    if (is_passed === undefined) missing.push('is_passed')
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'MISSING_FIELD', message: `Thiếu trường: ${missing.join(', ')}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const { data, error } = await supabase.rpc('review_ticket_task', {
    p_task_id: task_id,
    p_is_passed: is_passed,
    p_admin_review_notes: admin_review_notes ?? null,
  })

  if (error) {
    const code = error.message.includes('NOT_AUTHORIZED') ? 'NOT_AUTHORIZED'
      : error.message.includes('REVIEW_NOTES_REQUIRED') ? 'REVIEW_NOTES_REQUIRED'
      : error.message.includes('TASK_NOT_FOUND') ? 'TASK_NOT_FOUND'
      : 'REVIEW_FAILED'
    const status = code === 'TASK_NOT_FOUND' ? 404 : code === 'NOT_AUTHORIZED' ? 403 : 400
    return new Response(
      JSON.stringify({ status: 'error', error_code: code, message: error.message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const r = data[0]
  return new Response(
    JSON.stringify({
      status: 'success',
      data: {
        task_id: r.out_task_id,
        reviewed_by: r.out_reviewed_by,
        reviewed_at: r.out_reviewed_at,
        ticket_status: r.out_ticket_status,
        ...(r.out_ticket_closed_at ? { ticket_closed_at: r.out_ticket_closed_at } : {}),
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})