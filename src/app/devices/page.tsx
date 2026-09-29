'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tag } from '@/components/Tag'
import { StatCard } from '@/components/StatCard'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// Danh sach thiet bi kem so lieu su co. Du lieu lay qua ham list_device_summary()
// (Admin thay them so canh bao / canh bao sai; Viewer chi thay so lieu ticket).

export default function DevicesPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const role = profile?.role?.role_name
  const isAdmin = role === 'Admin'

  const [devices, setDevices] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    if (!role) return
    async function load() {
      const { data, error } = await supabase.rpc('list_device_summary')
      if (error) setError(error.message)
      else setDevices(data || [])
      setLoadingData(false)
    }
    load()
  }, [role])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (role !== 'Admin' && role !== 'Viewer') {
    return <div className="p-10 text-muted-foreground">Trang này dành cho Admin và Viewer.</div>
  }

  const types = [...new Set(devices.map((d) => d.devicetype_name).filter(Boolean))]
  const kw = keyword.trim().toLowerCase()
  const visible = devices.filter((d) => {
    if (typeFilter !== 'all' && d.devicetype_name !== typeFilter) return false
    if (kw && !`${d.device_code} ${d.device_name} ${d.management_ip} ${d.location || ''}`.toLowerCase().includes(kw)) return false
    return true
  })

  const totalTickets = devices.reduce((n, d) => n + Number(d.total_tickets || 0), 0)
  const openTickets = devices.reduce((n, d) => n + Number(d.open_tickets || 0), 0)
  const devicesWithOpen = devices.filter((d) => Number(d.open_tickets) > 0).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.03em]">Thiết bị</h1>
        <p className="text-muted-foreground">Theo dõi lịch sử sự cố của từng thiết bị</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Thiết bị đang quản lý" value={devices.length} color="blue" />
        <StatCard label="Thiết bị có sự cố đang mở" value={devicesWithOpen} color="red" />
        <StatCard label="Ticket đang mở" value={openTickets} color="amber" />
        <StatCard label="Tổng số sự cố (ticket)" value={totalTickets} color="orange" />
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label>Tìm kiếm</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Mã, tên, IP, vị trí..." className="w-64" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Loại thiết bị</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
              <SelectTrigger className="w-44"><SelectValue>{typeFilter === 'all' ? 'Tất cả' : typeFilter}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setKeyword(''); setTypeFilter('all') }}>Xóa bộ lọc</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : error ? (
            <p className="p-6 text-destructive">Không tải được dữ liệu thiết bị: {error}</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-muted-foreground">Không có thiết bị nào khớp.</p>
          ) : (
            <Table maxHeight="max-h-[max(320px,calc(100dvh-28rem))]">
              <TableHeader>
                <TableRow>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Vị trí</TableHead>
                  <TableHead>IP quản lý</TableHead>
                  <TableHead className="text-right">Sự cố</TableHead>
                  <TableHead>Đang mở</TableHead>
                  {isAdmin && <TableHead className="text-center">Cảnh báo sai</TableHead>}
                  <TableHead>Sự cố gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((d) => (
                  <TableRow key={d.device_id}>
                    <TableCell>
                      <Link href={`/devices/${d.device_id}`} className="font-semibold text-primary hover:underline">
                        {d.device_name || d.device_code}
                      </Link>
                      <p className="text-xs text-muted-foreground">{d.device_code}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.devicetype_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{d.location || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{d.management_ip}</TableCell>
                    <TableCell className="text-right">{d.total_tickets}</TableCell>
                    <TableCell>
                      {Number(d.open_tickets) > 0
                        ? <Tag tone="red">{d.open_tickets} đang mở</Tag>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-center text-muted-foreground">
                        {d.false_alerts}/{d.total_alerts}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {d.last_event_at ? new Date(d.last_event_at).toLocaleString('vi-VN') : 'Chưa có'}
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
