'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StatusDot, severityColor } from '@/components/StatusDot'

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

  async function loadTask() {
    const { data } = await supabase
      .from('ticket_task')
      .select('*, ticket(ticket_code, direction, incident_alert(alert_summary, severity_level))')
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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{task.ticket?.ticket_code}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {task.ticket?.incident_alert?.alert_summary} · Hướng xử lý: {task.direction}
          </p>
        </div>
        <StatusDot
          label={task.ticket?.incident_alert?.severity_level}
          color={severityColor(task.ticket?.incident_alert?.severity_level)}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{alreadySubmitted ? 'Kết quả đã nộp' : 'Nộp kết quả xử lý'}</CardTitle></CardHeader>
        <CardContent>
          {alreadySubmitted ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">Đã nộp lúc: {new Date(task.submitted_at).toLocaleString('vi-VN')}</p>
              <p>{task.handler_description}</p>
              <div className="mt-2">
                {task.is_passed === null ? (
                  <Badge variant="outline">Chờ Admin duyệt</Badge>
                ) : task.is_passed ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Đạt</Badge>
                ) : (
                  <Badge variant="destructive">Không đạt — {task.admin_review_notes}</Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Mô tả biện pháp xử lý</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>File đính kèm (không bắt buộc)</Label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
              {message && <p className="text-sm text-destructive">{message}</p>}
              <Button onClick={handleSubmit} disabled={submitting} className="self-start">
                {submitting ? 'Đang nộp...' : 'Nộp kết quả'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}