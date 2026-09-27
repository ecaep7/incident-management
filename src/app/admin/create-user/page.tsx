'use client'

import { useEffect, useState } from 'react'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const CREATE_USER_URL = 'https://wwpjuwuqhvpuujcymkzi.supabase.co/functions/v1/create-handler-account'

export default function CreateUserPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const [departments, setDepartments] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleName, setRoleName] = useState('Handler')
  const [depId, setDepId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    async function loadDeps() {
      const { data } = await supabase.from('department').select('dep_id, dep_name')
      setDepartments(data || [])
    }
    loadDeps()
  }, [])

  async function handleSubmit() {
    if (!email || !fullName || !depId) { setMessage('Điền đủ các trường'); return }
    setSubmitting(true)
    setMessage('')
    setResult(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(CREATE_USER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email, full_name: fullName, role_name: roleName, dep_id: Number(depId) }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setMessage('Lỗi: ' + json.message); return }
    setResult(json.data)
    setEmail(''); setFullName(''); setDepId('')
  }

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (profile?.role?.role_name !== 'Admin') return <div className="p-10 text-muted-foreground">Bạn không có quyền truy cập trang này.</div>
  const selectedDepName = departments.find((d) => String(d.dep_id) === depId)?.dep_name
  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Tạo tài khoản nhân sự</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten.nhanvien@gmail.com" />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Họ tên</Label>
            <Input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Vai trò</Label>
            <Select value={roleName} onValueChange={(v) => setRoleName(v ?? 'Handler')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Handler">Handler</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Phòng ban</Label>
            <Select value={depId} onValueChange={(v) => setDepId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Chọn --">{selectedDepName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.dep_id} value={String(d.dep_id)}>{d.dep_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {message && <p className="text-sm text-destructive">{message}</p>}
          <Button onClick={handleSubmit} disabled={submitting} className="self-start">
            {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Button>

          {result && (
            <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm">
              <p className="font-medium text-green-800">Đã tạo thành công. Gửi thông tin này cho nhân sự:</p>
              <p className="mt-2">Email: <code className="rounded bg-white px-1.5 py-0.5">{result.email}</code></p>
              <p className="mt-1">Mật khẩu: <code className="rounded bg-white px-1.5 py-0.5">{result.password}</code></p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}