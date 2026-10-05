'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadTicketBundle, buildTimeline, type TimelineEvent } from '@/lib/ticketBundle'

const TONE_COLOR: Record<TimelineEvent['tone'], string> = {
  neutral: '#94A3B8',
  info: '#2563EB',
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#D97706',
}

// Component doc-lap: tu tai du lieu, khong dung chung state voi trang chi tiet ticket,
// nen khong anh huong den cac nut Duyet / Tai phan cong.
export function TicketTimeline({ ticketId }: { ticketId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTicketBundle(ticketId).then((b) => {
      if (!cancelled) setEvents(b ? buildTimeline(b) : [])
    })
    return () => { cancelled = true }
  }, [ticketId])

  return (
    <Card>
      <CardHeader><CardTitle>Dòng thời gian xử lý</CardTitle></CardHeader>
      <CardContent>
        {events === null ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
        ) : (
          <ol className="relative ml-2 border-l">
            {events.map((e, i) => (
              <li key={i} className="mb-5 ml-5 last:mb-0">
                <span
                  className="absolute -left-[6px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-background"
                  style={{ backgroundColor: TONE_COLOR[e.tone] }}
                />
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString('vi-VN')}</p>
                {e.detail && <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
