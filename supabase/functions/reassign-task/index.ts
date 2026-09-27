import { createClient } from 'jsr:@supabase/supabase-js@2'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json()
  const { ticket_id, direction, assigned_dep_id, handler_user_id } = body

  if (!ticket_id || !direction || !assigned_dep_id || !handler_user_id) {
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

  const { data, error } = await supabase.rpc('reassign_ticket_task', {
    p_ticket_id: ticket_id,
    p_direction: direction,
    p_assigned_dep_id: assigned_dep_id,
    p_handler_user_id: handler_user_id,
  })

if (error) {
  const code = error.message.includes('TICKET_NOT_FOUND') ? 'TICKET_NOT_FOUND'
    : error.message.includes('TICKET_ALREADY_CLOSED') ? 'TICKET_ALREADY_CLOSED'
    : error.message.includes('TASK_NOT_SUBMITTED_YET') ? 'TASK_NOT_SUBMITTED_YET'
    : error.message.includes('TASK_NOT_REVIEWED_YET') ? 'TASK_NOT_REVIEWED_YET'
    : error.message.includes('TASK_ALREADY_PASSED') ? 'TASK_ALREADY_PASSED'
    : 'REASSIGN_FAILED'
  const status = code === 'TICKET_NOT_FOUND' ? 404 : code === 'REASSIGN_FAILED' ? 400 : 409
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
        task: { task_id: r.out_task_id, ticket_id: r.out_ticket_id, handler_user_id: r.out_handler_user_id, direction: r.out_direction, assigned_dep_id: r.out_assigned_dep_id },
        ticket_status: r.out_ticket_status,
      },
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})