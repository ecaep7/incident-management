'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StatusDot, ticketStatusColor } from '@/components/StatusDot'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default function TicketsPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [tickets, setTickets] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [statusFilter, setStatusFilter] = useState('all')
  const [directionFilter, setDirectionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('ticket')
        .select('ticket_id, ticket_code, status, direction, sla_deadline, is_sla_breached, created_at, incident_alert(alert_summary)')
        .order('created_at', { ascending: false })
      if (!error) setTickets(data)
      setLoadingData(false)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (directionFilter !== 'all' && t.direction !== directionFilter) return false
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      if (new Date(t.created_at) > end) return false
    }
    return true
  })

  function clearFilters() {
    setStatusFilter('all')
    setDirectionFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Danh sách Ticket</h1>
        <p className="text-muted-foreground">Tự động cập nhật mỗi 15 giây</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label>Trạng thái</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className="w-40">
              <SelectValue>{statusFilter === 'all' ? 'Tất cả' : statusFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="Assigned">Assigned</SelectItem>
                <SelectItem value="Pending Review">Pending Review</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Hướng xử lý</Label>
            <Select value={directionFilter} onValueChange={(v) => setDirectionFilter(v ?? 'all')}>
              <SelectTrigger className="w-40">
              <SelectValue>{directionFilter === 'all' ? 'Tất cả' : directionFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="SYSTEM">SYSTEM</SelectItem>
                <SelectItem value="ONSITE">ONSITE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tạo từ ngày</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Đến ngày</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>

          <Button onClick={clearFilters}>Xóa bộ lọc</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : tickets.length === 0 ? (
            <p className="p-6 text-muted-foreground">Chưa có ticket nào.</p>
          ) : filteredTickets.length === 0 ? (
            <p className="p-6 text-muted-foreground">Không có ticket nào khớp bộ lọc.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã ticket</TableHead>
                  <TableHead>Sự cố</TableHead>
                  <TableHead>Thời gian tạo</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Hướng xử lý</TableHead>
                  <TableHead>Hạn SLA</TableHead>
                  <TableHead>Quá hạn?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((t) => (
                  <TableRow key={t.ticket_id}>
                    <TableCell>
                      <Link href={`/tickets/${t.ticket_id}`} className="font-medium text-primary hover:underline">
                        {t.ticket_code}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">{t.incident_alert?.alert_summary || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <StatusDot label={t.status} color={ticketStatusColor(t.status)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.direction}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.sla_deadline).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      {t.is_sla_breached ? <Badge variant="destructive">Quá hạn</Badge> : <span className="text-muted-foreground">Không</span>}
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