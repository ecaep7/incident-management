import { Badge } from '@/components/ui/badge'

// Tinh trang thai SLA hoan toan o phia giao dien, tu cac cot da co san
// (sla_deadline, status, closed_at). Khong ghi gi xuong DB.

export type SlaState = 'met' | 'late' | 'overdue' | 'due_soon' | 'on_track' | 'unknown'

const DUE_SOON_HOURS = 2

export function getSlaState(t: { sla_deadline?: string | null; status?: string | null; closed_at?: string | null }): {
  state: SlaState
  hours: number
} {
  if (!t?.sla_deadline) return { state: 'unknown', hours: 0 }
  const deadline = new Date(t.sla_deadline).getTime()

  if (t.status === 'Closed') {
    const closed = t.closed_at ? new Date(t.closed_at).getTime() : deadline
    return { state: closed <= deadline ? 'met' : 'late', hours: Math.abs(closed - deadline) / 36e5 }
  }

  const diffH = (deadline - Date.now()) / 36e5
  if (diffH < 0) return { state: 'overdue', hours: -diffH }
  if (diffH <= DUE_SOON_HOURS) return { state: 'due_soon', hours: diffH }
  return { state: 'on_track', hours: diffH }
}

export function formatHours(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} phút`
  if (h < 48) return `${Math.round(h)} giờ`
  return `${Math.round(h / 24)} ngày`
}

export function slaLabel(t: any) {
  const { state, hours } = getSlaState(t)
  switch (state) {
    case 'met': return 'Đúng hạn'
    case 'late': return `Trễ ${formatHours(hours)}`
    case 'overdue': return `Quá hạn ${formatHours(hours)}`
    case 'due_soon': return `Sắp hết hạn · còn ${formatHours(hours)}`
    case 'on_track': return `Còn ${formatHours(hours)}`
    default: return '—'
  }
}

export function SlaBadge({ ticket }: { ticket: any }) {
  const { state } = getSlaState(ticket)
  const label = slaLabel(ticket)
  switch (state) {
    case 'met':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{label}</Badge>
    case 'late':
    case 'overdue':
      return <Badge variant="destructive">{label}</Badge>
    case 'due_soon':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{label}</Badge>
    case 'on_track':
      return <Badge variant="outline">{label}</Badge>
    default:
      return <span className="text-muted-foreground">—</span>
  }
}
