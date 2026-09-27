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
import { Separator } from '@/components/ui/separator'
import { StatusDot, ticketStatusColor } from '@/components/StatusDot'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const REVIEW_TASK_URL = 'https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/review-task'
const REASSIGN_TASK_URL = 'https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/reassign-task'

export default function TicketDetailPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const params = useParams()
  const ticketId = params.id as string

  const [ticket, setTicket] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [reviewNotes, setReviewNotes] = useState('')
  const [reassignDirection, setReassignDirection] = useState('SYSTEM')
  const [departments, setDepartments] = useState<any[]>([])
  const [handlers, setHandlers] = useState<any[]>([])
  const [reassignDep, setReassignDep] = useState('')
  const [reassignHandler, setReassignHandler] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadAll() {
    const { data: t } = await supabase.from('ticket').select('*').eq('ticket_id', ticketId).single()
    setTicket(t)
    const { data: tk } = await supabase.from('ticket_task').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false })
    const { data: dir } = await supabase.rpc('list_user_directory')
    const nameById = new Map((dir || []).map((u: any) => [u.user_id, u.full_name]))
    setTasks((tk || []).map((t: any) => ({ ...t, handler_full_name: nameById.get(t.handler_user_id) })))
    setLoadingData(false)
  }

  useEffect(() => { if (ticketId) loadAll() }, [ticketId])

  useEffect(() => {
    async function loadDeps() {
      const { data } = await supabase.from('department').select('dep_id, dep_name')
      setDepartments(data || [])
    }
    loadDeps()
  }, [])

  useEffect(() => {
    if (!reassignDep) { setHandlers([]); return }
    async function loadHandlers() {
      const { data } = await supabase.rpc('list_user_directory')
      setHandlers(
        (data || []).filter(
          (u: any) => u.role_name === 'Handler' && String(u.dep_id) === String(reassignDep)
        )
      )
      setReassignHandler('')
    }
    loadHandlers()
  }, [reassignDep])

  async function callApi(url: string, body: any) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    return { ok: res.ok, json }
  }

  async function handleReview(isPassed: boolean) {
    if (!isPassed && !reviewNotes) { setMessage('Cần nhập lý do khi đánh Không đạt'); return }
    setActionLoading(true)
    setMessage('')
    const latestTask = tasks[0]
    const { ok, json } = await callApi(REVIEW_TASK_URL, {
      task_id: latestTask.task_id, is_passed: isPassed, admin_review_notes: isPassed ? undefined : reviewNotes,
    })
    setActionLoading(false)
    if (!ok) { setMessage('Lỗi: ' + json.message); return }
    setReviewNotes('')
    loadAll()
  }

  async function handleReassign() {
    if (!reassignDep || !reassignHandler) { setMessage('Chọn đủ phòng ban và người xử lý'); return }
    setActionLoading(true)
    setMessage('')
    const { ok, json } = await callApi(REASSIGN_TASK_URL, {
      ticket_id: Number(ticketId), direction: reassignDirection, assigned_dep_id: Number(reassignDep), handler_user_id: reassignHandler,
    })
    setActionLoading(false)
    if (!ok) { setMessage('Lỗi: ' + json.message); return }
    setReassignDep(''); setReassignHandler('')
    loadAll()
  }

  if (loadingProfile || loadingData) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (!ticket) return <div className="p-10 text-muted-foreground">Không tìm thấy ticket.</div>

  const isAdmin = profile?.role?.role_name === 'Admin'
  const latestTask = tasks[0]
  const canReview = isAdmin && latestTask && latestTask.submitted_at !== null && latestTask.is_passed === null
  const canReassign = isAdmin && ticket.status !== 'Closed' && latestTask?.submitted_at != null && latestTask?.is_passed === false

  const selectedReassignDepName = departments.find((d) => String(d.dep_id) === reassignDep)?.dep_name
  const selectedReassignHandlerName = handlers.find((h) => h.user_id === reassignHandler)?.full_name

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{ticket.ticket_code}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hướng xử lý: {ticket.direction} · Hạn SLA: {new Date(ticket.sla_deadline).toLocaleString('vi-VN')}
          </p>
        </div>
        <StatusDot label={ticket.status} color={ticketStatusColor(ticket.status)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lịch sử xử lý ({tasks.length} lượt)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {tasks.map((tk) => (
            <div key={tk.task_id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">Task #{tk.task_id} — Người xử lý: {tk.handler_full_name || tk.handler_user_id}</p>
              <p className="mt-1 text-muted-foreground">Mô tả xử lý: {tk.handler_description || '(chưa nộp)'}</p>
              <div className="mt-2">
                {tk.is_passed === null ? (
                  <Badge variant="outline">Chưa duyệt</Badge>
                ) : tk.is_passed ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Đạt</Badge>
                ) : (
                  <Badge variant="destructive">Không đạt — {tk.admin_review_notes}</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {message && <p className="text-sm text-destructive">{message}</p>}

      {canReview && (
        <Card>
          <CardHeader><CardTitle className="text-base">Duyệt kết quả (Task #{latestTask.task_id})</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Lý do (bắt buộc nếu Không đạt)"
            />
            <div className="flex gap-2">
              <Button onClick={() => handleReview(true)} disabled={actionLoading}>Đạt</Button>
              <Button onClick={() => handleReview(false)} disabled={actionLoading} variant="destructive">Không đạt</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canReassign && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tái phân công</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Hướng xử lý</Label>
              <Select value={reassignDirection} onValueChange={(v) => setReassignDirection(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYSTEM">Hệ thống (SYSTEM)</SelectItem>
                  <SelectItem value="ONSITE">Hiện trường (ONSITE)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Phòng ban</Label>
              <Select value={reassignDep} onValueChange={(v) => setReassignDep(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="-- Chọn phòng ban --">{selectedReassignDepName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.dep_id} value={String(d.dep_id)}>{d.dep_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Người xử lý</Label>
              <Select value={reassignHandler} onValueChange={(v) => setReassignHandler(v ?? '')} disabled={!reassignDep}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={reassignDep ? '-- Chọn người xử lý --' : 'Chọn phòng ban trước'}>
                    {selectedReassignHandlerName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {handlers.map((h) => (
                    <SelectItem key={h.user_id} value={h.user_id}>{h.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />
            <Button onClick={handleReassign} disabled={actionLoading} className="self-start">Tái phân công</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}