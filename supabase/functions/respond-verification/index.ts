import { createClient } from 'jsr:@supabase/supabase-js@2'

// Tiep nhan phan hoi xac minh tu he thong ben ngoai (trung tam dieu hanh mang).
// Xac thuc bang X-API-Key (khong co tai khoan dang nhap tren web).
// Ho tro 2 dinh dang:
//   - application/json     : { verification_id, response_payload }            (chi van ban, nhu cu)
//   - multipart/form-data  : verification_id, response_payload, files (0..5)  (kem tep bang chung)
// Tep duoc luu vao bucket 'attachments' o thu muc verification/<id>/ va ghi vao bang attachment
// voi entity_type = 'VERIFICATION'. Noi dung tra loi chi duoc cap nhat khi tat ca tep da luu xong.

const MAX_FILES = 5
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB moi tep
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|csv|txt|log|png|jpe?g|gif|webp|zip)$/i

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fail = (status: number, error_code: string, message: string) =>
  json(status, { status: 'error', error_code, message })

const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')

Deno.serve(async (req) => {
  const apiKey = req.headers.get('X-API-Key')
  if (!apiKey || apiKey !== Deno.env.get('INGEST_API_KEY')) {
    return fail(401, 'UNAUTHORIZED', 'Sai hoặc thiếu X-API-Key')
  }

  // 1. Doc du lieu theo dinh dang gui len
  let verificationId = ''
  let responsePayload = ''
  let files: File[] = []
  const contentType = req.headers.get('Content-Type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      verificationId = String(form.get('verification_id') ?? '').trim()
      responsePayload = String(form.get('response_payload') ?? '').trim()
      files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
    } else {
      const body = await req.json()
      verificationId = String(body.verification_id ?? '').trim()
      responsePayload = String(body.response_payload ?? '').trim()
    }
  } catch {
    return fail(400, 'INVALID_BODY', 'Dữ liệu gửi lên không đúng định dạng JSON hoặc form-data')
  }

  if (!verificationId || !responsePayload) {
    return fail(400, 'MISSING_FIELD', 'Thiếu trường bắt buộc (verification_id, response_payload)')
  }
  if (!/^\d+$/.test(verificationId)) {
    return fail(400, 'INVALID_FIELD', 'verification_id phải là số nguyên')
  }

  // 2. Kiem tra tep truoc khi luu bat cu thu gi
  if (files.length > MAX_FILES) {
    return fail(400, 'TOO_MANY_FILES', `Chỉ được gửi tối đa ${MAX_FILES} tệp`)
  }
  for (const f of files) {
    if (f.size > MAX_SIZE) return fail(400, 'FILE_TOO_LARGE', `Tệp "${f.name}" vượt quá 10 MB`)
    if (!ALLOWED_EXT.test(f.name)) return fail(400, 'FILE_TYPE_NOT_ALLOWED', `Định dạng tệp "${f.name}" không được chấp nhận`)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 3. Yeu cau xac minh phai ton tai
  const { data: existing } = await supabase
    .from('incident_verification').select('verification_id').eq('verification_id', verificationId).maybeSingle()
  if (!existing) {
    return fail(404, 'VERIFICATION_NOT_FOUND', 'Không tìm thấy yêu cầu xác minh này')
  }

  // 4. Luu tep; neu loi giua chung thi xoa cac tep / ban ghi da luu de khong de lai du lieu do dang
  const savedPaths: string[] = []
  const savedIds: number[] = []
  const rollback = async () => {
    if (savedIds.length) await supabase.from('attachment').delete().in('attachment_id', savedIds)
    if (savedPaths.length) await supabase.storage.from('attachments').remove(savedPaths)
  }

  for (const f of files) {
    const path = `verification/${verificationId}/${Date.now()}-${safeName(f.name)}`
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, f, { contentType: f.type || undefined })
    if (upErr) { await rollback(); return fail(500, 'UPLOAD_FAILED', `Không lưu được tệp "${f.name}": ${upErr.message}`) }
    savedPaths.push(path)

    const { data: att, error: insErr } = await supabase.from('attachment')
      .insert({ entity_id: Number(verificationId), entity_type: 'VERIFICATION', file_name: f.name, file_url: path, uploaded_at: new Date().toISOString() })
      .select('attachment_id').single()
    if (insErr || !att) { await rollback(); return fail(500, 'INSERT_FAILED', `Không ghi được thông tin tệp "${f.name}"`) }
    savedIds.push(att.attachment_id)
  }

  // 5. Cap nhat noi dung tra loi
  const { data, error } = await supabase
    .from('incident_verification')
    .update({ response_payload: responsePayload, responded_at: new Date().toISOString() })
    .eq('verification_id', verificationId)
    .select('verification_id, responded_at')
    .single()

  if (error || !data) {
    await rollback()
    return fail(500, 'UPDATE_FAILED', 'Không cập nhật được phản hồi xác minh')
  }

  return json(200, {
    status: 'success',
    data: { verification_id: data.verification_id, responded_at: data.responded_at, attachments: savedIds.length },
  })
})
