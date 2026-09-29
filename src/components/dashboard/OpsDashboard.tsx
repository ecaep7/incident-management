'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  AlertTriangle, Timer, ShieldCheck, Clock, Inbox, Ticket, Server, ArrowUpRight,
  CheckCircle2, Bot, TrendingUp, TrendingDown,
} from 'lucide-react'
import { severityColor } from '@/components/StatusDot'
import { TicketStatusTag } from '@/components/Tag'
import { SlaBadge } from '@/components/SlaBadge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  computeKpis, computeStats, filterTickets, pctChange, previousRange, trendSeries,
  type DashTicket, type Granularity,
} from '@/lib/dashboardStats'

// Dashboard van hanh cho Admin / Viewer. Chi DOC du lieu, moi so lieu tinh o giao dien.

export type OpsTicket = DashTicket & { ticket_code: string; incident_alert?: { alert_summary?: string } | null }

type Props = {
  role: 'Admin' | 'Viewer'
  tickets: OpsTicket[]
  categories: { category_id: number; category_name?: string; priority_level: string }[]
  departments: { dep_id: number; dep_name: string }[]
  handlerByTicket: Map<number, string>
  devices: { total: number; withOpen: number } | null
  pendingAlerts: number | null
  filter: { from: string; to: string; depId: string }
}

const STATUS_META = [
  { key: 'Assigned', label: 'Đang xử lý', color: 'var(--status-assigned)' },
  { key: 'Pending Review', label: 'Chờ duyệt', color: 'var(--status-pending)' },
  { key: 'Closed', label: 'Đã đóng', color: 'var(--status-closed)' },
]

const trendConfig = {
  created: { label: 'Tạo mới', color: 'var(--series-1)' },
  closed: { label: 'Đã đóng', color: 'var(--series-2)' },
} satisfies ChartConfig
const countConfig = { total: { label: 'Số ticket' } } satisfies ChartConfig
const statusConfig = { value: { label: 'Tỷ lệ' } } satisfies ChartConfig

function fmtHours(h: number | null) {
  if (h === null) return '—'
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 48) return `${h.toFixed(1).replace('.', ',')}h`
  return `${(h / 24).toFixed(1).replace('.', ',')}d`
}

function fmtAge(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} giờ ${m % 60} phút`
  return `${Math.floor(h / 24)} ngày`
}

export function OpsDashboard({ role, tickets, categories, departments, handlerByTicket, devices, pendingAlerts, filter }: Props) {
  const [gran, setGran] = useState<Granularity>('day')
  const [sortBy, setSortBy] = useState<'newest' | 'deadline'>('newest')

  const inPeriod = useMemo(() => filterTickets(tickets, filter), [tickets, filter])
  const byDep = useMemo(() => filterTickets(tickets, { depId: filter.depId }), [tickets, filter.depId])
  const prev = previousRange(filter.from, filter.to)
  const prevTickets = useMemo(
    () => (prev ? filterTickets(tickets, { ...prev, depId: filter.depId }) : null),
    [tickets, prev?.from, prev?.to, filter.depId],
  )

  const k = computeKpis(inPeriod, categories)
  const pk = prevTickets ? computeKpis(prevTickets, categories) : null
  const stats = computeStats(inPeriod, categories, departments)
  const trend = trendSeries(byDep, gran, filter.from || undefined, filter.to || undefined)

  const statusData = STATUS_META.map((s) => {
    const n = stats.byStatus.find((x) => x.status === s.key)?.total || 0
    return { ...s, n, value: k.total ? Math.round((n / k.total) * 100) : 0, fill: s.color }
  })

  const active = byDep
    .filter((t) => t.status !== 'Closed')
    .sort((a, b) =>
      sortBy === 'newest'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime(),
    )
  const catName = new Map(categories.map((c) => [c.category_id, c.category_name || '']))

  return (
    <div className="flex flex-col gap-4">
      {/* Hang KPI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="flex flex-col justify-center gap-3 rounded-[24px] bg-[#0B3D73] p-5 text-white dark:bg-[#123A6B]">
          {role === 'Admin'
            ? <SummaryRow icon={<Inbox className="h-4 w-4" />} label="Chờ phân loại" value={String(pendingAlerts ?? '—')} />
            : <SummaryRow icon={<Inbox className="h-4 w-4" />} label="Đang mở" value={String(k.open)} />}
          <SummaryRow icon={<CheckCircle2 className="h-4 w-4" />} label="Đã đóng" value={String(k.closed)} />
          <SummaryRow icon={<ShieldCheck className="h-4 w-4" />} label="Đúng hạn SLA"
            value={k.slaRate === null ? '—' : `${k.slaRate.toFixed(1).replace('.', ',')}%`} />
        </div>
        <KpiCard
          label="Sự cố nghiêm trọng" icon={<AlertTriangle className="h-4 w-4" />}
          value={String(k.critical)} delta={pctChange(k.critical, pk?.critical ?? null)} goodWhen="down"
          progress={k.total ? k.critical / k.total : 0} hint={`Mức High/Critical · ${k.total} ticket`}
        />
        <KpiCard
          label="Thời gian xử lý TB" icon={<Timer className="h-4 w-4" />}
          value={fmtHours(k.mttrHours)} delta={pctChange(k.mttrHours, pk?.mttrHours ?? null)} goodWhen="down"
          progress={k.mttrHours && k.avgSlaHours ? Math.min(1, k.mttrHours / k.avgSlaHours) : 0}
          hint={k.avgSlaHours ? `So với hạn SLA TB ${fmtHours(k.avgSlaHours)}` : 'Chưa có ticket đóng'}
        />
        <KpiCard
          label="Tỷ lệ đúng hạn SLA" icon={<ShieldCheck className="h-4 w-4" />}
          value={k.slaRate === null ? '—' : `${Math.round(k.slaRate)}%`} delta={pctChange(k.slaRate, pk?.slaRate ?? null)} goodWhen="up"
          progress={(k.slaRate ?? 0) / 100} hint={`${k.closed} ticket đã đóng`}
        />
        <KpiCard
          label="Quá hạn đang mở" icon={<Clock className="h-4 w-4" />}
          value={String(k.overdueOpen)} delta={null} goodWhen="down" danger={k.overdueOpen > 0}
          progress={k.open ? k.overdueOpen / k.open : 0} hint={`Trên ${k.open} ticket đang mở`}
        />
      </div>
      {!prev && (
        <p className="-mt-1 text-xs text-muted-foreground">Chọn khoảng thời gian ở bộ lọc để xem % thay đổi so với kỳ trước.</p>
      )}

      {/* Xu huong + ty le trang thai + tinh trang giam sat */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-6">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Xu hướng sự cố</CardTitle>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <LegendDot color="var(--series-1)" label="Tạo mới" />
                <LegendDot color="var(--series-2)" label="Đã đóng" />
              </div>
            </div>
            <Segmented
              value={gran} onChange={(v) => setGran(v as Granularity)}
              options={[['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']]}
            />
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[240px] w-full">
              <LineChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" minTickGap={16} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                <ChartTooltip cursor={{ strokeDasharray: '4 4' }} content={<ChartTooltipContent />} />
                <Line dataKey="created" type="monotone" stroke="var(--color-created)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line dataKey="closed" type="monotone" stroke="var(--color-closed)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Trạng thái ticket</CardTitle>
            <Link href="/tickets" className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] hover:bg-muted" aria-label="Xem danh sách ticket">
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[170px]">
              <RadialBarChart data={statusData} innerRadius="38%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={12}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background={{ fill: 'var(--surface-soft)' }} cornerRadius={8} />
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
              </RadialBarChart>
            </ChartContainer>
            <div className="flex flex-col gap-1.5">
              {statusData.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-sm">
                  <LegendDot color={s.color} label={s.label} />
                  <span className="font-[650]">{s.value}% <span className="text-xs font-[520] text-muted-foreground">({s.n})</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardContent className="flex h-full flex-col gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--block-blue)] text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold">Tình trạng giám sát</p>
              <p className="text-sm text-muted-foreground">
                {devices ? `Đang giám sát ${devices.total} thiết bị` : 'Đang tải...'}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 text-sm">
              <InfoRow label="Thiết bị có sự cố mở"
                value={<span className={devices && devices.withOpen > 0 ? 'font-[780] text-red-700 dark:text-red-300' : 'font-[780]'}>{devices?.withOpen ?? '—'}</span>} />
              {role === 'Admin' && <InfoRow label="Cảnh báo chờ phân loại" value={<span className="font-[780]">{pendingAlerts ?? '—'}</span>} />}
              <InfoRow label="Ticket quá hạn" value={<span className="font-[780]">{k.overdueOpen}</span>} />
              <InfoRow label="Phân loại AI"
                value={<span className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground"><Bot className="h-3.5 w-3.5" />Chưa kích hoạt</span>} />
            </div>
            <Link href="/devices" className="mt-auto inline-flex h-10 items-center justify-center rounded-[17px] bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/85">
              Xem thiết bị
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Ticket dang mo + loi tat */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-9">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ticket đang mở ({active.length})</CardTitle>
            <Segmented value={sortBy} onChange={(v) => setSortBy(v as 'newest' | 'deadline')}
              options={[['newest', 'Mới nhất'], ['deadline', 'Sắp hết hạn']]} />
          </CardHeader>
          <CardContent>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có ticket nào đang mở.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {active.slice(0, 3).map((t) => {
                  const handler = handlerByTicket.get(t.ticket_id)
                  return (
                    <Link key={t.ticket_id} href={`/tickets/${t.ticket_id}`}
                      className="flex flex-col gap-3 rounded-2xl border bg-[var(--surface-soft)] p-4 transition-colors hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <TicketStatusTag status={t.status} />
                        <div className="text-right">
                          <p className="text-xs font-semibold">{t.ticket_code}</p>
                          <p className="text-xs text-muted-foreground">{fmtAge(t.created_at)}</p>
                        </div>
                      </div>
                      <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">
                        {t.incident_alert?.alert_summary || catName.get(t.category_id) || 'Sự cố'}
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar name={handler} />
                          <span className="truncate text-sm">{handler || 'Chưa giao'}</span>
                        </div>
                        <SlaBadge ticket={t} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
            {active.length > 3 && (
              <Link href="/tickets" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Xem tất cả {active.length} ticket <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--block-blue)] p-5 xl:col-span-3">
          <div>
            <p className="text-sm text-foreground/70">Lối tắt</p>
            <p className="text-lg font-semibold tracking-[-0.01em]">Bạn muốn làm gì tiếp?</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {role === 'Admin' && <Shortcut href="/work-queue" icon={<Inbox className="h-4 w-4" />} label="Việc cần xử lý" />}
            {role === 'Admin' && <Shortcut href="/incidents" icon={<AlertTriangle className="h-4 w-4" />} label="Hàng chờ cảnh báo" />}
            <Shortcut href="/tickets" icon={<Ticket className="h-4 w-4" />} label="Ticket · Xuất Excel" />
            <Shortcut href="/devices" icon={<Server className="h-4 w-4" />} label="Thiết bị" />
          </div>
          <div className="mt-auto flex items-center gap-2 rounded-full bg-background/70 px-4 py-2.5 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" /> Trợ lý AI sẽ có ở đây
          </div>
        </div>
      </div>

      {/* Phan tich chi tiet */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Ticket theo mức độ</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={countConfig} className="h-[180px] w-full">
              <BarChart data={stats.byPriority} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis dataKey="priority_level" type="category" tickLine={false} axisLine={false} width={72} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={4}>
                  {stats.byPriority.map((e) => <Cell key={e.priority_level} fill={severityColor(e.priority_level)} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ticket theo phòng ban</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={countConfig} className="h-[180px] w-full">
              <BarChart data={stats.byDept} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis dataKey="dep_name" type="category" tickLine={false} axisLine={false} width={120} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={4} fill="var(--series-1)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Hiệu suất theo phòng ban</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead className="text-right">Đã đóng</TableHead>
                  <TableHead className="text-right">TG TB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.deptPerf.map((d) => (
                  <TableRow key={d.dep_name}>
                    <TableCell className="max-w-[160px] truncate font-medium">{d.dep_name}</TableCell>
                    <TableCell className="text-right">{d.total_closed}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtHours(d.avg_hours_to_close)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15">{icon}</span>
      <span className="flex-1 whitespace-nowrap text-white/80">{label}</span>
      <span className="font-[780]">{value}</span>
    </div>
  )
}

function KpiCard({ label, icon, value, delta, goodWhen, progress, hint, danger }: {
  label: string; icon: React.ReactNode; value: string; delta: number | null
  goodWhen: 'up' | 'down'; progress: number; hint?: string; danger?: boolean
}) {
  const good = delta === null ? null : goodWhen === 'up' ? delta >= 0 : delta <= 0
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-[40px] leading-none font-[520] tracking-[-0.03em] ${danger ? 'text-red-700 dark:text-red-300' : ''}`}>{value}</span>
          {delta !== null && (
            <span className={`mb-1 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${good ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'}`}>
              {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta >= 0 ? '+' : ''}{Math.round(delta)}%
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div className={`h-full rounded-full ${danger ? 'bg-[#E05252]' : 'bg-primary'}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
          </div>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex gap-1 rounded-[14px] bg-[var(--surface-soft)] p-1">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-[10px] px-3 py-1 text-xs font-medium transition-colors ${value === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
      {value}
    </div>
  )
}

function Avatar({ name }: { name?: string }) {
  const initials = name ? name.trim().split(/\s+/).slice(-1)[0].charAt(0).toUpperCase() : '?'
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--block-blue)] text-xs font-semibold text-primary">
      {initials}
    </span>
  )
}

function Shortcut({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex flex-col gap-2 rounded-2xl bg-background/70 p-3 text-sm font-medium transition-colors hover:bg-background">
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  )
}
