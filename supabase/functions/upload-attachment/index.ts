import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const entityType = formData.get('entity_type') as string
  const entityId = formData.get('entity_id') as string
  const fileName = (formData.get('file_name') as string) || file?.name

  if (!file || !entityType || !entityId) {
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

  let allowed = false
  if (entityType === 'TASK') {
    const { data } = await supabaseUser.from('ticket_task').select('task_id').eq('task_id', entityId).maybeSingle()
    allowed = !!data
  } else if (entityType === 'VERIFICATION') {
    const { data } = await supabaseUser.from('incident_verification').select('verification_id').eq('verification_id', entityId).maybeSingle()
    allowed = !!data
  }

  if (!allowed) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'NOT_AUTHORIZED', message: 'Không có quyền đính kèm vào mục này' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const safeFileName = fileName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')

  const storagePath = `${entityType.toLowerCase()}/${entityId}/${Date.now()}-${safeFileName}`
  const { error: uploadError } = await supabaseAdmin.storage.from('attachments').upload(storagePath, file)
  if (uploadError) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'UPLOAD_FAILED', message: uploadError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: newAttachment, error: insertError } = await supabaseAdmin
    .from('attachment')
    .insert({ entity_id: Number(entityId), entity_type: entityType, file_name: fileName, file_url: storagePath, uploaded_at: new Date().toISOString() })
    .select().single()

  if (insertError) {
    return new Response(
      JSON.stringify({ status: 'error', error_code: 'INSERT_FAILED', message: insertError.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ status: 'success', data: newAttachment }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})