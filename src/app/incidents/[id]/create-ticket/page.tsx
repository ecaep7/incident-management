'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateTicketForm, AiPrefillNote } from '@/components/CreateTicketForm'

// Trang tao ticket rieng (van giu de mo truc tiep bang duong dan). Form dung chung voi khung truot o trang chi tiet.
export default function CreateTicketPage() {
  const { loading: loadingProfile } = useProfile()
  const params = useParams()
  const router = useRouter()
  const incidentId = params.id as string
  const [hasAi, setHasAi] = useState(false)

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="font-semibold">Tạo ticket cho cảnh báo #{incidentId}</CardTitle>
          {hasAi && <AiPrefillNote />}
        </CardHeader>
        <CardContent>
          <CreateTicketForm
            incidentId={incidentId}
            onCreated={(id) => router.push(`/tickets/${id}`)}
            onAiLoaded={(ai) => setHasAi(!!ai)}
          />
        </CardContent>
      </Card>
    </div>
  )
}