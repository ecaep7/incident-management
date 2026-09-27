import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const body = await req.json()
  const { incident_id, category_id, direction, assigned_dep_id, handler_user_id } = body

  if (!category_id || !direction || !assigned_dep_id || !handler_user_id) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'MISSING_FIELD', message: 'Thiếu trường bắt buộc' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Gọi "dưới danh nghĩa" đúng người đang đăng nhập — chuyển tiếp JWT của họ
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )

  const { data, error } = await supabase.rpc('create_ticket_with_task', {
    p_incident_id: incident_id,
    p_category_id: category_id,
    p_direction: direction,
    p_assigned_dep_id: assigned_dep_id,
    p_handler_user_id: handler_user_id,
  })

  if (error) {
    if (error.message.includes('TICKET_ALREADY_EXISTS')) {
      return new Response(
        JSON.stringify({ status: 'error', error_code: 'TICKET_ALREADY_EXISTS', message: 'Cảnh báo này đã có ticket, không thể tạo thêm' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'CREATE_TICKET_FAILED', message: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const r = data[0]
  return new Response(
    JSON.stringify({
      status: 'success',
      data: {
        ticket: { ticket_id: r.out_ticket_id, ticket_code: r.out_ticket_code, sla_deadline: r.out_sla_deadline, status: r.out_ticket_status },
        task: { task_id: r.out_task_id },
      },
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})