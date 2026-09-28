// Tinh cac so lieu dashboard o phia giao dien tu bang ticket, de loc duoc theo
// thoi gian va phong ban. Cach tinh doi chieu 1-1 voi cac view dashboard_* trong DB
// (khi khong loc, ket qua trung khop voi view).

export type DashTicket = {
  ticket_id: number
  status: string
  category_id: number
  assigned_dep_id: number
  created_at: string
  closed_at: string | null
  sla_deadline: string
}

export type DashFilter = { from?: string; to?: string; depId?: string }

export function filterTickets(tickets: DashTicket[], f: DashFilter) {
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : null
  const to = f.to ? new Date(f.to + 'T23:59:59.999').getTime() : null
  return tickets.filter((t) => {
    const c = new Date(t.created_at).getTime()
    if (from !== null && c < from) return false
    if (to !== null && c > to) return false
    if (f.depId && f.depId !== 'all' && String(t.assigned_dep_id) !== f.depId) return false
    return true
  })
}

function countBy<T>(items: T[], key: (x: T) => string) {
  const m = new Map<string, number>()
  items.forEach((x) => m.set(key(x), (m.get(key(x)) || 0) + 1))
  return m
}

// Thu 2 dau tuan (UTC), giong date_trunc('week', created_at)
function weekStartUTC(iso: string) {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  const ws = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day))
  return ws.toISOString().slice(0, 10)
}

const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 36e5

export function computeStats(
  tickets: DashTicket[],
  categories: { category_id: number; priority_level: string }[],
  departments: { dep_id: number; dep_name: string }[],
) {
  const prioByCat = new Map(categories.map((c) => [c.category_id, c.priority_level]))
  const depName = new Map(departments.map((d) => [d.dep_id, d.dep_name]))
  const now = Date.now()

  const byStatus = [...countBy(tickets, (t) => t.status)].map(([status, total]) => ({ status, total }))

  const PRIO_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const prioCount = countBy(tickets, (t) => prioByCat.get(t.category_id) || 'Khác')
  const byPriority = [...prioCount]
    .map(([priority_level, total]) => ({ priority_level, total }))
    .sort((a, b) => PRIO_ORDER.indexOf(a.priority_level) - PRIO_ORDER.indexOf(b.priority_level))

  const byDept = [...countBy(tickets, (t) => depName.get(t.assigned_dep_id) || 'Khác')]
    .map(([dep_name, total]) => ({ dep_name, total }))

  const open = tickets.filter((t) => t.status !== 'Closed')
  const slaSummary = {
    total_open: open.length,
    // Tinh truc tiep tu han SLA (khong phu thuoc cot is_sla_breached do job n8n cap nhat)
    total_breached: open.filter((t) => new Date(t.sla_deadline).getTime() < now).length,
  }

  const trend = [...countBy(tickets, (t) => weekStartUTC(t.created_at))]
    .map(([week_start, total]) => ({ week_start, total }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start))

  const closed = tickets.filter((t) => t.status === 'Closed' && t.closed_at)
  const onTime = closed.filter((t) => new Date(t.closed_at!).getTime() <= new Date(t.sla_deadline).getTime()).length
  const slaCompliance = {
    total_closed: closed.length,
    closed_on_time: onTime,
    compliance_rate_percent: closed.length ? Math.round((onTime / closed.length) * 1000) / 10 : 0,
  }

  const perfMap = new Map<string, { total_closed: number; sumHours: number }>()
  closed.forEach((t) => {
    const name = depName.get(t.assigned_dep_id) || 'Khác'
    const cur = perfMap.get(name) || { total_closed: 0, sumHours: 0 }
    cur.total_closed += 1
    cur.sumHours += hoursBetween(t.created_at, t.closed_at!)
    perfMap.set(name, cur)
  })
  const deptPerf = [...perfMap].map(([dep_name, v]) => ({
    dep_name,
    total_closed: v.total_closed,
    avg_hours_to_close: v.total_closed ? Math.round((v.sumHours / v.total_closed) * 10) / 10 : null,
  }))

  return { byStatus, byPriority, byDept, slaSummary, trend, slaCompliance, deptPerf }
}
