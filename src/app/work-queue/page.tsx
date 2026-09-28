'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot, severityColor, ticketStatusColor } from '@/components/StatusDot'
import { SlaBadge, getSlaState } from '@/components/SlaBadge'

// Trang chi DOC du lieu: gom cac viec Admin can xu ly vao mot cho.
// Khong goi RPC, khong ghi DB.

export default function WorkQueuePage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [newAlerts, setNewAlerts] = useState<any[]>([])
  const [openTickets, setOpenTickets] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: alerts } = await supabase
        .from('incident_alert')
        .select('incident_id, alert_summary, severity_level, device_ip, current_status, received_at')
        .in('current_status', ['NEW', 'Verifying'])
        .order('received_at', { ascending: false })
      setNewAlerts(alerts || [])

      const { data: tickets } = await supabase
        .from('ticket')
        .select('ticket_id, ticket_code, status, sla_deadline, closed_at, created_at, incident_alert(alert_summary)')
        .neq('status', 'Closed')
        .order('sla_deadline', { ascending: true })
      setOpenTickets(tickets || [])
      setLoadingData(false)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loadingProfile || loadingData) {
    return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  }
  if (profile?.role?.role_name !== 'Admin') {
    return <div className="p-10 text-muted-foreground">Trang này chỉ dành cho Admin.</div>
  }

  const pendingReview = openTickets.filter((t) => t.status === 'Pending Review')
  const slaRisk = openTickets.filter((t) => {
    const { state } = getSlaState(t)
    return state === 'overdue' || state === 'due_soon'
  })

  const summary = [
    { label: 'Cảnh báo chờ phân loại', value: newAlerts.length },
    { label: 'Ticket chờ duyệt', value: pendingReview.length },
    { label: 'Quá hạn / sắp hết hạn SLA', value: slaRisk.length },
    { label: 'Ticket đang mở', value: openTickets.length },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Việc cần xử lý</h1>
        <p className="text-muted-foreground">Tổng hợp những việc đang chờ Admin · tự động cập nhật mỗi 15 giây</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span className="text-3xl font-semibold">{s.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <QueueCard
        title="Cảnh báo chờ phân loại"
        empty="Không có cảnh báo mới."
        items={newAlerts}
        render={(a) => (
          <Link key={a.incident_id} href={`/incidents/${a.incident_id}`} className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted">
            <StatusDot label={a.severity_level} color={severityColor(a.severity_level)} />
            <span className="flex-1 font-medium">{a.alert_summary}</span>
            {a.current_status === 'Verifying' && <Badge variant="outline">Đang xác minh</Badge>}
            <span className="text-muted-foreground">{new Date(a.received_at).toLocaleString('vi-VN')}</span>
          </Link>
        )}
      />

      <QueueCard
        title="Ticket chờ duyệt kết quả"
        empty="Không có ticket nào chờ duyệt."
        items={pendingReview}
        render={(t) => <TicketRow key={t.ticket_id} t={t} />}
      />

      <QueueCard
        title="Ticket quá hạn hoặc sắp hết hạn SLA"
        empty="Chưa có ticket nào có nguy cơ trễ SLA."
        items={slaRisk}
        render={(t) => <TicketRow key={t.ticket_id} t={t} />}
      />
    </div>
  )
}

function QueueCard({ title, empty, items, render }: {
  title: string; empty: string; items: any[]; render: (item: any) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title} ({items.length})</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : items.map(render)}
      </CardContent>
    </Card>
  )
}

function TicketRow({ t }: { t: any }) {
  return (
    <Link href={`/tickets/${t.ticket_id}`} className="flex items-center gap-3 rounded-md border p-3 text-sm hover:bg-muted">
      <span className="font-medium text-primary">{t.ticket_code}</span>
      <span className="flex-1 truncate">{t.incident_alert?.alert_summary || '—'}</span>
      <StatusDot label={t.status} color={ticketStatusColor(t.status)} />
      <SlaBadge ticket={t} />
    </Link>
  )
}
