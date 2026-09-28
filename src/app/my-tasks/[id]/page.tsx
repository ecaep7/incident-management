'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SeverityTag, TaskResultTag } from '@/components/Tag'
import { SlaBadge, getSlaState } from '@/components/SlaBadge'
import { CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const SUBMIT_TASK_URL = 'https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/submit-task'
const UPLOAD_ATTACHMENT_URL = 'https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/upload-attachment'

export default function MyTaskDetailPage() {
  const { loading: loadingProfile } = useProfile()
  const params = useParams()
  const taskId = params.id as string

  const [task, setTask] = useState<any>(null)
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function loadTask() {
    const { data } = await supabase
      .from('ticket_task')
      .select('*, ticket(ticket_code, direction, status, sla_deadline, closed_at, created_at, incident_category(category_name, priority_level, sla_hours), department(dep_name), incident_alert(alert_summary, severity_level, device_ip, source_system, received_at, device(device_code, device_name, location)))')
      .eq('task_id', taskId)
      .single()
    setTask(data)
    setLoadingData(false)
  }

  useEffect(() => { if (taskId) loadTask() }, [taskId])

  async function handleSubmit() {
    if (!description) { setMessage('Cần nhập mô tả xử lý'); return }
    setSubmitting(true)
    setMessage('')

    const { data: { session } } = await supabase.auth.getSession()

    if (file) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', 'TASK')
      formData.append('entity_id', taskId)

      const uploadRes = await fetch(UPLOAD_ATTACHMENT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      })
      if (!uploadRes.ok) {
        const j = await uploadRes.json()
        setSubmitting(false)
        setMessage('Lỗi upload file: ' + j.message)
        return
      }
    }

    const res = await fetch(SUBMIT_TASK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ task_id: Number(taskId), handler_description: description }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setMessage('Lỗi: ' + json.message); return }
    loadTask()
    setMessage('Đã nộp kết quả thành công.')
  }

  if (loadingProfile || loadingData) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (!task) return <div className="p-10 text-muted-foreground">Không tìm thấy task (có thể không phải việc của bạn).</div>

  const alreadySubmitted = task.submitted_at !== null
  const ticket = task.ticket || {}
  const alert = ticket.incident_alert || {}
  const device = alert.device || {}
  const category = ticket.incident_category || {}
  const sla = getSlaState(ticket)
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Việc của tôi / Task #{task.task_id}</p>
          <h1 className="text-2xl font-semibold">{ticket.ticket_code}</h1>
          <p className="mt-1 text-muted-foreground">{alert.alert_summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityTag level={alert.severity_level} />
          {!alreadySubmitted && <SlaBadge ticket={ticket} />}
          <TaskResultTag task={task} />
        </div>
      </div>

      {/* Thong bao trang thai hien tai: nguoi xu ly biet ngay minh can lam gi */}
      {!alreadySubmitted && (sla.state === 'overdue' || sla.state === 'due_soon') && (
        <Callout tone="red" icon={<AlertTriangle className="h-5 w-5" />} title={sla.state === 'overdue' ? 'Việc này đã quá hạn SLA' : 'Việc này sắp hết hạn SLA'}>
          Hạn chót {fmt(ticket.sla_deadline)}. Hãy ưu tiên xử lý và nộp kết quả sớm.
        </Callout>
      )}
      {alreadySubmitted && task.is_passed === null && (
        <Callout tone="amber" icon={<Clock className="h-5 w-5" />} title="Đã nộp, đang chờ Admin duyệt">
          Bạn đã nộp kết quả lúc {fmt(task.submitted_at)}. Kết quả duyệt sẽ hiển thị tại đây.
        </Callout>
      )}
      {task.is_passed === true && (
        <Callout tone="green" icon={<CheckCircle2 className="h-5 w-5" />} title="Kết quả xử lý: Đạt">
          Admin đã duyệt lúc {fmt(task.reviewed_at)}. Ticket đã được đóng.
        </Callout>
      )}
      {task.is_passed === false && (
        <Callout tone="red" icon={<XCircle className="h-5 w-5" />} title="Kết quả xử lý: Không đạt">
          Lý do: {task.admin_review_notes || '—'} (duyệt lúc {fmt(task.reviewed_at)}). Admin sẽ tái phân công ticket này.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Thông tin sự cố</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Info label="Thiết bị" value={device.device_name ? `${device.device_name} (${device.device_code})` : undefined} />
            <Info label="Địa chỉ IP" value={alert.device_ip} />
            <Info label="Vị trí" value={device.location} />
            <Info label="Nguồn cảnh báo" value={alert.source_system} />
            <Info label="Tiếp nhận lúc" value={fmt(alert.received_at)} />
            <div className="my-1 border-t" />
            <Info label="Loại sự cố" value={category.category_name ? `${category.category_name} (${category.priority_level})` : undefined} />
            <Info label="Thời hạn SLA" value={category.sla_hours ? `${category.sla_hours} giờ · hạn chót ${fmt(ticket.sla_deadline)}` : fmt(ticket.sla_deadline)} />
            <Info label="Phòng ban phụ trách" value={ticket.department?.dep_name} />
            <Info label="Hướng xử lý" value={task.direction === 'ONSITE' ? 'Hiện trường (ONSITE)' : 'Hệ thống (SYSTEM)'} />
            <Info label="Được giao lúc" value={fmt(task.created_at)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">{alreadySubmitted ? 'Kết quả đã nộp' : 'Nộp kết quả xử lý'}</CardTitle></CardHeader>
          <CardContent>
            {alreadySubmitted ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">Đã nộp lúc: {fmt(task.submitted_at)}</p>
                <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{task.handler_description}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Mô tả biện pháp xử lý</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    placeholder="Nguyên nhân đã xác định, các bước đã thực hiện, kết quả sau xử lý..."
                  />
                  <p className="text-xs text-muted-foreground">{description.length} ký tự</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>File đính kèm (không bắt buộc)</Label>
                  <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <p className="text-xs text-muted-foreground">Ví dụ: ảnh chụp cấu hình, log sau xử lý, biên bản hiện trường.</p>
                </div>
                {message && <p className="text-sm text-destructive">{message}</p>}
                <Button
                  onClick={() => {
                    if (!description) { setMessage('Cần nhập mô tả xử lý'); return }
                    setMessage(''); setConfirmOpen(true)
                  }}
                  disabled={submitting}
                  className="self-start"
                >
                  {submitting ? 'Đang nộp...' : 'Nộp kết quả'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Nộp kết quả cho ${ticket.ticket_code}?`}
        description="Sau khi nộp, bạn không thể sửa mô tả hay file đính kèm. Kết quả sẽ được chuyển cho Admin duyệt."
        confirmLabel="Nộp kết quả"
        onConfirm={handleSubmit}
      />
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}

const CALLOUT_TONE = {
  red: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
}

function Callout({ tone, icon, title, children }: {
  tone: keyof typeof CALLOUT_TONE; icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${CALLOUT_TONE[tone]}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm">{children}</p>
      </div>
    </div>
  )
}
