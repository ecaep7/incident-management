import { supabase } from './supabase'

// Gom du lieu cua mot ticket cho Timeline va Bien ban in.
// Chi DOC du lieu, dung dung quyen (RLS) cua nguoi dang dang nhap:
// Viewer khong doc duoc incident_alert -> phan do se la null, giao dien tu bo qua.

export type TicketBundle = {
  ticket: any
  incident: any | null
  category: any | null
  tasks: any[]
  nameById: Map<string, string>
  depById: Map<number, string>
}

export async function loadTicketBundle(ticketId: string | number): Promise<TicketBundle | null> {
  const { data: ticket } = await supabase.from('ticket').select('*').eq('ticket_id', ticketId).single()
  if (!ticket) return null

  const [incidentRes, categoryRes, tasksRes, dirRes, depRes] = await Promise.all([
    supabase.from('incident_alert')
      .select('incident_id, alert_summary, device_ip, severity_level, source_system, received_at, verified_at')
      .eq('incident_id', ticket.incident_id).maybeSingle(),
    supabase.from('incident_category')
      .select('category_name, priority_level, sla_hours')
      .eq('category_id', ticket.category_id).maybeSingle(),
    supabase.from('ticket_task').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    supabase.rpc('list_user_directory'),
    supabase.from('department').select('dep_id, dep_name'),
  ])

  return {
    ticket,
    incident: incidentRes.data ?? null,
    category: categoryRes.data ?? null,
    tasks: tasksRes.data || [],
    nameById: new Map((dirRes.data || []).map((u: any) => [u.user_id, u.full_name])),
    depById: new Map((depRes.data || []).map((d: any) => [d.dep_id, d.dep_name])),
  }
}

export type TimelineEvent = {
  at: string
  title: string
  detail?: string
  tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning'
}

export function buildTimeline(b: TicketBundle): TimelineEvent[] {
  const name = (id?: string | null) => (id ? b.nameById.get(id) || 'Không rõ' : 'Không rõ')
  const events: TimelineEvent[] = []

  if (b.incident?.received_at) {
    events.push({
      at: b.incident.received_at,
      title: 'Tiếp nhận cảnh báo',
      detail: `${b.incident.source_system || 'Hệ thống giám sát'} · ${b.incident.device_ip} · ${b.incident.severity_level}`,
      tone: 'neutral',
    })
  }

  events.push({
    at: b.ticket.created_at,
    title: `Xác minh và tạo ticket ${b.ticket.ticket_code}`,
    detail: `Người tạo: ${name(b.ticket.created_by)}${b.category ? ` · ${b.category.category_name} (${b.category.priority_level}, SLA ${b.category.sla_hours}h)` : ''}`,
    tone: 'info',
  })

  b.tasks.forEach((t, idx) => {
    events.push({
      at: t.created_at,
      title: idx === 0 ? `Giao việc cho ${name(t.handler_user_id)}` : `Tái phân công cho ${name(t.handler_user_id)}`,
      detail: `${b.depById.get(t.assigned_dep_id) || ''} · Hướng xử lý ${t.direction}`,
      tone: idx === 0 ? 'info' : 'warning',
    })
    if (t.submitted_at) {
      events.push({
        at: t.submitted_at,
        title: `${name(t.handler_user_id)} nộp kết quả`,
        detail: t.handler_description || undefined,
        tone: 'neutral',
      })
    }
    if (t.reviewed_at && t.is_passed !== null) {
      events.push({
        at: t.reviewed_at,
        title: t.is_passed ? `Duyệt: Đạt (${name(t.reviewed_by)})` : `Duyệt: Không đạt (${name(t.reviewed_by)})`,
        detail: t.is_passed ? undefined : t.admin_review_notes || undefined,
        tone: t.is_passed ? 'success' : 'danger',
      })
    }
  })

  if (b.ticket.status === 'Closed' && b.ticket.closed_at) {
    events.push({ at: b.ticket.closed_at, title: 'Đóng ticket', tone: 'success' })
  }

  // Sap theo thoi gian; neu trung moc thi giu thu tu nghiep vu o tren
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b2) => new Date(a.e.at).getTime() - new Date(b2.e.at).getTime() || a.i - b2.i)
    .map((x) => x.e)
}
