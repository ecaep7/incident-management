'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, LabelList } from 'recharts'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'

// Thong ke canh bao theo nguon gui (ham get_alert_source_stats - fix21).
// Ham tu gioi han du lieu theo vai tro:
//   - Admin : moi nguon -> thanh ticket / canh bao sai / dang cho, kem bang ty le canh bao sai
//   - Viewer: chi so su co (canh bao da thanh ticket) theo nguon
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

const viewerConfig = {
  ticket_alerts: { label: 'Số sự cố', color: 'var(--series-1)' },
} satisfies ChartConfig

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
  const chartHeight = Math.max(120, rows.length * 44)
  const falseRate = (r: Row) => (r.total_alerts ? Math.round((100 * (r.false_alerts ?? 0)) / r.total_alerts) : 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isAdmin ? 'Cảnh báo theo nguồn gửi' : 'Sự cố theo nguồn phát hiện'}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {isAdmin
            ? 'Số cảnh báo mỗi hệ thống nguồn gửi tới, chia theo kết quả xử lý'
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
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartContainer config={adminConfig} className="w-full" style={{ height: chartHeight }}>
                <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis dataKey="source_system" type="category" tickLine={false} axisLine={false} width={140} fontSize={13} />
                  <ChartTooltip cursor={{ fill: 'var(--surface-soft)' }} content={<ChartTooltipContent />} />
                  <Bar dataKey="ticket_alerts" stackId="a" fill="var(--color-ticket_alerts)" maxBarSize={22} />
                  <Bar dataKey="false_alerts" stackId="a" fill="var(--color-false_alerts)" maxBarSize={22} />
                  <Bar dataKey="pending_alerts" stackId="a" fill="var(--color-pending_alerts)" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {Object.entries(adminConfig).map(([k, v]) => <Legend key={k} color={v.color} label={v.label} />)}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nguồn</TableHead>
                  <TableHead className="text-right">Cảnh báo</TableHead>
                  <TableHead className="text-right">Tỷ lệ sai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.source_system}>
                    <TableCell className="max-w-[160px] truncate font-medium" title={r.source_system}>{r.source_system}</TableCell>
                    <TableCell className="text-right">{r.total_alerts}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{falseRate(r)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ChartContainer config={viewerConfig} className="w-full" style={{ height: chartHeight }}>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 32 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis dataKey="source_system" type="category" tickLine={false} axisLine={false} width={160} fontSize={14} />
              <ChartTooltip cursor={{ fill: 'var(--surface-soft)' }} content={<ChartTooltipContent />} />
              <Bar dataKey="ticket_alerts" fill="var(--color-ticket_alerts)" radius={4} maxBarSize={22}>
                <LabelList dataKey="ticket_alerts" position="right" fontSize={12} className="fill-foreground" />
              </Bar>
            </BarChart>
          </ChartContainer>
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
