'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { SeverityTag, IncidentStatusTag, INCIDENT_STATUS_LABEL } from '@/components/Tag'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { downloadCsv, fmtDateTime } from '@/lib/exportCsv'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default function IncidentsPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [incidents, setIncidents] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const [keyword, setKeyword] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    async function loadIncidents() {
      const { data, error } = await supabase
        .from('incident_alert')
        .select('incident_id, device_ip, severity_level, alert_summary, current_status, is_hvbt, received_at')
        .order('received_at', { ascending: false })

      if (!error) setIncidents(data)
      setLoadingData(false)
    }

    loadIncidents()
    const interval = setInterval(loadIncidents, 15000)
    return () => clearInterval(interval)
  }, [])

  const STATUS_LABEL = INCIDENT_STATUS_LABEL

  const kw = keyword.trim().toLowerCase()
  const filteredIncidents = incidents.filter((i) => {
    if (severityFilter !== 'all' && i.severity_level !== severityFilter) return false
    if (statusFilter !== 'all' && i.current_status !== statusFilter) return false
    if (kw) {
      const haystack = `${i.alert_summary || ''} ${i.device_ip || ''} ${i.incident_id}`.toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  })

  function clearFilters() {
    setKeyword('')
    setSeverityFilter('all')
    setStatusFilter('all')
  }

  function exportExcel() {
    downloadCsv(
      'hang-cho-canh-bao',
      ['Mã cảnh báo', 'Mức độ', 'Nội dung', 'IP thiết bị', 'Trạng thái', 'Thời gian tiếp nhận'],
      filteredIncidents.map((i) => [
        i.incident_id, i.severity_level, i.alert_summary, i.device_ip,
        STATUS_LABEL[i.current_status] || i.current_status, fmtDateTime(i.received_at),
      ]),
    )
  }

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-light tracking-[-0.03em]">Hàng chờ cảnh báo</h1>
        <p className="text-muted-foreground">Tự động cập nhật mỗi 15 giây</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label>Tìm kiếm</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nội dung, IP thiết bị..."
              className="w-64"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Mức độ</Label>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v ?? 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue>{severityFilter === 'all' ? 'Tất cả' : severityFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
                <SelectItem value="HIGH">HIGH</SelectItem>
                <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                <SelectItem value="LOW">LOW</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Trạng thái</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className="w-44">
                <SelectValue>{statusFilter === 'all' ? 'Tất cả' : STATUS_LABEL[statusFilter] || statusFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={clearFilters}>Xóa bộ lọc</Button>
          <p className="ml-auto text-sm text-muted-foreground">
            {filteredIncidents.length} / {incidents.length} cảnh báo
          </p>
          <Button variant="outline" onClick={exportExcel} disabled={filteredIncidents.length === 0}>
            <Download className="mr-2 h-4 w-4" />Xuất Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải danh sách...</p>
          ) : incidents.length === 0 ? (
            <p className="p-6 text-muted-foreground">Chưa có cảnh báo nào.</p>
          ) : filteredIncidents.length === 0 ? (
            <p className="p-6 text-muted-foreground">Không có cảnh báo nào khớp bộ lọc.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Tóm tắt</TableHead>
                  <TableHead>IP thiết bị</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncidents.map((i) => (
                  <TableRow key={i.incident_id}>
                    <TableCell>
                      <SeverityTag level={i.severity_level} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/incidents/${i.incident_id}`} className="font-medium text-primary hover:underline">
                        {i.alert_summary}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.device_ip}</TableCell>
                    <TableCell>
                      <IncidentStatusTag status={i.current_status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(i.received_at).toLocaleString('vi-VN')}
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