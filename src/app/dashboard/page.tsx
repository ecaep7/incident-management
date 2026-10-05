'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Inbox, AlertTriangle, Ticket, RotateCcw, ClipboardList } from 'lucide-react'
import { OpsDashboard, type OpsTicket } from '@/components/dashboard/OpsDashboard'
import { ReportDashboard } from '@/components/dashboard/ReportDashboard'
import { HandlerDashboard, useHandlerStats, type HandlerTask } from '@/components/dashboard/HandlerDashboard'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function DashboardPage() {
  const { profile, loading } = useProfile()
  const role = profile?.role?.role_name

  const [tickets, setTickets] = useState<OpsTicket[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [handlerByTicket, setHandlerByTicket] = useState<Map<number, string>>(new Map())
  const [devices, setDevices] = useState<{ total: number; withOpen: number } | null>(null)
  const [pendingAlerts, setPendingAlerts] = useState<number | null>(null)
  const [myTasks, setMyTasks] = useState<HandlerTask[]>([])

  // Bo loc (chi ap dung cho Admin / Viewer)
  const [preset, setPreset] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [depFilter, setDepFilter] = useState('all')

  useEffect(() => {
    if (!role) return
    async function load() {
      if (role === 'Admin' || role === 'Viewer') {
        // Chi DOC du lieu (theo RLS cua nguoi dang nhap), so lieu tinh o giao dien
        const [t, c, d, tasks, dir, dev] = await Promise.all([
          supabase.from('ticket').select('ticket_id, ticket_code, status, category_id, assigned_dep_id, created_at, closed_at, sla_deadline, incident_alert(alert_summary)'),
          supabase.from('incident_category').select('category_id, category_name, priority_level'),
          supabase.from('department').select('dep_id, dep_name').order('dep_id'),
          supabase.from('ticket_task').select('ticket_id, handler_user_id, created_at').order('created_at', { ascending: true }),
          supabase.rpc('list_user_directory'),
          supabase.rpc('list_device_summary'),
        ])
        setTickets((t.data as any as OpsTicket[]) || [])
        setCategories(c.data || [])
        setDepartments(d.data || [])
        const names = new Map<string, string>((dir.data || []).map((u: any) => [u.user_id, u.full_name]))
        const latest = new Map<number, string>()
        ;(tasks.data || []).forEach((tk: any) => latest.set(tk.ticket_id, names.get(tk.handler_user_id) || ''))
        setHandlerByTicket(latest)
        if (dev.data) {
          setDevices({ total: dev.data.length, withOpen: dev.data.filter((x: any) => Number(x.open_tickets) > 0).length })
        }
        if (role === 'Admin') {
          const { count } = await supabase.from('incident_alert').select('incident_id', { count: 'exact', head: true }).in('current_status', ['NEW', 'Verifying'])
          setPendingAlerts(count ?? 0)
        }
      }
      if (role === 'Handler') {
        // RLS chi tra ve task cua chinh Handler dang nhap
        const { data: mt } = await supabase
          .from('ticket_task')
          .select('task_id, ticket_id, direction, created_at, submitted_at, is_passed, admin_review_notes, reviewed_at, ticket(ticket_code, status, sla_deadline, closed_at, incident_alert(alert_summary, severity_level))')
          .order('created_at', { ascending: false })
        setMyTasks((mt as unknown as HandlerTask[]) || [])
      }
    }
    load()
  }, [role])

  const filter = useMemo(() => ({ from: dateFrom, to: dateTo, depId: depFilter }), [dateFrom, dateTo, depFilter])

  function applyPreset(v: string) {
    setPreset(v)
    if (v === 'all') { setDateFrom(''); setDateTo(''); return }
    if (v === 'custom') return
    const from = new Date()
    from.setDate(from.getDate() - Number(v) + 1)
    setDateFrom(toIso(from))
    setDateTo(toIso(new Date()))
  }

  const PRESET_LABEL: Record<string, string> = { all: 'Toàn bộ thời gian', '7': '7 ngày qua', '30': '30 ngày qua', custom: 'Tùy chọn' }
  const selectedDepName = depFilter === 'all' ? 'Tất cả phòng ban' : departments.find((d) => String(d.dep_id) === depFilter)?.dep_name
  const firstName = (profile?.full_name || '').trim().split(/\s+/).slice(-2).join(' ')

  const handlerStats = useHandlerStats(myTasks)

  if (loading) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  // Bo loc dung chung (thoi gian + phong ban). Viewer: dat cung hang voi nut Xuat bao cao
  const filterControls = (
    <>
      <Select value={preset} onValueChange={(v) => applyPreset(v ?? 'all')}>
        <SelectTrigger className="w-44"><SelectValue>{PRESET_LABEL[preset]}</SelectValue></SelectTrigger>
        <SelectContent>
          {Object.entries(PRESET_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" aria-label="Từ ngày" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPreset('custom') }} className="w-40" />
      <span className="text-muted-foreground">→</span>
      <Input type="date" aria-label="Đến ngày" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPreset('custom') }} className="w-40" />
      <Select value={depFilter} onValueChange={(v) => setDepFilter(v ?? 'all')}>
        <SelectTrigger className="w-64"><SelectValue>{selectedDepName}</SelectValue></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả phòng ban</SelectItem>
          {departments.map((d) => <SelectItem key={d.dep_id} value={String(d.dep_id)}>{d.dep_name}</SelectItem>)}
        </SelectContent>
      </Select>
      {(preset !== 'all' || depFilter !== 'all') && (
        <button onClick={() => { applyPreset('all'); setDepFilter('all') }}
          className="inline-flex h-9 items-center gap-1.5 rounded-[15px] px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" />Xóa bộ lọc
        </button>
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">
            {greeting()}, <span className="text-primary">{firstName}</span>
          </h1>
          {role !== 'Handler' && (
            <p className="text-sm text-muted-foreground">
              {role === 'Viewer' ? 'Báo cáo tình hình xử lý sự cố an toàn thông tin' : 'Tổng quan tình hình sự cố an toàn thông tin'}
            </p>
          )}
        </div>
        {role === 'Admin' && (
          <div className="flex gap-2">
            <Link href="/incidents" className="inline-flex h-10 items-center gap-2 rounded-[17px] border bg-card px-4 text-sm font-medium hover:bg-muted">
              <AlertTriangle className="h-4 w-4" />Hàng chờ cảnh báo
            </Link>
            <Link href="/work-queue" className="inline-flex h-10 items-center gap-2 rounded-[17px] bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85">
              <Inbox className="h-4 w-4" />Việc cần xử lý
            </Link>
          </div>
        )}
        {role === 'Handler' && (
          <Link href="/my-tasks" className="inline-flex h-10 items-center gap-2 rounded-[17px] bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85">
            <ClipboardList className="h-4 w-4" />Việc của tôi{handlerStats.todo.length ? ` (${handlerStats.todo.length})` : ''}
          </Link>
        )}
        {role === 'Viewer' && (
          <Link href="/tickets" className="inline-flex h-10 items-center gap-2 rounded-[17px] bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85">
            <Ticket className="h-4 w-4" />Danh sách ticket
          </Link>
        )}
      </div>

      {(role === 'Admin' || role === 'Viewer') && (
        <>
          {role === 'Viewer' ? (
            // Viewer (lanh dao / giam sat): dashboard dang bao cao
            <ReportDashboard tickets={tickets} categories={categories} departments={departments} filter={filter} filterControls={filterControls} />
          ) : (
          <>
          <div className="flex flex-wrap items-center gap-2">{filterControls}</div>
          <OpsDashboard
            role={role}
            tickets={tickets}
            categories={categories}
            departments={departments}
            handlerByTicket={handlerByTicket}
            devices={devices}
            pendingAlerts={pendingAlerts}
            filter={filter}
          />
          </>
          )}
        </>
      )}

{role === 'Handler' && <HandlerDashboard tasks={myTasks} />}
    </div>
  )
}
