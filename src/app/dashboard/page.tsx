'use client'

import { useEffect, useMemo, useState } from 'react'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts'
import { StatusDot, severityColor, ticketStatusColor } from '@/components/StatusDot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { computeStats, filterTickets, type DashTicket } from '@/lib/dashboardStats'

const chartConfig = { total: { label: 'Số lượng' } } satisfies ChartConfig

export default function DashboardPage() {
  const { profile, loading } = useProfile()
  const role = profile?.role?.role_name

  const [tickets, setTickets] = useState<DashTicket[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [myPerf, setMyPerf] = useState<any>(null)

  // Bo loc (chi ap dung cho Admin / Viewer)
  const [preset, setPreset] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [depFilter, setDepFilter] = useState('all')

  useEffect(() => {
    if (!role) return
    async function load() {
      if (role === 'Admin' || role === 'Viewer') {
        // Lay du lieu tho (Admin/Viewer deu duoc doc bang ticket theo RLS)
        // roi tinh so lieu o giao dien de loc duoc theo thoi gian va phong ban
        const [t, c, d] = await Promise.all([
          supabase.from('ticket').select('ticket_id, status, category_id, assigned_dep_id, created_at, closed_at, sla_deadline'),
          supabase.from('incident_category').select('category_id, priority_level'),
          supabase.from('department').select('dep_id, dep_name').order('dep_id'),
        ])
        setTickets((t.data as DashTicket[]) || [])
        setCategories(c.data || [])
        setDepartments(d.data || [])
      }
      if (role === 'Handler') {
        const { data: mp } = await supabase.from('my_task_performance').select('*').single()
        setMyPerf(mp)
      }
    }
    load()
  }, [role])

  const stats = useMemo(
    () => computeStats(filterTickets(tickets, { from: dateFrom, to: dateTo, depId: depFilter }), categories, departments),
    [tickets, categories, departments, dateFrom, dateTo, depFilter],
  )
  const { byStatus, byPriority, byDept, slaSummary, trend, slaCompliance, deptPerf } = stats

  function applyPreset(v: string) {
    setPreset(v)
    if (v === 'all') { setDateFrom(''); setDateTo(''); return }
    if (v === 'custom') return
    const days = Number(v)
    const from = new Date()
    from.setDate(from.getDate() - days + 1)
    const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setDateFrom(toIso(from))
    setDateTo(toIso(new Date()))
  }

  const PRESET_LABEL: Record<string, string> = { all: 'Toàn bộ thời gian', '7': '7 ngày qua', '30': '30 ngày qua', custom: 'Tùy chọn' }
  const selectedDepName = depFilter === 'all' ? 'Tất cả phòng ban' : departments.find((d) => String(d.dep_id) === depFilter)?.dep_name

  if (loading) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Chào {profile?.full_name}</p>
      </div>

      {(role === 'Admin' || role === 'Viewer') && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <Label>Khoảng thời gian</Label>
              <Select value={preset} onValueChange={(v) => applyPreset(v ?? 'all')}>
                <SelectTrigger className="w-44"><SelectValue>{PRESET_LABEL[preset]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESET_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Từ ngày</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset('custom') }} className="w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Đến ngày</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset('custom') }} className="w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Phòng ban</Label>
              <Select value={depFilter} onValueChange={(v) => setDepFilter(v ?? 'all')}>
                <SelectTrigger className="w-64"><SelectValue>{selectedDepName}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả phòng ban</SelectItem>
                  {departments.map((d) => <SelectItem key={d.dep_id} value={String(d.dep_id)}>{d.dep_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { applyPreset('all'); setDepFilter('all') }}>Xóa bộ lọc</Button>
            <p className="ml-auto text-sm text-muted-foreground">
              Đang tính trên {byStatus.reduce((n, x) => n + x.total, 0)} / {tickets.length} ticket (theo ngày tạo ticket)
            </p>
          </CardContent>
        </Card>
      )}

      {role === 'Admin' && slaSummary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ticket đang mở</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{slaSummary.total_open}</div>
            </CardContent>
          </Card>
          <Card className={slaSummary.total_breached > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Đã quá hạn SLA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-semibold ${slaSummary.total_breached > 0 ? 'text-destructive' : ''}`}>
                {slaSummary.total_breached}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(role === 'Admin' || role === 'Viewer') && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Ticket theo trạng thái</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-4">
              <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[180px] flex-1">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={byStatus} dataKey="total" nameKey="status" innerRadius={45} strokeWidth={3}>
                    {byStatus.map((entry) => (
                      <Cell key={entry.status} fill={ticketStatusColor(entry.status)} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-2">
                {byStatus.map((x) => (
                  <StatusDot key={x.status} label={`${x.status} — ${x.total}`} color={ticketStatusColor(x.status)} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ticket theo mức độ</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[180px] w-full">
                <BarChart data={byPriority} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="priority_level" type="category" tickLine={false} axisLine={false} width={72} fontSize={12} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" radius={4}>
                    {byPriority.map((entry) => (
                      <Cell key={entry.priority_level} fill={severityColor(entry.priority_level)} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ticket theo phòng ban</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-45 w-full">
                <BarChart data={byDept} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="dep_name" type="category" tickLine={false} axisLine={false} width={110} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" radius={4}>
                    {byDept.map((entry, i) => (
                      <Cell key={entry.dep_name} fill={`var(--chart-${(i % 5) + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {role === 'Viewer' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Xu hướng ticket theo tuần</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <AreaChart data={trend}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="week_start"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="total" type="monotone" fill="var(--primary)" fillOpacity={0.15} stroke="var(--primary)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tỷ lệ tuân thủ SLA</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-4">
              <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-45 flex-1">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={[
                      { name: 'Đúng hạn', value: slaCompliance?.closed_on_time ?? 0, color: '#16A34A' },
                      { name: 'Quá hạn', value: (slaCompliance?.total_closed ?? 0) - (slaCompliance?.closed_on_time ?? 0), color: '#DC2626' },
                    ]}
                    dataKey="value" nameKey="name" innerRadius={45} strokeWidth={3}
                  >
                    <Cell fill="#16A34A" />
                    <Cell fill="#DC2626" />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-2">
                <div className="text-3xl font-semibold">{slaCompliance?.compliance_rate_percent ?? 0}%</div>
                <StatusDot label={`Đúng hạn — ${slaCompliance?.closed_on_time ?? 0}`} color="#16A34A" />
                <StatusDot
                  label={`Quá hạn — ${(slaCompliance?.total_closed ?? 0) - (slaCompliance?.closed_on_time ?? 0)}`}
                  color="#DC2626"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Hiệu suất theo phòng ban</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phòng ban</TableHead>
                    <TableHead className="text-right">Ticket đã đóng</TableHead>
                    <TableHead className="text-right">TG xử lý trung bình</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptPerf.map((d) => (
                    <TableRow key={d.dep_name}>
                      <TableCell className="font-medium">{d.dep_name}</TableCell>
                      <TableCell className="text-right">{d.total_closed}</TableCell>
                      <TableCell className="text-right">
                        {d.avg_hours_to_close ? `${d.avg_hours_to_close.toFixed(1)} giờ` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

{role === 'Handler' && myPerf && (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle className="text-base">Hiệu suất của bạn</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-3xl font-semibold">{myPerf.total_tasks}</div>
            <p className="text-sm text-muted-foreground">Tổng số task</p>
          </div>
          <div>
            <div className="text-3xl font-semibold text-green-600">{myPerf.passed}</div>
            <p className="text-sm text-muted-foreground">Đạt</p>
          </div>
          <div>
            <div className="text-3xl font-semibold text-destructive">{myPerf.failed}</div>
            <p className="text-sm text-muted-foreground">Không đạt</p>
          </div>
          <div>
            <div className="text-3xl font-semibold">
              {myPerf.avg_hours_to_submit ? myPerf.avg_hours_to_submit.toFixed(1) : '—'}
              {myPerf.avg_hours_to_submit ? <span className="text-base font-normal text-muted-foreground"> giờ</span> : null}
            </div>
            <p className="text-sm text-muted-foreground">TG xử lý TB</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Phân bổ kết quả</CardTitle></CardHeader>
      <CardContent className="flex items-center gap-4">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-35 flex-1">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={[
                { name: 'Đạt', total: myPerf.passed },
                { name: 'Không đạt', total: myPerf.failed },
                { name: 'Chưa nộp', total: myPerf.pending },
              ]}
              dataKey="total" nameKey="name" innerRadius={35} strokeWidth={3}
            >
              <Cell fill="#16A34A" />
              <Cell fill="#DC2626" />
              <Cell fill="#94A3B8" />
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="flex flex-col gap-2">
          <StatusDot label={`Đạt — ${myPerf.passed}`} color="#16A34A" />
          <StatusDot label={`Không đạt — ${myPerf.failed}`} color="#DC2626" />
          <StatusDot label={`Chưa nộp — ${myPerf.pending}`} color="#94A3B8" />
        </div>
      </CardContent>
    </Card>
  </div>
)}
    </div>
  )
}