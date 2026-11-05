'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'

// Thong ke canh bao theo nguon gui (ham get_alert_source_stats - fix21).
// Ham tu gioi han du lieu theo vai tro:
//   - Admin : moi nguon -> thanh ticket / canh bao sai / dang cho (bieu do cot chong)
//   - Viewer: chi so su co (canh bao da thanh ticket) theo nguon (bieu do tron, moi nguon mot mau)
// Ap dung bo loc thoi gian (theo thoi diem tiep nhan canh bao); khong ap dung loc phong ban
// vi canh bao chua duoc giao cho phong ban nao truoc khi thanh ticket.

type Row = {
  source_system: string
  total_alerts: number | null
  ticket_alerts: number
  false_alerts: number | null
  pending_alerts: number | null
}

const adminConfig = {
  ticket_alerts: { label: 'Thành ticket', color: 'var(--series-1)' },
  false_alerts: { label: 'Cảnh báo sai', color: '#94A3B8' },
  pending_alerts: { label: 'Đang chờ xử lý', color: 'var(--status-pending)' },
} satisfies ChartConfig

// Bang mau phan biet cac nguon (gan theo thu tu, nguon nhieu su co nhat mang mau dau tien)
const SOURCE_COLORS = ['#005BAA', '#C9701C', '#16A34A', '#7C3AED', '#0891B2', '#DB2777', '#64748B']
const colorAt = (i: number) => SOURCE_COLORS[i % SOURCE_COLORS.length]

// Chuyen ngay 'YYYY-MM-DD' (gio dia phuong) sang moc thoi gian, giong cach loc cua dashboard
const startOf = (d: string) => (d ? new Date(d + 'T00:00:00').toISOString() : null)
const endOf = (d: string) => (d ? new Date(d + 'T23:59:59.999').toISOString() : null)

export function AlertSourceCard({ role, filter }: {
  role: 'Admin' | 'Viewer'
  filter: { from: string; to: string; depId: string }
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_alert_source_stats', { p_from: startOf(filter.from), p_to: endOf(filter.to) })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) setError(err.message)
        else {
          setError('')
          setRows(((data || []) as any[]).map((r) => ({
            source_system: r.source_system,
            total_alerts: r.total_alerts === null ? null : Number(r.total_alerts),
            ticket_alerts: Number(r.ticket_alerts),
            false_alerts: r.false_alerts === null ? null : Number(r.false_alerts),
            pending_alerts: r.pending_alerts === null ? null : Number(r.pending_alerts),
          })))
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [filter.from, filter.to])

  const isAdmin = role === 'Admin'
  // Do day cot co gian theo so nguon: it nguon thi cot day hon, khong de trong qua nhieu
  const barSize = Math.max(18, Math.min(48, Math.floor(160 / Math.max(rows.length, 1)) - 8))
  const viewerTotal = rows.reduce((n, r) => n + r.ticket_alerts, 0)
  const pieConfig = Object.fromEntries(rows.map((r, i) => [r.source_system, { label: r.source_system, color: colorAt(i) }])) satisfies ChartConfig

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isAdmin ? 'Cảnh báo theo nguồn gửi' : 'Sự cố theo nguồn phát hiện'}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {isAdmin
            ? 'Số cảnh báo theo hệ thống nguồn, chia theo kết quả xử lý'
            : 'Số sự cố đã xác nhận thành ticket, theo hệ thống nguồn phát hiện'}
          {filter.depId !== 'all' && ' · Không áp dụng bộ lọc phòng ban'}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Không tải được thống kê: {error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có dữ liệu trong kỳ này.</p>
        ) : isAdmin ? (
          <>
            <ChartContainer config={adminConfig} className="h-[220px] w-full">
              <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis dataKey="source_system" type="category" tickLine={false} axisLine={false} width={120} fontSize={11} />
                <ChartTooltip cursor={{ fill: 'var(--surface-soft)' }} content={<ChartTooltipContent />} />
                <Bar dataKey="ticket_alerts" stackId="a" fill="var(--color-ticket_alerts)" barSize={barSize} />
                <Bar dataKey="false_alerts" stackId="a" fill="var(--color-false_alerts)" barSize={barSize} />
                <Bar dataKey="pending_alerts" stackId="a" fill="var(--color-pending_alerts)" radius={[0, 4, 4, 0]} barSize={barSize} />
              </BarChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(adminConfig).map(([k, v]) => <Legend key={k} color={v.color} label={v.label} />)}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center">
            <ChartContainer config={pieConfig} className="aspect-square h-[280px]">
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel nameKey="source_system"
                    formatter={(value, _n, item) => (
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.payload.fill }} />
                        <span className="text-muted-foreground">{item.payload.source_system}:</span>
                        <span className="font-[650] text-foreground">
                          {value} sự cố ({viewerTotal ? Math.round((100 * Number(value)) / viewerTotal) : 0}%)
                        </span>
                      </div>
                    )} />}
                />
                <Pie data={rows.map((r, i) => ({ ...r, fill: colorAt(i) }))} dataKey="ticket_alerts" nameKey="source_system"
                  outerRadius={120} strokeWidth={2}>
                  {rows.map((r, i) => <Cell key={r.source_system} fill={colorAt(i)} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
              {rows.map((r, i) => <Legend key={r.source_system} color={colorAt(i)} label={r.source_system} />)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
