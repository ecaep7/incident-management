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

export function filterTickets<T extends DashTicket>(tickets: T[], f: DashFilter): T[] {
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

// ---------------------------------------------------------------------------
// Bo sung cho dashboard dang "van hanh" (KPI + xu huong)
// ---------------------------------------------------------------------------

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Ky lien truoc co cung do dai (de tinh % tang/giam). Khong co khoang thoi gian -> null
export function previousRange(from?: string, to?: string): { from: string; to: string } | null {
  if (!from || !to) return null
  const f = new Date(from + 'T00:00:00')
  const t = new Date(to + 'T00:00:00')
  const days = Math.round((t.getTime() - f.getTime()) / 864e5) + 1
  const pTo = new Date(f); pTo.setDate(pTo.getDate() - 1)
  const pFrom = new Date(pTo); pFrom.setDate(pFrom.getDate() - days + 1)
  return { from: toIsoDate(pFrom), to: toIsoDate(pTo) }
}

export type Kpis = {
  total: number
  open: number
  closed: number
  critical: number        // ticket muc CRITICAL + HIGH
  mttrHours: number | null // thoi gian xu ly trung binh (tao -> dong)
  avgSlaHours: number | null
  slaRate: number | null   // % dong dung han
  overdueOpen: number
}

export function computeKpis(
  tickets: DashTicket[],
  categories: { category_id: number; priority_level: string }[],
): Kpis {
  const prio = new Map(categories.map((c) => [c.category_id, c.priority_level]))
  const now = Date.now()
  const open = tickets.filter((t) => t.status !== 'Closed')
  const closed = tickets.filter((t) => t.status === 'Closed' && t.closed_at)
  const onTime = closed.filter((t) => new Date(t.closed_at!).getTime() <= new Date(t.sla_deadline).getTime()).length
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  return {
    total: tickets.length,
    open: open.length,
    closed: closed.length,
    critical: tickets.filter((t) => ['CRITICAL', 'HIGH'].includes(prio.get(t.category_id) || '')).length,
    mttrHours: avg(closed.map((t) => hoursBetween(t.created_at, t.closed_at!))),
    avgSlaHours: avg(closed.map((t) => hoursBetween(t.created_at, t.sla_deadline))),
    slaRate: closed.length ? (onTime / closed.length) * 100 : null,
    overdueOpen: open.filter((t) => new Date(t.sla_deadline).getTime() < now).length,
  }
}

// % thay doi so voi ky truoc; null neu ky truoc khong co du lieu
export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

export type Granularity = 'day' | 'week' | 'month'

// Chuoi xu huong: so ticket tao moi va so ticket da dong theo tung moc thoi gian.
// Neu khong chon khoang thoi gian: 14 ngay / 8 tuan / 6 thang gan nhat.
export function trendSeries(tickets: DashTicket[], g: Granularity, from?: string, to?: string) {
  const end = to ? new Date(to + 'T23:59:59') : new Date()
  let start: Date
  if (from) start = new Date(from + 'T00:00:00')
  else {
    start = new Date(end)
    if (g === 'day') start.setDate(start.getDate() - 13)
    if (g === 'week') start.setDate(start.getDate() - 7 * 7)
    if (g === 'month') start.setMonth(start.getMonth() - 5)
  }
  const bucketStart = (d: Date) => {
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (g === 'week') b.setDate(b.getDate() - ((b.getDay() + 6) % 7)) // thu 2
    if (g === 'month') b.setDate(1)
    return b
  }
  const next = (d: Date) => {
    const n = new Date(d)
    if (g === 'day') n.setDate(n.getDate() + 1)
    if (g === 'week') n.setDate(n.getDate() + 7)
    if (g === 'month') n.setMonth(n.getMonth() + 1)
    return n
  }
  const label = (d: Date) =>
    g === 'month' ? `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` : `${d.getDate()}/${d.getMonth() + 1}`

  const buckets: { key: number; label: string; created: number; closed: number }[] = []
  for (let b = bucketStart(start); b <= end; b = next(b)) buckets.push({ key: b.getTime(), label: label(b), created: 0, closed: 0 })
  const idx = (iso: string) => {
    const k = bucketStart(new Date(iso)).getTime()
    return buckets.findIndex((x) => x.key === k)
  }
  tickets.forEach((t) => {
    const i = idx(t.created_at); if (i >= 0) buckets[i].created++
    if (t.closed_at) { const j = idx(t.closed_at); if (j >= 0) buckets[j].closed++ }
  })
  return buckets
}
