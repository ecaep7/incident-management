'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusDot, severityColor } from '@/components/StatusDot'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default function IncidentsPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [incidents, setIncidents] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

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

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Hàng chờ cảnh báo</h1>
        <p className="text-muted-foreground">Tự động cập nhật mỗi 15 giây</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải danh sách...</p>
          ) : incidents.length === 0 ? (
            <p className="p-6 text-muted-foreground">Chưa có cảnh báo nào.</p>
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
                {incidents.map((i) => (
                  <TableRow key={i.incident_id}>
                    <TableCell>
                      <StatusDot label={i.severity_level} color={severityColor(i.severity_level)} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/incidents/${i.incident_id}`} className="font-medium text-primary hover:underline">
                        {i.alert_summary}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.device_ip}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{i.current_status}</Badge>
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