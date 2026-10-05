'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ClipboardList, Hourglass, CircleCheck, Timer, ArrowRight, PartyPopper, MessageSquareText } from 'lucide-react'
import { StatusDot } from '@/components/StatusDot'
import { SeverityTag, TaskResultTag } from '@/components/Tag'
import { SlaBadge, getSlaState } from '@/components/SlaBadge'
import { KpiCard } from '@/components/dashboard/OpsDashboard'

// Dashboard cua Handler: chi DOC cac task cua chinh minh (RLS), moi so lieu tinh o giao dien.

export type HandlerTask = {
  task_id: number
  ticket_id: number
  direction: string | null
  created_at: string | null
  submitted_at: string | null
  is_passed: boolean | null
  admin_review_notes: string | null
  reviewed_at: string | null
  ticket: {
    ticket_code: string | null
    status: string | null
    sla_deadline: string | null
    closed_at: string | null
    incident_alert: { alert_summary: string | null; severity_level: string | null } | null
  } | null
}

const COLOR = { passed: '#16A34A', failed: '#DC2626', review: '#F59E0B', todo: '#94A3B8' }

const weeklyConfig = {
  passed: { label: 'Đạt', color: COLOR.passed },
  failed: { label: 'Không đạt', color: COLOR.failed },
  review: { label: 'Chờ duyệt', color: COLOR.review },
} satisfies ChartConfig
const pieConfig = { total: { label: 'Số task' } } satisfies ChartConfig

const WEEKS = 8

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7 // Thu 2 = 0
  x.setDate(x.getDate() - day)
  return x
}

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

function relTime(v: string) {
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)} phút trước`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.round(h / 24)
  return d < 30 ? `${d} ngày trước` : new Date(v).toLocaleDateString('vi-VN')
}

export function useHandlerStats(tasks: HandlerTask[]) {
  return useMemo(() => {
    const todo = tasks
      .filter((t) => t.submitted_at === null)
      .sort((a, b) => new Date(a.ticket?.sla_deadline || 8.64e15).getTime() - new Date(b.ticket?.sla_deadline || 8.64e15).getTime())
    const review = tasks.filter((t) => t.submitted_at !== null && t.is_passed === null)
    const done = tasks.filter((t) => t.submitted_at !== null && t.is_passed !== null)
    const passed = done.filter((t) => t.is_passed).length
    const atRisk = todo.filter((t) => {
      const { state } = getSlaState(t.ticket || {})
      return state === 'overdue' || state === 'due_soon'
    }).length
    const submitted = tasks.filter((t) => t.submitted_at && t.created_at)
    const avgHours = submitted.length
      ? submitted.reduce((s, t) => s + (new Date(t.submitted_at!).getTime() - new Date(t.created_at!).getTime()) / 36e5, 0) / submitted.length
      : null
    return { todo, review, done, passed, failed: done.length - passed, atRisk, avgHours }
  }, [tasks])
}

export function HandlerDashboard({ tasks }: { tasks: HandlerTask[] }) {
  const s = useHandlerStats(tasks)
  const total = tasks.length
  const passRate = s.done.length ? s.passed / s.done.length : null

  // Task da nop theo tuan (8 tuan gan nhat), chia theo ket qua
  const weekly = useMemo(() => {
    const first = startOfWeek(new Date())
    first.setDate(first.getDate() - (WEEKS - 1) * 7)
    const rows = Array.from({ length: WEEKS }, (_, i) => {
      const d = new Date(first); d.setDate(d.getDate() + i * 7)
      return { label: ddmm(d), start: d.getTime(), passed: 0, failed: 0, review: 0 }
    })
    tasks.forEach((t) => {
      if (!t.submitted_at) return
      const idx = Math.floor((startOfWeek(new Date(t.submitted_at)).getTime() - first.getTime()) / (7 * 864e5) + 0.01)
      if (idx < 0 || idx >= WEEKS) return
      const r = rows[idx]
      if (t.is_passed === null) r.review++
      else if (t.is_passed) r.passed++
      else r.failed++
    })
    return rows
  }, [tasks])
  const weeklyTotal = weekly.reduce((n, r) => n + r.passed + r.failed + r.review, 0)

  const feedback = useMemo(
    () => s.done
      .slice()
      .sort((a, b) => new Date(b.reviewed_at || b.submitted_at || 0).getTime() - new Date(a.reviewed_at || a.submitted_at || 0).getTime())
      .slice(0, 3),
    [s.done],
  )

  const pieData = [
    { name: 'Đạt', total: s.passed, color: COLOR.passed },
    { name: 'Không đạt', total: s.failed, color: COLOR.failed },
    { name: 'Chờ duyệt', total: s.review.length, color: COLOR.review },
    { name: 'Chưa nộp', total: s.todo.length, color: COLOR.todo },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Hang 1: KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Cần xử lý" icon={<ClipboardList className="h-4 w-4" />}
          value={String(s.todo.length)} delta={null} goodWhen="down"
          progress={total ? s.todo.length / total : 0}
          hint={s.atRisk ? `${s.atRisk} việc quá hạn / sắp hết hạn SLA` : 'Không có việc nào sắp trễ hạn'}
          danger={s.atRisk > 0}
        />
        <KpiCard
          label="Chờ Admin duyệt" icon={<Hourglass className="h-4 w-4" />}
          value={String(s.review.length)} delta={null} goodWhen="down"
          progress={total ? s.review.length / total : 0}
          hint="Đã nộp, đang chờ kết quả"
        />
        <KpiCard
          label="Tỷ lệ đạt" icon={<CircleCheck className="h-4 w-4" />}
          value={passRate === null ? '—' : `${Math.round(passRate * 100)}%`} delta={null} goodWhen="up"
          progress={passRate ?? 0}
          hint={`${s.passed}/${s.done.length} việc đã được duyệt`}
        />
        <KpiCard
          label="TG xử lý trung bình" icon={<Timer className="h-4 w-4" />}
          value={s.avgHours === null ? '—' : `${s.avgHours.toFixed(1)}h`} delta={null} goodWhen="down"
          progress={s.avgHours === null ? 0 : Math.min(1, s.avgHours / 24)}
          hint="Từ lúc được giao đến lúc nộp kết quả"
        />
      </div>

      {/* Hang 2: viec can lam + phan bo ket qua */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Việc cần làm</CardTitle>
            <Link href="/my-tasks" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Xem tất cả{s.todo.length ? ` (${s.todo.length})` : ''}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {s.todo.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--block-blue)] text-primary">
                  <PartyPopper className="h-5 w-5" />
                </span>
                <p className="font-medium">Bạn đã xử lý hết việc được giao</p>
                <p className="text-sm text-muted-foreground">Việc mới sẽ xuất hiện ở đây khi Admin phân công.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y">
                {s.todo.slice(0, 5).map((t) => (
                  <li key={t.task_id}>
                    <Link
                      href={`/my-tasks/${t.task_id}`}
                      className="-mx-2 flex items-center gap-4 rounded-[8px] px-2 py-3 transition-colors hover:bg-[var(--surface-soft)]"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-primary">{t.ticket?.ticket_code || `Ticket #${t.ticket_id}`}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{t.direction === 'ONSITE' ? 'Hiện trường' : t.direction === 'SYSTEM' ? 'Hệ thống' : t.direction}</span>
                        </div>
                        <p className="truncate text-sm text-foreground/80">{t.ticket?.incident_alert?.alert_summary || '—'}</p>
                      </div>
                      <div className="hidden w-24 shrink-0 text-sm sm:block">
                        <SeverityTag level={t.ticket?.incident_alert?.severity_level} />
                      </div>
                      <div className="shrink-0"><SlaBadge ticket={t.ticket} /></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Phân bổ kết quả</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="relative mx-auto aspect-square max-h-40 flex-1">
              <ChartContainer config={pieConfig} className="aspect-square max-h-40">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={pieData} dataKey="total" nameKey="name" innerRadius={48} outerRadius={70} strokeWidth={2} stroke="var(--card)">
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-[520] leading-none tracking-[-0.02em]">{total}</span>
                <span className="text-xs text-muted-foreground">task</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              {pieData.map((d) => <StatusDot key={d.name} label={`${d.name} — ${d.total}`} color={d.color} />)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hang 3: nhip lam viec theo tuan + phan hoi gan day */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle>Task đã nộp theo tuần</CardTitle>
              <p className="text-sm text-muted-foreground">{WEEKS} tuần gần nhất · {weeklyTotal} task</p>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Legend color={COLOR.passed} label="Đạt" />
              <Legend color={COLOR.failed} label="Không đạt" />
              <Legend color={COLOR.review} label="Chờ duyệt" />
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ChartContainer config={weeklyConfig} className="aspect-auto h-full min-h-[220px] w-full">
              <BarChart data={weekly}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
                <ChartTooltip cursor={{ fill: 'var(--surface-soft)' }} content={<ChartTooltipContent labelFormatter={(l) => `Tuần từ ${l}`} />} />
                <Bar dataKey="passed" stackId="w" fill="var(--color-passed)" stroke="var(--card)" strokeWidth={2} maxBarSize={32} />
                <Bar dataKey="failed" stackId="w" fill="var(--color-failed)" stroke="var(--card)" strokeWidth={2} maxBarSize={32} />
                <Bar dataKey="review" stackId="w" fill="var(--color-review)" stroke="var(--card)" strokeWidth={2} maxBarSize={32} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Phản hồi gần đây</CardTitle></CardHeader>
          <CardContent>
            {feedback.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <MessageSquareText className="h-5 w-5" />
                Chưa có kết quả nào được Admin duyệt.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {feedback.map((t) => (
                  <li key={t.task_id}>
                    <Link href={`/my-tasks/${t.task_id}`} className="-mx-2 flex flex-col gap-1.5 rounded-[8px] px-2 py-2 transition-colors hover:bg-[var(--surface-soft)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">{t.ticket?.ticket_code || `Ticket #${t.ticket_id}`}</span>
                        <TaskResultTag task={t} />
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground/70">
                        {t.admin_review_notes || <span className="text-muted-foreground">(Không có nhận xét)</span>}
                      </p>
                      {(t.reviewed_at || t.submitted_at) && (
                        <span className="text-xs text-muted-foreground">Duyệt {relTime((t.reviewed_at || t.submitted_at)!)}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
