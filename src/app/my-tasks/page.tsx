'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SlaBadge, getSlaState } from '@/components/SlaBadge'
import { SeverityTag, TaskResultTag } from '@/components/Tag'
import { StatCard } from '@/components/StatCard'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

type TabKey = 'todo' | 'review' | 'done' | 'all'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'todo', label: 'Cần xử lý' },
  { key: 'review', label: 'Chờ duyệt' },
  { key: 'done', label: 'Đã có kết quả' },
  { key: 'all', label: 'Tất cả' },
]

function tabOf(t: any): TabKey {
  if (t.submitted_at === null) return 'todo'
  if (t.is_passed === null) return 'review'
  return 'done'
}

export default function MyTasksPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [tab, setTab] = useState<TabKey | null>(null)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('ticket_task')
        .select('task_id, ticket_id, direction, submitted_at, is_passed, created_at, ticket(ticket_code, status, sla_deadline, closed_at, incident_alert(alert_summary, severity_level, device_ip))')
        .order('created_at', { ascending: false })
      if (!error) {
        // Viec chua nop len dau, sap xep theo han SLA gan nhat
        const sorted = [...(data || [])].sort((a: any, b: any) => {
          const aOpen = a.submitted_at === null ? 0 : 1
          const bOpen = b.submitted_at === null ? 0 : 1
          if (aOpen !== bOpen) return aOpen - bOpen
          return new Date(a.ticket?.sla_deadline || 0).getTime() - new Date(b.ticket?.sla_deadline || 0).getTime()
        })
        setTasks(sorted)
      }
      setLoadingData(false)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  const todo = tasks.filter((t) => tabOf(t) === 'todo')
  const review = tasks.filter((t) => tabOf(t) === 'review')
  const done = tasks.filter((t) => tabOf(t) === 'done')
  const atRisk = todo.filter((t) => {
    const { state } = getSlaState(t.ticket || {})
    return state === 'overdue' || state === 'due_soon'
  })
  const passed = done.filter((t) => t.is_passed).length
  const passRate = done.length ? `${Math.round((passed / done.length) * 100)}%` : '—'

  // Mac dinh mo tab "Can xu ly" neu con viec, nguoc lai mo "Tat ca"
  const activeTab: TabKey = tab ?? (todo.length > 0 ? 'todo' : 'all')
  const counts: Record<TabKey, number> = { todo: todo.length, review: review.length, done: done.length, all: tasks.length }

  const kw = keyword.trim().toLowerCase()
  const visible = tasks.filter((t) => {
    if (activeTab !== 'all' && tabOf(t) !== activeTab) return false
    if (kw) {
      const hay = `${t.ticket?.ticket_code || ''} ${t.ticket?.incident_alert?.alert_summary || ''} ${t.ticket?.incident_alert?.device_ip || ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]">Việc của tôi</h1>
        <p className="text-muted-foreground">
          Xin chào {profile?.full_name}{profile?.department?.dep_name ? ` · ${profile.department.dep_name}` : ''} · tự động cập nhật mỗi 15 giây
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cần xử lý" value={todo.length} color="blue" onClick={() => setTab('todo')} active={activeTab === 'todo'} />
        <StatCard label="Quá hạn / sắp hết hạn SLA" value={atRisk.length} color="red" hint="Trong số việc chưa nộp" onClick={() => setTab('todo')} />
        <StatCard label="Chờ Admin duyệt" value={review.length} color="amber" onClick={() => setTab('review')} active={activeTab === 'review'} />
        <StatCard label="Tỷ lệ đạt" value={passRate} color="green" hint={`${passed}/${done.length} việc đã duyệt`} onClick={() => setTab('done')} active={activeTab === 'done'} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-[15px] bg-[var(--surface-soft)] p-1">
            {TABS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={activeTab === t.key ? 'default' : 'ghost'}
                onClick={() => setTab(t.key)}
              >
                {t.label} ({counts[t.key]})
              </Button>
            ))}
          </div>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm mã ticket, nội dung, IP..."
            className="ml-auto w-64"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : tasks.length === 0 ? (
            <p className="p-6 text-muted-foreground">Chưa có việc nào được giao.</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-muted-foreground">
              {activeTab === 'todo' && !kw ? 'Bạn đã xử lý hết việc được giao.' : 'Không có việc nào khớp.'}
            </p>
          ) : (
            <Table maxHeight="max-h-[max(320px,calc(100dvh-33rem))]">
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Nội dung sự cố</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Hướng xử lý</TableHead>
                  <TableHead>Hạn SLA</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Kết quả</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => (
                  <TableRow key={t.task_id}>
                    <TableCell>
                      <Link href={`/my-tasks/${t.task_id}`} className="font-semibold text-primary hover:underline">
                        {t.ticket?.ticket_code || `Ticket #${t.ticket_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate">{t.ticket?.incident_alert?.alert_summary || '—'}</p>
                      <p className="text-xs text-muted-foreground">{t.ticket?.incident_alert?.device_ip}</p>
                    </TableCell>
                    <TableCell><SeverityTag level={t.ticket?.incident_alert?.severity_level} /></TableCell>
                    <TableCell className="text-muted-foreground">{t.direction}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.ticket?.sla_deadline ? new Date(t.ticket.sla_deadline).toLocaleString('vi-VN') : '—'}
                    </TableCell>
                    <TableCell>
                      {t.submitted_at === null ? <SlaBadge ticket={t.ticket} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><TaskResultTag task={t} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
