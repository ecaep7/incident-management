'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Cell as CellFill } from 'recharts'
import { Ticket, CheckCircle2, ShieldCheck, Timer, Download, Clock } from 'lucide-react'
import { severityColor } from '@/components/StatusDot'
import { computeKpis, filterTickets, pctChange, previousRange, trendSeries } from '@/lib/dashboardStats'
import { downloadCsv } from '@/lib/exportCsv'
import { type OpsTicket } from '@/components/dashboard/OpsDashboard'
import { DashCard, DashHeader, DashTag, DotGrid, GridTable, InsightItem, LegendRow, Marker, MetricRow, SummaryCard } from '@/components/dashboard/cap'

// Dashboard "bao cao" danh cho Viewer (lanh dao / giam sat, chi xem).
// Chi DOC du lieu ticket theo quyen cua Viewer, moi so lieu tinh o giao dien.

type Props = {
  tickets: OpsTicket[]
  categories: { category_id: number; category_name?: string; priority_level: string }[]
  departments: { dep_id: number; dep_name: string }[]
  filter: { from: string; to: string; depId: string }
  // Trang cha dung thanh dau trang (tieu de + bo loc); nut Xuat bao cao duoc truyen vao phan hanh dong
  topbar?: (exportAction: React.ReactNode) => React.ReactNode
}

const volumeConfig = {
  created: { label: 'Tạo mới', color: 'var(--series-1)' },
  closed: { label: 'Đã đóng', color: 'var(--series-2)' },
} satisfies ChartConfig
const slaConfig = { rate: { label: 'Đúng hạn SLA', color: 'var(--series-1)' } } satisfies ChartConfig

const PRIO_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const PRIO_LABEL: Record<string, string> = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }

const hoursBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 36e5
const isOnTime = (t: OpsTicket) => !!t.closed_at && new Date(t.closed_at).getTime() <= new Date(t.sla_deadline).getTime()

function fmtHours(h: number | null) {
  if (h === null) return '—'
  return h >= 24 ? `${(h / 24).toFixed(1).replace('.', ',')} ngày` : `${h.toFixed(1).replace('.', ',')} giờ`
}
const fmtPct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')}%`)

export function ReportDashboard({ tickets, categories, departments, filter, topbar }: Props) {
  const byDep = useMemo(() => filterTickets(tickets, { depId: filter.depId }), [tickets, filter.depId])
  const inPeriod = useMemo(() => filterTickets(byDep, { from: filter.from, to: filter.to }), [byDep, filter.from, filter.to])
  const prevRange = previousRange(filter.from || undefined, filter.to || undefined)
  const prev = useMemo(() => (prevRange ? filterTickets(byDep, prevRange) : null), [byDep, prevRange?.from, prevRange?.to])

  const k = computeKpis(inPeriod, categories)
  const pk = prev ? computeKpis(prev, categories) : null

  // Theo thang: so ticket tao moi / da dong, va ty le dong dung han SLA (tinh theo thang dong ticket)
  const months = trendSeries(byDep, 'month', filter.from || undefined, filter.to || undefined)
  const monthly = months.map((m, i) => {
    const start = m.key
    const end = months[i + 1]?.key ?? new Date(new Date(start).setMonth(new Date(start).getMonth() + 1)).getTime()
    const closedIn = byDep.filter((t) => t.closed_at && new Date(t.closed_at).getTime() >= start && new Date(t.closed_at).getTime() < end)
    const onTime = closedIn.filter(isOnTime).length
    return { ...m, rate: closedIn.length ? Math.round((onTime / closedIn.length) * 1000) / 10 : null, closedCount: closedIn.length }
  })

  // So sanh phong ban (mau gan theo dep_id, giong dashboard Admin)
  const sortedDeps = [...departments].sort((a, b) => a.dep_id - b.dep_id)
  const depColor = new Map(sortedDeps.map((d, i) => [d.dep_id, `var(--dep-${(i % 4) + 1})`]))
  const now = Date.now()
  const deptRows = sortedDeps
    .filter((d) => filter.depId === 'all' || String(d.dep_id) === filter.depId)
    .map((d) => {
      const ts = inPeriod.filter((t) => t.assigned_dep_id === d.dep_id)
      const closed = ts.filter((t) => t.status === 'Closed' && t.closed_at)
      const open = ts.filter((t) => t.status !== 'Closed')
      const onTime = closed.filter(isOnTime).length
      return {
        dep_id: d.dep_id,
        dep_name: d.dep_name,
        total: ts.length,
        open: open.length,
        closed: closed.length,
        slaRate: closed.length ? (onTime / closed.length) * 100 : null,
        mttr: closed.length ? closed.reduce((s, t) => s + hoursBetween(t.created_at, t.closed_at!), 0) / closed.length : null,
        overdueOpen: open.filter((t) => new Date(t.sla_deadline).getTime() < now).length,
      }
    })

  // Theo loai su co
  const catRows = categories
    .map((c) => {
      const ts = inPeriod.filter((t) => t.category_id === c.category_id)
      const closed = ts.filter((t) => t.status === 'Closed' && t.closed_at)
      return {
        name: c.category_name || `Loại #${c.category_id}`,
        prio: c.priority_level,
        total: ts.length,
        slaRate: closed.length ? (closed.filter(isOnTime).length / closed.length) * 100 : null,
      }
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total || PRIO_ORDER.indexOf(a.prio) - PRIO_ORDER.indexOf(b.prio))

  // Bieu do chi hien toi da 7 loai nhieu nhat + 1 thanh "Khac" gop phan con lai,
  // de chieu cao bieu do khong tang mai khi co them loai su co. File xuat bao cao van co day du.
  const MAX_BARS = 8
  const catChart = catRows.length <= MAX_BARS
    ? catRows
    : [
        ...catRows.slice(0, MAX_BARS - 1),
        {
          name: 'Khác',
          prio: 'OTHER',
          total: catRows.slice(MAX_BARS - 1).reduce((sum, c) => sum + c.total, 0),
          slaRate: null,
        },
      ]

  const periodLabel = filter.from || filter.to
    ? `${filter.from ? new Date(filter.from).toLocaleDateString('vi-VN') : '…'} – ${filter.to ? new Date(filter.to).toLocaleDateString('vi-VN') : 'nay'}`
    : 'Toàn bộ thời gian'
  const depLabel = filter.depId === 'all' ? 'Tất cả phòng ban' : departments.find((d) => String(d.dep_id) === filter.depId)?.dep_name || ''

  function exportReport() {
    const r: (string | number | null)[][] = []
    r.push(['Kỳ báo cáo', periodLabel, 'Phạm vi', depLabel, 'Ngày xuất', new Date().toLocaleString('vi-VN'), ''])
    r.push([])
    r.push(['CHỈ TIÊU CHÍNH', 'Giá trị', '', '', '', '', ''])
    r.push(['Tổng số ticket', k.total])
    r.push(['Đang mở', k.open])
    r.push(['Đã đóng', k.closed])
    r.push(['Tỷ lệ đóng đúng hạn SLA', fmtPct(k.slaRate)])
    r.push(['Thời gian xử lý trung bình', fmtHours(k.mttrHours)])
    r.push(['Ticket quá hạn đang mở', k.overdueOpen])
    r.push([])
    r.push(['SO SÁNH PHÒNG BAN', 'Tổng ticket', 'Đang mở', 'Đã đóng', 'Đúng hạn SLA', 'TG xử lý TB', 'Quá hạn đang mở'])
    deptRows.forEach((d) => r.push([d.dep_name, d.total, d.open, d.closed, fmtPct(d.slaRate), fmtHours(d.mttr), d.overdueOpen]))
    r.push([])
    r.push(['THEO THÁNG', 'Tạo mới', 'Đã đóng', 'Đúng hạn SLA', '', '', ''])
    monthly.forEach((m) => r.push([m.label, m.created, m.closed, m.rate === null ? '—' : fmtPct(m.rate)]))
    r.push([])
    r.push(['THEO LOẠI SỰ CỐ', 'Mức độ', 'Số ticket', 'Đúng hạn SLA', '', '', ''])
    catRows.forEach((c) => r.push([c.name, PRIO_LABEL[c.prio] || c.prio, c.total, fmtPct(c.slaRate)]))
    downloadCsv('bao_cao_tong_hop', ['BÁO CÁO TỔNG HỢP SỰ CỐ ATTT'], r)
  }

  // Nhan dinh nhanh
  const ratedDeps = deptRows.filter((d) => d.slaRate !== null)
  const weakest = ratedDeps.length ? ratedDeps.reduce((a, b) => (b.slaRate! < a.slaRate! ? b : a)) : null
  const topCat = catRows[0]
  const rated = monthly.filter((m) => m.rate !== null)
  const lastM = rated[rated.length - 1]
  const prevM = rated[rated.length - 2]
  const busiest = monthly.length ? monthly.reduce((a, b) => (b.created > a.created ? b : a)) : null

  const deptCols = [
    { label: 'Phòng ban', width: '2.8fr', render: (d: (typeof deptRows)[number]) => (
      <span className="flex min-w-0 items-center gap-2"><Marker color={depColor.get(d.dep_id) || 'var(--muted-foreground)'} className="size-2.5" />
        <span className="truncate font-medium" title={d.dep_name}>{d.dep_name}</span></span>) },
    { label: 'Tổng', width: '0.7fr', align: 'right' as const, render: (d: (typeof deptRows)[number]) => d.total },
    { label: 'Đang mở', width: '0.8fr', align: 'right' as const, render: (d: (typeof deptRows)[number]) => d.open },
    { label: 'Đúng hạn SLA', width: '1.8fr', render: (d: (typeof deptRows)[number]) => (
      <span className="flex w-full items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-soft)]">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(d.slaRate ?? 0)}%` }} />
        </span>
        <span className="w-14 text-right font-[650]">{fmtPct(d.slaRate)}</span>
      </span>) },
    { label: 'TG xử lý TB', width: '1fr', align: 'right' as const, render: (d: (typeof deptRows)[number]) => <span className="text-muted-foreground">{fmtHours(d.mttr)}</span> },
    { label: 'Quá hạn', width: '0.8fr', align: 'right' as const, render: (d: (typeof deptRows)[number]) => (
      <span className={d.overdueOpen > 0 ? 'font-[650] text-red-700 dark:text-red-300' : 'text-muted-foreground'}>{d.overdueOpen}</span>) },
  ]

  const exportAction = (
    <Button onClick={exportReport} disabled={inPeriod.length === 0} className="h-10">
      <Download className="mr-1 h-4 w-4" />Xuất báo cáo
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      {topbar?.(exportAction)}

      {/* The tong quan */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Tổng số ticket" icon={<Ticket />} value={String(k.total)}
          delta={pctChange(k.total, pk?.total ?? null)} goodWhen="down" progress={1}
          hint={`${k.open} đang mở · ${k.overdueOpen} quá hạn`} />
        <SummaryCard title="Đã đóng" icon={<CheckCircle2 />} value={String(k.closed)}
          delta={pctChange(k.closed, pk?.closed ?? null)} goodWhen="up"
          progress={k.total ? k.closed / k.total : 0} hint={`${k.total ? Math.round((k.closed / k.total) * 100) : 0}% tổng số ticket`} />
        <SummaryCard title="Tỷ lệ đúng hạn SLA" icon={<ShieldCheck />} value={fmtPct(k.slaRate)}
          delta={pctChange(k.slaRate, pk?.slaRate ?? null)} goodWhen="up"
          progress={(k.slaRate ?? 0) / 100} hint={`Trên ${k.closed} ticket đã đóng`} />
        <SummaryCard title="Thời gian xử lý TB" icon={<Timer />} value={fmtHours(k.mttrHours)}
          delta={pctChange(k.mttrHours, pk?.mttrHours ?? null)} goodWhen="down"
          progress={k.mttrHours && k.avgSlaHours ? k.mttrHours / k.avgSlaHours : 0}
          hint={k.avgSlaHours ? `Hạn SLA trung bình ${fmtHours(k.avgSlaHours)}` : undefined} />
      </div>
      {!prevRange && <p className="-mt-1 text-micro text-muted-foreground">Chọn khoảng thời gian ở bộ lọc để so sánh với kỳ trước.</p>}

      {/* Dien bien theo thang */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <DashHeader title="Số ticket theo tháng" subtitle="Ticket tạo mới và đã đóng trong từng tháng">
            <DashTag>{k.total} ticket trong kỳ</DashTag>
          </DashHeader>
          <DotGrid className="flex flex-1 flex-col">
            <ChartContainer config={volumeConfig} className="min-h-[240px] w-full flex-1">
              <BarChart data={monthly} barGap={2}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                <ChartTooltip cursor={{ fill: 'var(--surface-soft)' }} content={<ChartTooltipContent />} />
                <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="closed" fill="var(--color-closed)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </DotGrid>
          <LegendRow items={[{ color: 'var(--series-1)', label: 'Tạo mới' }, { color: 'var(--series-2)', label: 'Đã đóng' }]} />
          <MetricRow items={[
            { label: 'Đang mở', value: k.open, note: 'Ticket chưa đóng' },
            { label: 'Quá hạn đang mở', value: k.overdueOpen, danger: k.overdueOpen > 0, note: 'Đã quá hạn SLA' },
            { label: 'Hạn SLA trung bình', value: fmtHours(k.avgSlaHours), note: 'Theo loại sự cố' },
            { label: 'Tháng nhiều sự cố nhất', value: busiest && busiest.created ? busiest.label : '—', note: busiest && busiest.created ? `${busiest.created} ticket tạo mới` : undefined },
          ]} />
        </DashCard>

        <DashCard>
          <DashHeader title="Đúng hạn SLA theo tháng" subtitle="Tính trên ticket được đóng trong tháng">
            {lastM && <DashTag>{fmtPct(lastM.rate)}</DashTag>}
          </DashHeader>
          <ChartContainer config={slaConfig} className="min-h-[200px] w-full flex-1">
            <LineChart data={monthly} margin={{ top: 8, right: 16, left: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={40} fontSize={11} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _n, item) => (
                      <div className="flex w-full items-center gap-2 whitespace-nowrap">
                        <span className="text-muted-foreground">Đúng hạn SLA</span>
                        <span className="ml-auto pl-3 font-[650] text-foreground">
                          {String(value).replace('.', ',')}% <span className="font-normal text-muted-foreground">({item.payload.closedCount} ticket đóng)</span>
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Line dataKey="rate" type="linear" stroke="var(--color-rate)" strokeWidth={2} connectNulls
                dot={{ r: 4, fill: 'var(--color-rate)', stroke: 'var(--card)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ChartContainer>
          <div className="flex flex-col gap-3">
            {monthly.slice(-4).reverse().map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-3"><Marker color="var(--series-1)" />
                  <span className="text-body text-foreground/80">{m.label}</span></span>
                <span className="flex items-center gap-4">
                  <span className="text-caption text-muted-foreground">{m.closedCount} đóng</span>
                  <span className="min-w-14 text-right text-body font-[650]">{m.rate === null ? '—' : fmtPct(m.rate)}</span>
                </span>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      {/* So sanh phong ban + nhan dinh */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <DashCard className="xl:col-span-2">
          <DashHeader title="So sánh các phòng ban" subtitle="Khối lượng, tỷ lệ đúng hạn và thời gian xử lý" />
          <GridTable columns={deptCols} rows={deptRows} rowKey={(d) => d.dep_id} maxHeight="max-h-[320px]" />
        </DashCard>

        <DashCard>
          <DashHeader title="Nhận định nhanh" subtitle="Tự động rút ra từ số liệu trong kỳ" />
          <div className="flex flex-col gap-5">
            <InsightItem first icon={<ShieldCheck />} tone={weakest && (weakest.slaRate ?? 100) < 70 ? 'danger' : 'primary'}
              title={weakest ? `${weakest.dep_name}: ${fmtPct(weakest.slaRate)}` : 'Chưa có dữ liệu SLA'}
              description="Phòng ban có tỷ lệ đóng đúng hạn SLA thấp nhất trong kỳ." />
            <InsightItem icon={<Ticket />}
              title={topCat ? `${topCat.name}: ${topCat.total} ticket` : 'Chưa có ticket'}
              description="Loại sự cố xảy ra nhiều nhất, nên ưu tiên biện pháp phòng ngừa." />
            <InsightItem icon={<Timer />}
              title={lastM ? `SLA tháng ${lastM.label}: ${fmtPct(lastM.rate)}` : 'Chưa có tháng nào có ticket đóng'}
              description={lastM && prevM
                ? `${lastM.rate! >= prevM.rate! ? 'Tăng' : 'Giảm'} ${Math.abs(lastM.rate! - prevM.rate!).toFixed(1).replace('.', ',')} điểm so với tháng ${prevM.label}.`
                : 'Cần thêm dữ liệu để so sánh giữa các tháng.'} />
            <InsightItem icon={<Clock />} tone={k.overdueOpen > 0 ? 'danger' : 'primary'}
              title={`${k.overdueOpen} ticket quá hạn đang mở`}
              description={`Trong số ${k.open} ticket chưa đóng.`}
              action={{ label: 'Danh sách ticket', href: '/tickets' }} />
          </div>
        </DashCard>
      </div>

      {/* Theo loai su co */}
      <DashCard>
        <DashHeader title="Theo loại sự cố" subtitle="Tối đa 7 loại nhiều nhất, phần còn lại gộp vào Khác" />
        {catRows.length === 0 ? (
          <p className="text-body text-muted-foreground">Không có ticket trong kỳ này.</p>
        ) : (
          <ChartContainer config={{ total: { label: 'Số ticket' } }} className="w-full" style={{ height: Math.max(120, catChart.length * 40) }}>
            <BarChart data={catChart} layout="vertical" margin={{ left: 0, right: 32 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={180} fontSize={12} />
              <ChartTooltip cursor={{ fill: 'var(--surface-soft)' }} content={<ChartTooltipContent hideLabel nameKey="name"
                formatter={(value, _n, item) => (
                  <div className="flex w-full items-center gap-2 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: severityColor(item.payload.prio) }} />
                    <span className="text-muted-foreground">{item.payload.prio === 'OTHER' ? item.payload.name : `${item.payload.name} · ${PRIO_LABEL[item.payload.prio] || item.payload.prio}`}</span>
                    <span className="ml-auto pl-3 font-[650] text-foreground">{value} ticket</span>
                  </div>
                )} />} />
              <Bar dataKey="total" radius={4} maxBarSize={22}>
                {catChart.map((c) => <CellFill key={c.name} fill={severityColor(c.prio)} />)}
                <LabelList dataKey="total" position="right" fontSize={12} className="fill-foreground" />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
        <LegendRow items={[...PRIO_ORDER.map((p) => ({ color: severityColor(p), label: PRIO_LABEL[p] })),
          ...(catChart.length < catRows.length ? [{ color: severityColor('OTHER'), label: 'Khác' }] : [])]} />
      </DashCard>
    </div>
  )
}

