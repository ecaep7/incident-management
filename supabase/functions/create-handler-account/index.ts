import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function passwordFromEmail(email: string) {
  const local = email.split('@')[0]
  return local.length >= 6 ? local : local.padEnd(6, '1')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json()
  const { email, full_name, role_name, dep_id } = body

  if (!email || !full_name || !role_name || !dep_id) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'MISSING_FIELD', message: 'Thiếu trường bắt buộc' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
  const { data: { user: caller } } = await supabaseUser.auth.getUser()
  const { data: callerProfile } = await supabaseUser.from('user').select('role(role_name)').eq('user_id', caller?.id).single()
  if ((callerProfile as any)?.role?.role_name !== 'Admin') {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'NOT_AUTHORIZED', message: 'Chỉ Admin được tạo tài khoản' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: roleRow } = await supabaseAdmin.from('role').select('role_id').eq('role_name', role_name).single()
  if (!roleRow) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'INVALID_ROLE', message: 'Vai trò không hợp lệ' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const password = passwordFromEmail(email)

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role_id: roleRow.role_id, dep_id },
  })

  if (error) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'CREATE_FAILED', message: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ status: 'success', data: { user_id: created.user.id, email, password } }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})