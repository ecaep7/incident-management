'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SeverityTag, IncidentStatusTag } from '@/components/Tag'
import { AiSuggestionCard } from '@/components/AiSuggestionCard'
import { TextActionDialog } from '@/components/TextActionDialog'
import { CreateTicketForm, AiPrefillNote } from '@/components/CreateTicketForm'
import { fetchLatestSuggestion, countFailedSuggestions, type AiSuggestion, type AiVerdict } from '@/lib/aiSuggestion'
import { Ticket, SearchCheck, Ban, Sparkles } from 'lucide-react'

type Panel = null | 'ticket' | 'verify' | 'reject'

export default function IncidentDetailPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const params = useParams()
  const router = useRouter()
  const incidentId = params.id as string

  const [incident, setIncident] = useState<any>(null)
  const [verifications, setVerifications] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [panel, setPanel] = useState<Panel>(null) // dang mo khung/hop thoai nao

  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null)
  const [aiLoaded, setAiLoaded] = useState(false)
  const [aiFailed, setAiFailed] = useState(0)

  async function loadData() {
    // Tai song song canh bao + lich su xac minh cho nhanh
    const [{ data: incidentData }, { data: verData }] = await Promise.all([
      supabase.from('incident_alert').select('*').eq('incident_id', incidentId).single(),
      supabase.from('incident_verification').select('*').eq('incident_id', incidentId)
        .order('requested_at', { ascending: false }),
    ])
    setIncident(incidentData)
    setVerifications(verData || [])
    setLoadingData(false)
  }

  // Goi y AI (chi Admin doc duoc)
  async function loadAi() {
    const sug = await fetchLatestSuggestion(incidentId)
    setAiSuggestion(sug)
    if (!sug) setAiFailed(await countFailedSuggestions(incidentId))
    setAiLoaded(true)
    return sug
  }

  useEffect(() => { if (incidentId) loadData() }, [incidentId])

  const isAdmin = profile?.role?.role_name === 'Admin'
  useEffect(() => {
    if (!incidentId || !isAdmin) return
    loadAi()
    // Realtime: n8n vua ghi goi y moi cho canh bao nay -> hien ngay, khong phai cho
    const channel = supabase
      .channel(`ai-suggestion-${incidentId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_suggestion', filter: `incident_id=eq.${incidentId}` },
        () => { loadAi() })
      .subscribe()
    // Du phong neu Realtime chua bat: van kiem tra lai moi 30 giay
    const timer = setInterval(() => { loadAi() }, 30000)
    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, [incidentId, isAdmin])

  // Mo khung xu ly: neu hanh dong trung voi ket luan AI thi dien san loi giai thich cua AI
  function openPanel(p: Panel) {
    setMessage('')
    if (p === 'reject' && !reason && aiSuggestion?.verdict === 'FALSE_POSITIVE') setReason(aiSuggestion.reasoning || '')
    if (p === 'verify' && !note && aiSuggestion?.verdict === 'NEED_VERIFICATION') setNote(aiSuggestion.reasoning || '')
    setPanel(p)
  }

  async function handleReject() {
    if (!reason) { setMessage('Cần nhập lý do từ chối'); return }
    setActionLoading(true)
    const { error } = await supabase.from('incident_alert')
      .update({ is_hvbt: false, closed_at: new Date().toISOString(), closed_reason: reason, current_status: 'Closed_False' })
      .eq('incident_id', incidentId)
    setActionLoading(false)
    if (error) { setMessage('Lỗi: ' + error.message); return }
    router.push('/incidents')
  }

  async function handleRequestVerification() {
    if (!note) { setMessage('Cần nhập nội dung yêu cầu'); return }
    setActionLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('incident_verification')
      .insert({ incident_id: incidentId, request_note: note, requested_at: new Date().toISOString(), requested_by: user?.id })
    if (!error) {
      await supabase.from('incident_alert').update({ current_status: 'Verifying' }).eq('incident_id', incidentId)
      setNote('')
      setPanel(null)
      loadData()
    } else {
      setMessage('Lỗi: ' + error.message)
    }
    setActionLoading(false)
  }

  if (loadingProfile || loadingData) return <DetailSkeleton />
  if (!incident) return <div className="p-10 text-muted-foreground">Không tìm thấy cảnh báo.</div>

  const isOpen = incident.current_status !== 'Ticket_Created' && incident.current_status !== 'Closed_False'
  const showAside = isAdmin && (!!aiSuggestion || isOpen)
  const aiVerdict = aiSuggestion?.verdict

  return (
    // 2 cot: noi dung chinh ben trai; goi y AI + nut xu ly ben phai, dinh theo khi cuon (sticky)
    <div className={showAside ? 'grid max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 text-balance">{incident.alert_summary}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {incident.device_ip} · {new Date(incident.received_at).toLocaleString('vi-VN')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SeverityTag level={incident.severity_level} />
            <IncidentStatusTag status={incident.current_status} />
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Dữ liệu thô</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(JSON.parse(incident.raw_payload || '{}'), null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lịch sử yêu cầu xác minh</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {verifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có yêu cầu nào.</p>
            ) : verifications.map((v) => (
              <div key={v.verification_id} className="rounded-md border p-3 text-sm">
                <p><span className="font-medium">Yêu cầu:</span> {v.request_note}</p>
                <p className="mt-1 text-muted-foreground">
                  <span className="font-medium text-foreground">Trả lời:</span>{' '}
                  {v.response_payload ? JSON.stringify(v.response_payload) : 'Chưa có phản hồi'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {showAside && (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <AiSuggestionCard
            suggestion={aiSuggestion}
            state={!aiLoaded ? 'loading' : aiSuggestion ? 'ready' : aiFailed >= 3 ? 'failed' : 'pending'}
          />

          {isOpen && (
            <section className="flex flex-col gap-2 rounded-[12px] bg-card p-5 ring-1 ring-border">
              <h2 className="mb-1 text-h3">Xử lý cảnh báo</h2>
              <ActionButton icon={Ticket} label="Tạo ticket" verdict="TRUE_INCIDENT" aiVerdict={aiVerdict} onClick={() => openPanel('ticket')} />
              <ActionButton icon={SearchCheck} label="Yêu cầu xác minh" verdict="NEED_VERIFICATION" aiVerdict={aiVerdict} onClick={() => openPanel('verify')} />
              <ActionButton icon={Ban} label="Từ chối (cảnh báo sai)" verdict="FALSE_POSITIVE" aiVerdict={aiVerdict} onClick={() => openPanel('reject')} danger />
            </section>
          )}
        </aside>
      )}

      {/* Khung truot tao ticket ngay tren trang, van nhin thay du lieu canh bao */}
      <Sheet open={panel === 'ticket'} onOpenChange={(o) => setPanel(o ? 'ticket' : null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md" overlayClassName="bg-black/5 supports-backdrop-filter:backdrop-blur-none">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-lg font-semibold">Tạo ticket cho cảnh báo #{incidentId}</SheetTitle>
            {aiVerdict === 'TRUE_INCIDENT' && <AiPrefillNote />}
          </SheetHeader>
          <div className="px-6 py-5">
            {panel === 'ticket' && (
              <CreateTicketForm incidentId={incidentId} confirm={false} onCreated={(id) => router.push(`/tickets/${id}`)} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TextActionDialog
        open={panel === 'verify'}
        onOpenChange={(o) => setPanel(o ? 'verify' : null)}
        title="Yêu cầu xác minh thêm"
        description="Cảnh báo chuyển sang trạng thái Đang xác minh cho tới khi có phản hồi."
        label="Nội dung yêu cầu"
        value={note}
        onChange={setNote}
        fromAi={aiVerdict === 'NEED_VERIFICATION' && note === aiSuggestion?.reasoning}
        confirmLabel="Gửi yêu cầu"
        loading={actionLoading}
        error={message}
        onConfirm={handleRequestVerification}
      />

      <TextActionDialog
        open={panel === 'reject'}
        onOpenChange={(o) => setPanel(o ? 'reject' : null)}
        title="Từ chối cảnh báo này?"
        description="Cảnh báo được đánh dấu là cảnh báo sai và rời khỏi hàng chờ. Thao tác này không thể hoàn tác trên giao diện."
        label="Lý do từ chối"
        placeholder="Vì sao đây là cảnh báo sai?"
        value={reason}
        onChange={setReason}
        fromAi={aiVerdict === 'FALSE_POSITIVE' && reason === aiSuggestion?.reasoning}
        confirmLabel="Từ chối cảnh báo"
        tone="destructive"
        loading={actionLoading}
        error={message}
        onConfirm={handleReject}
      />
    </div>
  )
}

// Nut xu ly: nut trung voi ket luan cua AI duoc to noi + gan nhan "Gợi ý"
function ActionButton({ icon: Icon, label, verdict, aiVerdict, onClick, danger }: {
  icon: React.ElementType; label: string; verdict: AiVerdict; aiVerdict?: AiVerdict
  onClick: () => void; danger?: boolean
}) {
  const suggested = aiVerdict === verdict
  const base = 'flex h-11 w-full items-center gap-2.5 rounded-[14px] px-4 text-sm font-medium transition-colors'
  const style = suggested
    ? danger
      ? 'bg-[#E05252] text-white hover:bg-[#CF4646]'
      : 'bg-primary text-primary-foreground hover:bg-primary/85'
    : danger
      ? 'text-red-700 ring-1 ring-inset ring-border hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10'
      : 'text-foreground ring-1 ring-inset ring-border hover:bg-muted'
  return (
    <button onClick={onClick} className={`${base} ${style}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {suggested && (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
          <Sparkles className="h-3 w-3" />Gợi ý
        </span>
      )}
    </button>
  )
}

// Khung xam mo trong luc tai, giu dung bo cuc de trang khong bi giat
function DetailSkeleton() {
  const s = 'bg-[#E3E8EF] dark:bg-white/5'
  return (
    <div className="grid max-w-6xl grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Skeleton className={`${s} h-9 w-4/5`} />
          <Skeleton className={`${s} h-9 w-3/5`} />
          <Skeleton className={`${s} h-4 w-48`} />
        </div>
        <Skeleton className={`${s} h-52 w-full rounded-[12px]`} />
        <Skeleton className={`${s} h-32 w-full rounded-[12px]`} />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className={`${s} h-72 w-full rounded-[12px]`} />
        <Skeleton className={`${s} h-48 w-full rounded-[12px]`} />
      </div>
    </div>
  )
}