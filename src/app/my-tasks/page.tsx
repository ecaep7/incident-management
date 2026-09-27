'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

function statusBadge(t: any) {
  if (t.submitted_at === null) return <Badge variant="outline">Chưa nộp</Badge>
  if (t.is_passed === null) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Chờ duyệt</Badge>
  return t.is_passed
    ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Đạt</Badge>
    : <Badge variant="destructive">Không đạt</Badge>
}

export default function MyTasksPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('ticket_task')
        .select('task_id, ticket_id, direction, submitted_at, is_passed, ticket(ticket_code, incident_alert(alert_summary))')
        .order('created_at', { ascending: false })
      if (!error) setTasks(data)
      setLoadingData(false)
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Việc của tôi</h1>
        <p className="text-muted-foreground">Tự động cập nhật mỗi 15 giây</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : tasks.length === 0 ? (
            <p className="p-6 text-muted-foreground">Chưa có việc nào được giao.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Nội dung sự cố</TableHead>
                  <TableHead>Hướng xử lý</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.task_id}>
                    <TableCell>
                      <Link href={`/my-tasks/${t.task_id}`} className="font-medium text-primary hover:underline">
                        {t.ticket?.ticket_code || `Ticket #${t.ticket_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.ticket?.incident_alert?.alert_summary || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{t.direction}</TableCell>
                    <TableCell>{statusBadge(t)}</TableCell>
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