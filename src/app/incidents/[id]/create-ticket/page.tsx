'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export default function CreateTicketPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const params = useParams()
  const router = useRouter()
  const incidentId = params.id as string

  const [categories, setCategories] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [handlers, setHandlers] = useState<any[]>([])

  const [categoryId, setCategoryId] = useState('')
  const [direction, setDirection] = useState('SYSTEM')
  const [depId, setDepId] = useState('')
  const [handlerId, setHandlerId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadMasterData() {
      const { data: cats } = await supabase.from('incident_category').select('category_id, category_name, priority_level, sla_hours')
      setCategories(cats || [])
      const { data: deps } = await supabase.from('department').select('dep_id, dep_name')
      setDepartments(deps || [])
    }
    loadMasterData()
  }, [])

  useEffect(() => {
    if (!depId) { setHandlers([]); return }
    async function loadHandlers() {
      const { data } = await supabase.rpc('list_user_directory')
      const onlyHandlers = (data || []).filter(
        (u: any) => u.role_name === 'Handler' && String(u.dep_id) === String(depId)
      )
      setHandlers(onlyHandlers)
      setHandlerId('')
    }
    loadHandlers()
  }, [depId])

  async function handleSubmit() {
    if (!categoryId || !depId || !handlerId) { setMessage('Điền đủ cả 3 mục'); return }
    setSubmitting(true)
    setMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/hyper-service', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        incident_id: Number(incidentId),
        category_id: Number(categoryId),
        direction,
        assigned_dep_id: Number(depId),
        handler_user_id: handlerId,
      }),
    })

    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setMessage('Lỗi: ' + json.message); return }
    router.push(`/tickets/${json.data.ticket.ticket_id}`)
  }

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Tạo ticket cho cảnh báo #{incidentId}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Loại sự cố</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Chọn --" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.category_id} value={String(c.category_id)}>
                    {c.category_name} ({c.priority_level}, SLA {c.sla_hours}h)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Hướng xử lý</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SYSTEM">Hệ thống (SYSTEM)</SelectItem>
                <SelectItem value="ONSITE">Hiện trường (ONSITE)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Phòng ban phụ trách</Label>
            <Select value={depId} onValueChange={(v) => setDepId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Chọn --" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.dep_id} value={String(d.dep_id)}>{d.dep_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Người xử lý</Label>
            <Select value={handlerId} onValueChange={(v) => setHandlerId(v ?? '')} disabled={!depId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={depId ? '-- Chọn --' : 'Chọn phòng ban trước'} />
              </SelectTrigger>
              <SelectContent>
                {handlers.map((h) => (
                  <SelectItem key={h.user_id} value={h.user_id}>{h.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {message && <p className="text-sm text-destructive">{message}</p>}
          <Button onClick={handleSubmit} disabled={submitting} className="self-start">
            {submitting ? 'Đang tạo...' : 'Tạo ticket'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}