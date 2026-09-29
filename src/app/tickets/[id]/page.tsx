'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TicketStatusTag, Tag } from '@/components/Tag'
import { SlaBadge } from '@/components/SlaBadge'
import { TicketTimeline } from '@/components/TicketTimeline'
import { Printer, ChevronRight, Paperclip, Send, Hourglass } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { type TaskAttachment } from '@/components/TaskAttachments'
import { TaskResultDialog, ReviewStatusTag } from '@/components/TaskResultDialog'
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
  const [attByTask, setAttByTask] = useState<Map<number, TaskAttachment[]>>(new Map())
  const [loadingData, setLoadingData] = useState(true)

  const [reviewNotes, setReviewNotes] = useState('')
  const [reassignDirection, setReassignDirection] = useState('SYSTEM')
  const [departments, setDepartments] = useState<any[]>([])
  const [handlers, setHandlers] = useState<any[]>([])
  const [reassignDep, setReassignDep] = useState('')
  const [reassignHandler, setReassignHandler] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmKind, setConfirmKind] = useState<null | 'pass' | 'fail' | 'reassign'>(null)
  const [openTaskId, setOpenTaskId] = useState<number | null>(null)

  async function loadAll() {
    const { data: t } = await supabase.from('ticket').select('*').eq('ticket_id', ticketId).single()
    setTicket(t)
    const { data: tk } = await supabase.from('ticket_task').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false })
    const { data: dir } = await supabase.rpc('list_user_directory')
    const nameById = new Map((dir || []).map((u: any) => [u.user_id, u.full_name]))
    setTasks((tk || []).map((t: any) => ({ ...t, handler_full_name: nameById.get(t.handler_user_id) })))
    await loadAttachments((tk || []).map((t: any) => t.task_id))
    setLoadingData(false)
  }

  // Tep bang chung handler nop kem tung task. Bucket 'attachments' rieng tu -> can signed URL de xem/tai.
  async function loadAttachments(taskIds: number[]) {
    if (!taskIds.length) { setAttByTask(new Map()); return }
    const { data: att } = await supabase
      .from('attachment')
      .select('attachment_id, entity_id, file_name, file_url, uploaded_at')
      .eq('entity_type', 'TASK')
      .in('entity_id', taskIds)
      .order('uploaded_at', { ascending: true })
    const rows = (att || []) as TaskAttachment[]
    const paths = rows.map((a) => a.file_url).filter(Boolean)
    const urlByPath = new Map<string, string>()
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('attachments').createSignedUrls(paths, 60 * 60)
      ;(signed || []).forEach((s) => { if (s.path && s.signedUrl && !s.error) urlByPath.set(s.path, s.signedUrl) })
    }
    const map = new Map<number, TaskAttachment[]>()
    rows.forEach((a) => {
      const list = map.get(a.entity_id) || []
      list.push({ ...a, url: urlByPath.get(a.file_url) ?? null })
      map.set(a.entity_id, list)
    })
    setAttByTask(map)
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
    setOpenTaskId(null)
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
          <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]">{ticket.ticket_code}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hướng xử lý: {ticket.direction} · Hạn SLA: {new Date(ticket.sla_deadline).toLocaleString('vi-VN')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <SlaBadge ticket={ticket} />
            <TicketStatusTag status={ticket.status} />
          </div>
          <Button size="sm" onClick={() => window.open(`/tickets/${ticketId}/print`, '_blank')}>
            <Printer className="mr-2 h-4 w-4" />In biên bản
          </Button>
        </div>
      </div>

      <TicketTimeline
        key={tasks.map((t) => `${t.task_id}:${t.submitted_at}:${t.is_passed}`).join('|') + ticket.status}
        ticketId={ticketId}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Lịch sử xử lý ({tasks.length} lượt)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {tasks.map((tk) => {
            const files = attByTask.get(tk.task_id) || []
            const needsReview = canReview && tk.task_id === latestTask?.task_id
            const submitted = !!tk.submitted_at
            const name = tk.handler_full_name || tk.handler_user_id
            return (
              <div
                key={tk.task_id}
                role={submitted ? 'button' : undefined}
                tabIndex={submitted ? 0 : undefined}
                onClick={submitted ? () => { setMessage(''); setOpenTaskId(tk.task_id) } : undefined}
                onKeyDown={submitted ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMessage(''); setOpenTaskId(tk.task_id) } } : undefined}
                className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${submitted ? 'cursor-pointer hover:border-primary/40 hover:bg-[var(--surface-soft)]' : ''} ${needsReview ? 'border-primary/30 bg-[var(--block-blue)]/60' : ''}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${submitted ? 'bg-[var(--block-blue)] text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {submitted ? <Send className="h-4 w-4" /> : <Hourglass className="h-4 w-4" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate">
                    {submitted
                      ? <><span className="font-semibold">{name}</span> đã gửi kết quả xử lý</>
                      : <>Đã giao cho <span className="font-semibold">{name}</span> · đang chờ xử lý</>}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span>Task #{tk.task_id}</span>
                    <span>·</span>
                    <span>{new Date(submitted ? tk.submitted_at : tk.created_at).toLocaleString('vi-VN')}</span>
                    {files.length > 0 && (<><span>·</span><span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{files.length} tệp đính kèm</span></>)}
                  </p>
                </div>
                <ReviewStatusTag task={tk} />
                {submitted && (
                  needsReview
                    ? <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[14px] bg-primary px-3 text-xs font-medium text-primary-foreground">Xem & duyệt<ChevronRight className="h-3.5 w-3.5" /></span>
                    : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {message && openTaskId === null && <p className="text-sm text-destructive">{message}</p>}

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
            <Button
              onClick={() => {
                if (!reassignDep || !reassignHandler) { setMessage('Chọn đủ phòng ban và người xử lý'); return }
                setMessage(''); setConfirmKind('reassign')
              }}
              disabled={actionLoading}
              className="self-start"
            >Tái phân công</Button>
          </CardContent>
        </Card>
      )}

      {/* Popup ket qua xu ly: ghi chu, tep, thoi gian gui + duyet (xac nhan long ben trong) */}
      <TaskResultDialog
        open={openTaskId !== null}
        onOpenChange={(o) => { if (!o) { setOpenTaskId(null); setMessage('') } }}
        task={tasks.find((t) => t.task_id === openTaskId) ?? null}
        ticketCode={ticket.ticket_code}
        attachments={attByTask.get(openTaskId ?? -1) || []}
        canReview={!!canReview && openTaskId === latestTask?.task_id}
        reviewNotes={reviewNotes}
        onReviewNotesChange={setReviewNotes}
        message={message}
        actionLoading={actionLoading}
        onPass={() => { setMessage(''); setConfirmKind('pass') }}
        onFail={() => {
          if (!reviewNotes) { setMessage('Cần nhập lý do khi đánh Không đạt'); return }
          setMessage(''); setConfirmKind('fail')
        }}
      >
        <ConfirmDialog
          open={confirmKind === 'pass'}
          onOpenChange={(o) => !o && setConfirmKind(null)}
          title={`Duyệt Đạt cho ${ticket.ticket_code}?`}
          description="Ticket sẽ được đóng và kết quả duyệt không thể thay đổi sau khi xác nhận."
          confirmLabel="Duyệt Đạt"
          onConfirm={() => handleReview(true)}
        />
        <ConfirmDialog
          open={confirmKind === 'fail'}
          onOpenChange={(o) => !o && setConfirmKind(null)}
          title={`Đánh giá Không đạt cho ${ticket.ticket_code}?`}
          description="Kết quả duyệt không thể thay đổi. Sau đó bạn cần tái phân công ticket cho người khác xử lý."
          confirmLabel="Xác nhận Không đạt"
          tone="destructive"
          onConfirm={() => handleReview(false)}
        />
      </TaskResultDialog>

      {/* Hop thoai xac nhan: chi goi ham xu ly cu khi nguoi dung bam Xac nhan */}
      <ConfirmDialog
        open={confirmKind === 'reassign'}
        onOpenChange={(o) => !o && setConfirmKind(null)}
        title={`Tái phân công ${ticket.ticket_code}?`}
        description="Hệ thống sẽ tạo một lượt xử lý mới và giao ngay cho người được chọn."
        confirmLabel="Tái phân công"
        onConfirm={handleReassign}
      />
    </div>
  )
}
