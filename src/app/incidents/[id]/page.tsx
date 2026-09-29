'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SeverityTag, IncidentStatusTag } from '@/components/Tag'
import { ConfirmDialog } from '@/components/ConfirmDialog'

export default function IncidentDetailPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const params = useParams()
  const router = useRouter()
  const incidentId = params.id as string

  const [incident, setIncident] = useState<any>(null)
  const [verifications, setVerifications] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmReject, setConfirmReject] = useState(false)

  async function loadData() {
    const { data: incidentData } = await supabase
      .from('incident_alert').select('*').eq('incident_id', incidentId).single()
    setIncident(incidentData)

    const { data: verData } = await supabase
      .from('incident_verification').select('*').eq('incident_id', incidentId)
      .order('requested_at', { ascending: false })
    setVerifications(verData || [])
    setLoadingData(false)
  }

  useEffect(() => { if (incidentId) loadData() }, [incidentId])

  async function handleReject() {
    if (!reason) { setMessage('Cần nhập lý do từ chối'); return }
    setActionLoading(true)
    const { error } = await supabase.from('incident_alert')
      .update({ is_hvbt: false, closed_at: new Date().toISOString(), closed_reason: reason, current_status: 'Closed_False' })
      .eq('incident_id', incidentId)
    setActionLoading(false)
    if (error) { setMessage('Lỗi: ' + error.message); return }
    router.push('/incidents')
  }

  async function handleRequestVerification() {
    if (!note) { setMessage('Cần nhập nội dung yêu cầu'); return }
    setActionLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('incident_verification')
      .insert({ incident_id: incidentId, request_note: note, requested_at: new Date().toISOString(), requested_by: user?.id })
    if (!error) {
      await supabase.from('incident_alert').update({ current_status: 'Verifying' }).eq('incident_id', incidentId)
      setNote('')
      loadData()
    } else {
      setMessage('Lỗi: ' + error.message)
    }
    setActionLoading(false)
  }

  if (loadingProfile || loadingData) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (!incident) return <div className="p-10 text-muted-foreground">Không tìm thấy cảnh báo.</div>

  const isOpen = incident.current_status !== 'Ticket_Created' && incident.current_status !== 'Closed_False'

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-[-0.03em]">{incident.alert_summary}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {incident.device_ip} · {new Date(incident.received_at).toLocaleString('vi-VN')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SeverityTag level={incident.severity_level} />
          <IncidentStatusTag status={incident.current_status} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dữ liệu thô</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(JSON.parse(incident.raw_payload || '{}'), null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Lịch sử yêu cầu xác minh</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có yêu cầu nào.</p>
          ) : verifications.map((v) => (
            <div key={v.verification_id} className="rounded-md border p-3 text-sm">
              <p><span className="font-medium">Yêu cầu:</span> {v.request_note}</p>
              <p className="mt-1 text-muted-foreground">
                <span className="font-medium text-foreground">Trả lời:</span>{' '}
                {v.response_payload ? JSON.stringify(v.response_payload) : 'Chưa có phản hồi'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {message && <p className="text-sm text-destructive">{message}</p>}

      {isOpen && (
        <Card>
          <CardHeader><CardTitle className="text-base">Hành động</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label>Yêu cầu xác minh thêm</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              <Button onClick={handleRequestVerification} disabled={actionLoading} className="self-start">
                Gửi yêu cầu
              </Button>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label>Từ chối (cảnh báo sai)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do từ chối" />
              <Button
                onClick={() => {
                  if (!reason) { setMessage('Cần nhập lý do từ chối'); return }
                  setMessage(''); setConfirmReject(true)
                }}
                disabled={actionLoading}
                variant="destructive"
                className="self-start"
              >
                Từ chối
              </Button>
            </div>

            <Separator />

            <Button onClick={() => router.push(`/incidents/${incidentId}/create-ticket`)} className="self-start">
              Tạo ticket →
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Từ chối cảnh báo này?"
        description="Cảnh báo sẽ được đánh dấu là cảnh báo sai và rời khỏi hàng chờ. Thao tác này không thể hoàn tác trên giao diện."
        confirmLabel="Từ chối cảnh báo"
        tone="destructive"
        onConfirm={handleReject}
      />
    </div>
  )
}