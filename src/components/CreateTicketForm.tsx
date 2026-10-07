'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Sparkles } from 'lucide-react'
import { fetchLatestSuggestion, type AiSuggestion } from '@/lib/aiSuggestion'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// Form tao ticket dung chung cho trang /create-ticket va khung truot o trang chi tiet canh bao.
// Logic gui di GIU NGUYEN nhu cu (goi edge function tao ticket), chi tach ra de dung lai.

export function CreateTicketForm({ incidentId, confirm = true, onCreated, onAiLoaded }: {
  incidentId: string
  confirm?: boolean                       // co hoi lai bang hop xac nhan truoc khi tao khong
  onCreated: (ticketId: number) => void
  onAiLoaded?: (ai: AiSuggestion | null) => void
}) {
  const [categories, setCategories] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [handlers, setHandlers] = useState<any[]>([])

  const [categoryId, setCategoryId] = useState('')
  const [direction, setDirection] = useState('SYSTEM')
  const [depId, setDepId] = useState('')
  const [handlerId, setHandlerId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [ai, setAi] = useState<AiSuggestion | null>(null)

  useEffect(() => {
    async function loadMasterData() {
      const { data: cats } = await supabase.from('incident_category').select('category_id, category_name, priority_level, sla_hours')
      setCategories(cats || [])
      const { data: deps } = await supabase.from('department').select('dep_id, dep_name')
      setDepartments(deps || [])

      // Dien san loai su co + huong xu ly theo goi y AI (chi khi AI ket luan la su co that). Admin van doi duoc.
      const sug = await fetchLatestSuggestion(incidentId)
      const useful = sug?.verdict === 'TRUE_INCIDENT' ? sug : null
      setAi(useful)
      onAiLoaded?.(useful)
      if (useful?.suggested_category_id) setCategoryId(String(useful.suggested_category_id))
      if (useful?.suggested_direction) setDirection(useful.suggested_direction)
    }
    loadMasterData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId])

  useEffect(() => {
    if (!depId) { setHandlers([]); return }
    async function loadHandlers() {
      const { data } = await supabase.rpc('list_user_directory')
      const onlyHandlers = (data || []).filter(
        (u: any) => u.role_name === 'Handler' && String(u.dep_id) === String(depId)
      )
      setHandlers(onlyHandlers)
      setHandlerId('')
    }
    loadHandlers()
  }, [depId])

  async function handleSubmit() {
    if (!categoryId || !depId || !handlerId) { setMessage('Điền đủ cả 3 mục'); return }
    setSubmitting(true)
    setMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/hyper-service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        incident_id: Number(incidentId),
        category_id: Number(categoryId),
        direction,
        assigned_dep_id: Number(depId),
        handler_user_id: handlerId,
      }),
    })

    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setMessage('Lỗi: ' + json.message); return }
    onCreated(json.data.ticket.ticket_id)
  }

  return (
    <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
        <FieldLabel label="Loại sự cố" aiValue={ai?.suggested_category_id ? String(ai.suggested_category_id) : null} value={categoryId} />
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
          <SelectTrigger className="w-full font-light text-foreground/80">
            <SelectValue placeholder="-- Chọn --">
              {(() => { const c = categories.find((x) => String(x.category_id) === categoryId); return c ? `${c.category_name} (${c.priority_level}, SLA ${c.sla_hours}h)` : null })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem className="font-light" key={c.category_id} value={String(c.category_id)}>
                {c.category_name} ({c.priority_level}, SLA {c.sla_hours}h)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel label="Hướng xử lý" aiValue={ai?.suggested_direction ?? null} value={direction} />
        <Select value={direction} onValueChange={(v) => setDirection(v ?? '')}>
          <SelectTrigger className="w-full font-light text-foreground/80">
            <SelectValue>{direction === 'ONSITE' ? 'Hiện trường (ONSITE)' : 'Hệ thống (SYSTEM)'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="font-light" value="SYSTEM">Hệ thống (SYSTEM)</SelectItem>
            <SelectItem className="font-light" value="ONSITE">Hiện trường (ONSITE)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-semibold">Phòng ban phụ trách</Label>
        <Select value={depId} onValueChange={(v) => setDepId(v ?? '')}>
          <SelectTrigger className="w-full font-light text-foreground/80">
            <SelectValue placeholder="-- Chọn --">
              {departments.find((d) => String(d.dep_id) === depId)?.dep_name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem className="font-light" key={d.dep_id} value={String(d.dep_id)}>{d.dep_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-semibold">Người xử lý</Label>
        <Select value={handlerId} onValueChange={(v) => setHandlerId(v ?? '')} disabled={!depId}>
          <SelectTrigger className="w-full font-light text-foreground/80">
            <SelectValue placeholder={depId ? '-- Chọn --' : 'Chọn phòng ban trước'}>
              {handlers.find((h) => h.user_id === handlerId)?.full_name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {handlers.map((h) => (
              <SelectItem className="font-light" key={h.user_id} value={h.user_id}>{h.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {message && <p className="text-sm text-destructive">{message}</p>}
      <Button
        onClick={() => {
          if (!categoryId || !depId || !handlerId) { setMessage('Điền đủ cả 3 mục'); return }
          setMessage(''); if (confirm) setConfirmOpen(true); else handleSubmit()
        }}
        disabled={submitting}
        className={confirm ? 'self-start' : 'w-full'}
      >
        {submitting ? 'Đang tạo...' : 'Tạo ticket'}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Tạo ticket cho cảnh báo #${incidentId}?`}
        description="Cảnh báo sẽ được xác nhận là sự cố thật, ticket được tạo và giao ngay cho người xử lý. Hạn SLA bắt đầu tính từ lúc này."
        confirmLabel="Tạo ticket"
        onConfirm={handleSubmit}
      />
    </div>
  )
}

// Nhan cua o nhap + dau hieu goi y AI: con giu gia tri AI goi y, hay Admin da doi sang gia tri khac
function FieldLabel({ label, aiValue, value }: { label: string; aiValue: string | null; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="font-semibold">{label}</Label>
      {aiValue && (value === aiValue ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />Gợi ý bởi AI
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Đã thay đổi so với gợi ý</span>
      ))}
    </div>
  )
}

export function AiPrefillNote() {
  return (
    <p className="flex items-center gap-1.5 text-[12px] italic text-muted-foreground">
      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
      Đã điền sẵn loại sự cố và hướng xử lý theo gợi ý của AI. Bạn kiểm tra lại trước khi tạo.
    </p>
  )
}
