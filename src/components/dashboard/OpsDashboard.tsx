'use client'

import { useMemo, useState } from 'react'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  AlertTriangle, Timer, ShieldCheck, Clock, Inbox, Server, Bot,
} from 'lucide-react'
import { severityColor } from '@/components/StatusDot'
import { TicketStatusTag } from '@/components/Tag'
import { SlaBadge } from '@/components/SlaBadge'
import {
  DashCard, DashHeader, DashTag, DotGrid, GridTable, InsightItem, LegendRow, Marker, MetricRow, Segmented, SoftLink, SummaryCard,
} from '@/components/dashboard/cap'
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
  // Mau theo phong ban: gan theo thu tu dep_id (co dinh), khong theo thu hang so luong
  const depColor = new Map(
    [...departments].sort((x, y) => x.dep_id - y.dep_id).map((d, i) => [d.dep_name, `var(--dep-${(i % 4) + 1})`]),
  )
  const colorOfDep = (name: string) => depColor.get(name) || 'var(--muted-foreground)'
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

  const ticketCols = [
    { label: 'Mã ticket', width: '1.35fr', render: (t: OpsTicket) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-primary">{t.ticket_code}</span>
        <span className="truncate text-micro text-muted-foreground">{fmtAge(t.created_at)}</span>
      </span>) },
    { label: 'Sự cố', width: '2.2fr', render: (t: OpsTicket) => (
      <span className="truncate">{t.incident_alert?.alert_summary || catName.get(t.category_id) || 'Sự cố'}</span>) },
    { label: 'Trạng thái', width: '1.1fr', render: (t: OpsTicket) => <TicketStatusTag status={t.status} /> },
    { label: 'Người xử lý', width: '1.3fr', render: (t: OpsTicket) => {
      const h = handlerByTicket.get(t.ticket_id)
      return <span className="flex min-w-0 items-center gap-2"><Avatar name={h} /><span className={`truncate ${h ? '' : 'text-muted-foreground'}`}>{h || 'Chưa giao'}</span></span>
    } },
    { label: 'SLA', width: '1.1fr', align: 'right' as const, render: (t: OpsTicket) => <SlaBadge ticket={t} /> },
  ]
  const perfCols = [
    { label: 'Phòng ban', width: '2.2fr', render: (d: { dep_name: string }) => (
      <span className="flex min-w-0 items-center gap-2"><Marker color={colorOfDep(d.dep_name)} className="size-2.5" />
        <span className="truncate" title={d.dep_name}>{d.dep_name}</span></span>) },
    { label: 'Đã đóng', width: '0.9fr', align: 'right' as const, render: (d: { total_closed: number }) => d.total_closed },
    { label: 'TG TB', width: '0.9fr', align: 'right' as const, render: (d: { avg_hours_to_close: number | null }) => <span className="text-muted-foreground">{fmtHours(d.avg_hours_to_close)}</span> },
  ]
  const needsAttention = k.overdueOpen > 0 || (pendingAlerts ?? 0) > 0

  return (
    <div className="flex flex-col gap-4">
      {/* The tong quan */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Sự cố nghiêm trọng" icon={<AlertTriangle />} value={String(k.critical)}
          delta={pctChange(k.critical, pk?.critical ?? null)} goodWhen="down"
          progress={k.total ? k.critical / k.total : 0} hint={`Mức High/Critical · trên ${k.total} ticket`} />
        <SummaryCard title="Thời gian xử lý TB" icon={<Timer />} value={fmtHours(k.mttrHours)}
          delta={pctChange(k.mttrHours, pk?.mttrHours ?? null)} goodWhen="down"
          progress={k.mttrHours && k.avgSlaHours ? Math.min(1, k.mttrHours / k.avgSlaHours) : 0}
          hint={k.avgSlaHours ? `So với hạn SLA TB ${fmtHours(k.avgSlaHours)}` : 'Chưa có ticket đóng'} />
        <SummaryCard title="Tỷ lệ đúng hạn SLA" icon={<ShieldCheck />} value={k.slaRate === null ? '—' : `${Math.round(k.slaRate)}%`}
          delta={pctChange(k.slaRate, pk?.slaRate ?? null)} goodWhen="up"
          progress={(k.slaRate ?? 0) / 100} hint={`Trên ${k.closed} ticket đã đóng`} />
        <SummaryCard title="Quá hạn đang mở" icon={<Clock />} value={String(k.overdueOpen)}
          delta={null} goodWhen="down" danger={k.overdueOpen > 0}
          progress={k.open ? k.overdueOpen / k.open : 0} hint={`Trên ${k.open} ticket đang mở`} />
      </div>
      {!prev && (
        <p className="-mt-1 text-micro text-muted-foreground">Chọn khoảng thời gian ở bộ lọc để xem % thay đổi so với kỳ trước.</p>
      )}

      {/* Xu huong + trang thai */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <DashHeader title="Xu hướng sự cố" subtitle="Số ticket tạo mới và đã đóng theo thời gian">
            <DashTag>{k.total} ticket trong kỳ</DashTag>
            <Segmented value={gran} onChange={(v) => setGran(v as Granularity)}
              options={[['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']]} />
          </DashHeader>
          <DotGrid className="flex flex-1 flex-col">
            <ChartContainer config={trendConfig} className="min-h-[260px] w-full flex-1">
              <LineChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" minTickGap={16} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                <ChartTooltip cursor={{ strokeDasharray: '4 4' }} content={<ChartTooltipContent />} />
                <Line dataKey="created" type="monotone" stroke="var(--color-created)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line dataKey="closed" type="monotone" stroke="var(--color-closed)" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ChartContainer>
          </DotGrid>
          <LegendRow items={[{ color: 'var(--series-1)', label: 'Tạo mới' }, { color: 'var(--series-2)', label: 'Đã đóng' }]} />
          <MetricRow items={[
            role === 'Admin'
              ? { label: 'Cảnh báo chờ phân loại', value: pendingAlerts ?? '—', note: 'Cảnh báo mới chưa xác minh' }
              : { label: 'Tổng ticket', value: k.total },
            { label: 'Đang mở', value: k.open, note: `${k.overdueOpen} quá hạn` },
            { label: 'Đã đóng', value: k.closed, note: `${k.total ? Math.round((k.closed / k.total) * 100) : 0}% tổng số ticket` },
            { label: 'Thiết bị có sự cố mở', value: devices ? `${devices.withOpen}/${devices.total}` : '—', danger: !!devices && devices.withOpen > 0, note: 'Trên số thiết bị giám sát' },
          ]} />
        </DashCard>

        <DashCard>
          <DashHeader title="Trạng thái ticket" subtitle="Tỷ lệ theo trạng thái trong kỳ">
            <DashTag>{k.open} đang mở</DashTag>
          </DashHeader>
          <div className="flex flex-1 items-center justify-center">
          <ChartContainer config={statusConfig} className="mx-auto aspect-square h-[230px]">
            <RadialBarChart data={statusData} innerRadius="38%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={12}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" background={{ fill: 'var(--surface-soft)' }} cornerRadius={8} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    className="min-w-[12rem]"
                    formatter={(value, _name, item) => (
                      <div className="flex w-full items-center gap-2 whitespace-nowrap">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.payload.color }} />
                        <span className="text-muted-foreground">{item.payload.label}</span>
                        <span className="ml-auto pl-3 font-[650] text-foreground">
                          {value}% <span className="font-normal text-muted-foreground">({item.payload.n} ticket)</span>
                        </span>
                      </div>
                    )}
                  />
                }
              />
            </RadialBarChart>
          </ChartContainer>
          </div>
          <div className="flex flex-col gap-4">
            {statusData.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex min-w-0 items-center gap-3">
                  <Marker color={s.color} className="size-3.5" />
                  <span className="truncate text-body text-foreground/80">{s.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="text-body font-[650]">{s.n}</span>
                  <span className="min-w-10 text-right text-body text-muted-foreground">{s.value}%</span>
                </span>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      {/* Phan tich chi tiet */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard>
          <DashHeader title="Ticket theo mức độ" subtitle="Số ticket theo mức ưu tiên" />
          <ChartContainer config={countConfig} className="h-[190px] w-full">
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
        </DashCard>

        <DashCard>
          <DashHeader title="Ticket theo phòng ban" subtitle="Số ticket được giao cho từng phòng" />
          <ChartContainer config={countConfig} className="h-[190px] w-full">
            <BarChart data={stats.byDept} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis dataKey="dep_name" type="category" tickLine={false} axisLine={false} width={120} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" radius={4}>
                {stats.byDept.map((e) => <Cell key={e.dep_name} fill={colorOfDep(e.dep_name)} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        </DashCard>

        <DashCard>
          <DashHeader title="Hiệu suất theo phòng ban" subtitle="Ticket đã đóng và thời gian xử lý TB" />
          <GridTable columns={perfCols} rows={stats.deptPerf} rowKey={(d) => d.dep_name} maxHeight="max-h-[220px]" empty="Chưa có ticket đóng." />
        </DashCard>
      </div>

      {/* Ticket dang mo + can chu y */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <DashHeader title={`Ticket đang mở (${active.length})`} subtitle="Bấm vào một dòng để xem chi tiết">
            <Segmented value={sortBy} onChange={(v) => setSortBy(v as 'newest' | 'deadline')}
              options={[['newest', 'Mới nhất'], ['deadline', 'Sắp hết hạn']]} />
            <SoftLink href="/tickets">Xem tất cả</SoftLink>
          </DashHeader>
          <GridTable columns={ticketCols} rows={active.slice(0, 6)} rowKey={(t) => t.ticket_id}
            rowHref={(t) => `/tickets/${t.ticket_id}`} empty="Không có ticket nào đang mở." />
        </DashCard>

        <DashCard>
          <DashHeader title="Cần chú ý" subtitle="Tình trạng giám sát hiện tại">
            <DashTag color={needsAttention ? '#C24848' : 'var(--status-closed)'}>{needsAttention ? 'Cần xử lý' : 'Ổn định'}</DashTag>
          </DashHeader>
          <div className="flex flex-col gap-5">
            <InsightItem first icon={<Clock />} tone={k.overdueOpen > 0 ? 'danger' : 'primary'}
              title={`${k.overdueOpen} ticket quá hạn SLA`}
              description={`Trong số ${k.open} ticket đang mở chưa được đóng.`}
              action={role === 'Admin' ? { label: 'Việc cần xử lý', href: '/work-queue' } : { label: 'Danh sách ticket', href: '/tickets' }} />
            {role === 'Admin' && (
              <InsightItem icon={<Inbox />} title={`${pendingAlerts ?? 0} cảnh báo chờ phân loại`}
                description="Cảnh báo mới từ hệ thống giám sát chưa được xác minh."
                action={{ label: 'Hàng chờ cảnh báo', href: '/incidents' }} />
            )}
            <InsightItem icon={<Server />}
              title={devices ? `${devices.withOpen}/${devices.total} thiết bị có sự cố mở` : 'Thiết bị'}
              description="Thiết bị đang có ticket chưa đóng."
              action={{ label: 'Xem thiết bị', href: '/devices' }} />
            <InsightItem icon={<Bot />} title="Phân loại AI"
              description="Chưa kích hoạt. Trợ lý AI sẽ gợi ý phân loại và hướng xử lý cho từng cảnh báo." />
          </div>
        </DashCard>
      </div>
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

