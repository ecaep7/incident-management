'use client'

import { useEffect, useState } from 'react'
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

const chartConfig = { total: { label: 'Số lượng' } } satisfies ChartConfig

export default function DashboardPage() {
  const { profile, loading } = useProfile()
  const role = profile?.role?.role_name

  const [byStatus, setByStatus] = useState<any[]>([])
  const [byPriority, setByPriority] = useState<any[]>([])
  const [byDept, setByDept] = useState<any[]>([])
  const [slaSummary, setSlaSummary] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [slaCompliance, setSlaCompliance] = useState<any>(null)
  const [deptPerf, setDeptPerf] = useState<any[]>([])
  const [myPerf, setMyPerf] = useState<any>(null)

  useEffect(() => {
    if (!role) return
    async function load() {
      if (role === 'Admin' || role === 'Viewer') {
        const { data: s } = await supabase.from('dashboard_tickets_by_status').select('*')
        setByStatus(s || [])
        const { data: p } = await supabase.from('dashboard_tickets_by_priority').select('*')
        setByPriority(p || [])
        const { data: d } = await supabase.from('dashboard_tickets_by_department').select('*')
        setByDept(d || [])
      }
      if (role === 'Admin') {
        const { data: sla } = await supabase.from('dashboard_sla_summary').select('*').single()
        setSlaSummary(sla)
      }
      if (role === 'Viewer') {
        const { data: t } = await supabase.from('dashboard_ticket_trend').select('*')
        setTrend(t || [])
        const { data: c } = await supabase.from('dashboard_sla_compliance').select('*').single()
        setSlaCompliance(c)
        const { data: dp } = await supabase.from('dashboard_dept_performance').select('*')
        setDeptPerf(dp || [])
      }
      if (role === 'Handler') {
        const { data: mp } = await supabase.from('my_task_performance').select('*').single()
        setMyPerf(mp)
      }
    }
    load()
  }, [role])

  if (loading) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Chào {profile?.full_name}</p>
      </div>

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
                      { name: 'Trễ hạn', value: (slaCompliance?.total_closed ?? 0) - (slaCompliance?.closed_on_time ?? 0), color: '#DC2626' },
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
                  label={`Trễ hạn — ${(slaCompliance?.total_closed ?? 0) - (slaCompliance?.closed_on_time ?? 0)}`}
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