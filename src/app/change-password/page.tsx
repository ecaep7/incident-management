'use client'

import { useState } from 'react'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePasswordPage() {
  const { profile, loading } = useProfile()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!oldPassword) { setMessage('Cần nhập mật khẩu hiện tại'); return }
    if (newPassword.length < 6) { setMessage('Mật khẩu mới cần ít nhất 6 ký tự'); return }
    if (newPassword !== confirmPassword) { setMessage('Mật khẩu mới nhập lại không khớp'); return }

    setSubmitting(true)
    setMessage('')

    const { error: checkError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: oldPassword,
    })
    if (checkError) {
      setSubmitting(false)
      setMessage('Mật khẩu hiện tại không đúng')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSubmitting(false)

    if (error) { setMessage('Lỗi: ' + error.message); return }
    setMessage('Đổi mật khẩu thành công.')
    setOldPassword(''); setNewPassword(''); setConfirmPassword('')
  }

  if (loading) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Mật khẩu hiện tại</Label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Mật khẩu mới</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Nhập lại mật khẩu mới</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {message && (
            <p className={`text-sm ${message.includes('thành công') ? 'text-green-600' : 'text-destructive'}`}>
              {message}
            </p>
          )}
          <Button onClick={handleSubmit} disabled={submitting} className="self-start">
            {submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}