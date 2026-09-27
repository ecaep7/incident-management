import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json()
  const { task_id, handler_description } = body

  if (!task_id || !handler_description) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'MISSING_FIELD', message: 'Thiếu trường bắt buộc' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const { data, error } = await supabase.rpc('submit_ticket_task', {
    p_task_id: task_id,
    p_handler_description: handler_description,
  })

  if (error) {
    const code = error.message.includes('NOT_YOUR_TASK') ? 'NOT_YOUR_TASK'
      : error.message.includes('TASK_NOT_FOUND') ? 'TASK_NOT_FOUND'
      : 'SUBMIT_FAILED'
    return new Response(
      JSON.stringify({ status: 'error', error_code: code, message: error.message }),
      { status: code === 'SUBMIT_FAILED' ? 400 : 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const r = data[0]
  return new Response(
    JSON.stringify({ status: 'success', data: { task_id: r.out_task_id, submitted_at: r.out_submitted_at, ticket_status: r.out_ticket_status } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})