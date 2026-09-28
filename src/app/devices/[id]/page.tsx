'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SeverityTag, IncidentStatusTag, TicketStatusTag, Tag } from '@/components/Tag'
import { SlaBadge } from '@/components/SlaBadge'
import { StatCard } from '@/components/StatCard'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

export default function DeviceDetailPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const role = profile?.role?.role_name
  const isAdmin = role === 'Admin'
  const params = useParams()
  const deviceId = Number(params.id)

  const [device, setDevice] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!role || !deviceId) return
    async function load() {
      const [summary, hist] = await Promise.all([
        supabase.rpc('list_device_summary'),
        supabase.rpc('get_device_history', { p_device_id: deviceId }),
      ])
      if (summary.error || hist.error) {
        setError((summary.error || hist.error)!.message)
      } else {
        setDevice((summary.data || []).find((d: any) => d.device_id === deviceId) || null)
        setHistory(hist.data || [])
      }
      setLoadingData(false)
    }
    load()
  }, [role, deviceId])

  if (loadingProfile || (loadingData && !error)) {
    return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  }
  if (role !== 'Admin' && role !== 'Viewer') return <div className="p-10 text-muted-foreground">Trang này dành cho Admin và Viewer.</div>
  if (error) return <div className="p-10 text-destructive">Không tải được dữ liệu: {error}</div>
  if (!device) return <div className="p-10 text-muted-foreground">Không tìm thấy thiết bị.</div>

  // So lieu tong hop tu lich su
  const tickets = history.filter((h) => h.ticket_id)
  const closed = tickets.filter((h) => h.ticket_status === 'Closed' && h.ticket_closed_at)
  const onTime = closed.filter((h) => new Date(h.ticket_closed_at) <= new Date(h.sla_deadline)).length
  const slaRate = closed.length ? `${Math.round((onTime / closed.length) * 100)}%` : '—'
  const avgHours = closed.length
    ? closed.reduce((n, h) => n + (new Date(h.ticket_closed_at).getTime() - new Date(h.ticket_created_at).getTime()) / 36e5, 0) / closed.length
    : null
  const catCount = new Map<string, number>()
  tickets.forEach((h) => h.category_name && catCount.set(h.category_name, (catCount.get(h.category_name) || 0) + 1))
  const topCategory = [...catCount].sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/devices" className="hover:underline">Thiết bị</Link> / {device.device_code}
          </p>
          <h1 className="text-2xl font-semibold">{device.device_name || device.device_code}</h1>
          <p className="mt-1 text-muted-foreground">
            {device.devicetype_name} · {device.management_ip}{device.location ? ` · ${device.location}` : ''}
          </p>
        </div>
        {device.device_status && <Tag tone={device.device_status === 'active' ? 'green' : 'gray'}>{device.device_status}</Tag>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tổng số sự cố (ticket)" value={tickets.length} color="blue" />
        <StatCard label="Đang mở" value={Number(device.open_tickets)} color="red" />
        <StatCard
          label="Tỷ lệ xử lý đúng hạn SLA"
          value={slaRate}
          color="green"
          hint={closed.length ? `${onTime}/${closed.length} ticket đã đóng · TB ${avgHours!.toFixed(1)} giờ` : 'Chưa có ticket đóng'}
        />
        {isAdmin ? (
          <StatCard label="Cảnh báo sai" value={Number(device.false_alerts)} color="amber" hint={`Trên tổng ${device.total_alerts} cảnh báo`} />
        ) : (
          <StatCard label="Loại sự cố hay gặp" value={topCategory ? topCategory[1] : 0} color="amber" hint={topCategory ? topCategory[0] : 'Chưa có'} />
        )}
      </div>

      {isAdmin && topCategory && (
        <p className="text-sm text-muted-foreground">
          Loại sự cố hay gặp nhất: <span className="font-medium text-foreground">{topCategory[0]}</span> ({topCategory[1]} lần)
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử sự cố ({history.length})</CardTitle>
          {!isAdmin && <p className="text-sm text-muted-foreground">Chỉ hiển thị các sự cố đã được xác minh và tạo ticket.</p>}
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-6 text-muted-foreground">Thiết bị này chưa có sự cố nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Loại sự cố</TableHead>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.incident_id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt(h.received_at)}</TableCell>
                    <TableCell><SeverityTag level={h.severity_level} /></TableCell>
                    <TableCell className="max-w-[280px]">
                      {isAdmin ? (
                        <Link href={`/incidents/${h.incident_id}`} className="hover:underline">{h.alert_summary}</Link>
                      ) : h.alert_summary}
                      {h.closed_reason && <p className="text-xs text-muted-foreground">Lý do từ chối: {h.closed_reason}</p>}
                    </TableCell>
                    <TableCell>
                      {h.ticket_id
                        ? <Link href={`/tickets/${h.ticket_id}`} className="font-medium text-primary hover:underline">{h.ticket_code}</Link>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{h.category_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{h.dep_name || '—'}</TableCell>
                    <TableCell>
                      {h.ticket_id ? <TicketStatusTag status={h.ticket_status} /> : <IncidentStatusTag status={h.alert_status} />}
                    </TableCell>
                    <TableCell>
                      {h.ticket_id
                        ? <SlaBadge ticket={{ sla_deadline: h.sla_deadline, status: h.ticket_status, closed_at: h.ticket_closed_at }} />
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
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
