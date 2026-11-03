'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tag } from '@/components/Tag'
import { FormDialog } from '@/components/FormDialog'
import { UserPlus } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// Danh sach nguoi dung (chi Admin): xem tai khoan, vo hieu hoa / kich hoat lai.
// Khoa tai khoan qua ham set_user_active (fix20): chan dang nhap, dang xuat moi phien dang mo,
// va my_role() tra ve NULL nen RLS chan moi truy cap du lieu. Thao tac duoc ghi vao audit_log.
// Admin khong tu khoa duoc chinh minh (tranh mat quyen quan tri).

export default function UsersPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const role = profile?.role?.role_name

  const [rows, setRows] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [target, setTarget] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (role !== 'Admin') return
    supabase
      .from('user')
      .select('user_id, user_code, full_name, email, is_active, role(role_name), department(dep_name)')
      .order('full_name')
      .then(({ data, error }) => {
        if (error) setLoadError(error.message)
        else setRows(data || [])
        setLoadingData(false)
      })
  }, [role, reloadKey])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (role !== 'Admin') return <div className="p-10 text-muted-foreground">Trang này chỉ dành cho Admin.</div>

  const isActive = (u: any) => u.is_active !== false
  const deactivating = target ? isActive(target) : false

  function openConfirm(u: any) {
    setSaveError('')
    setTarget(u)
  }

  async function submit() {
    if (!target) return
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.rpc('set_user_active', { p_user_id: target.user_id, p_active: !isActive(target) })
    setSaving(false)
    if (error) { setSaveError(`Không thực hiện được: ${error.message}`); return }
    setTarget(null)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Người dùng</h1>
          <p className="text-sm text-muted-foreground">Danh sách tài khoản; vô hiệu hóa tài khoản khi nhân sự không còn tham gia xử lý sự cố</p>
        </div>
        <Link href="/admin/create-user">
          <Button><UserPlus className="mr-2 h-4 w-4" />Tạo tài khoản</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : loadError ? (
            <p className="p-6 text-destructive">Không tải được danh sách người dùng: {loadError}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => {
                  const self = u.user_id === profile?.user_id
                  return (
                    <TableRow key={u.user_id} className={isActive(u) ? '' : 'opacity-60'}>
                      <TableCell className="font-semibold">{u.full_name}{self && <span className="ml-1 font-normal text-muted-foreground">(bạn)</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{u.role?.role_name}</TableCell>
                      <TableCell>{u.department?.dep_name || '—'}</TableCell>
                      <TableCell>
                        {isActive(u) ? <Tag tone="green">Đang hoạt động</Tag> : <Tag tone="gray">Đã vô hiệu hóa</Tag>}
                      </TableCell>
                      <TableCell className="text-right">
                        {!self && (
                          <Button variant={isActive(u) ? 'outline' : 'secondary'} size="sm" onClick={() => openConfirm(u)}>
                            {isActive(u) ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={!!target}
        onOpenChange={(o) => { if (!o) setTarget(null) }}
        title={deactivating ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt lại tài khoản'}
        submitLabel={deactivating ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
        loading={saving}
        error={saveError}
        onSubmit={submit}
      >
        <p className="text-sm">
          {deactivating ? (
            <>Tài khoản <b>{target?.full_name}</b> ({target?.email}) sẽ bị đăng xuất ngay và không thể đăng nhập lại. Các ticket, nhiệm vụ và lịch sử do người này thực hiện vẫn được giữ nguyên.</>
          ) : (
            <>Tài khoản <b>{target?.full_name}</b> ({target?.email}) sẽ đăng nhập và sử dụng hệ thống trở lại với vai trò, phòng ban như trước.</>
          )}
        </p>
        {deactivating && target?.role?.role_name === 'Handler' && (
          <p className="text-xs text-muted-foreground">Nhiệm vụ đang dang dở của người này cần được giao lại cho nhân sự khác trong trang chi tiết ticket.</p>
        )}
      </FormDialog>
    </div>
  )
}
