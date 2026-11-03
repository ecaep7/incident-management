'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tag } from '@/components/Tag'
import { FormDialog } from '@/components/FormDialog'
import { Download, UserPlus } from 'lucide-react'
import { downloadCsv } from '@/lib/exportCsv'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// Danh sach nguoi dung (chi Admin): xem tai khoan, vo hieu hoa / kich hoat lai.
// Khoa tai khoan qua ham set_user_active (fix20): chan dang nhap, dang xuat moi phien dang mo,
// va my_role() tra ve NULL nen RLS chan moi truy cap du lieu. Thao tac duoc ghi vao audit_log.
// Admin khong tu khoa duoc chinh minh (tranh mat quyen quan tri).
// Chi khoa duoc khi nguoi do khong con dam nhan ticket chua dong (ham SQL kiem tra va bao loi
// HAS_OPEN_TICKETS kem danh sach ma ticket; Admin can duyet / giao lai cac ticket do truoc).
// Bo loc (vai tro, phong ban, trang thai, tu khoa) loc ngay tren danh sach da tai, khong goi mang lai.

// Bo dau tieng Viet de go "nguyen" van tim ra "Nguyễn"
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Giu lai danh sach da tai trong bo nho cua trinh duyet: quay lai trang thi hien ngay ban cu,
// dong thoi tai ban moi o nen roi cap nhat (khong phai nhin "Dang tai..." moi lan vao trang).
let usersCache: any[] | null = null

const STATUS_LABEL: Record<string, string> = { all: 'Tất cả', active: 'Đang hoạt động', inactive: 'Đã vô hiệu hóa' }

export default function UsersPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const role = profile?.role?.role_name

  const [rows, setRows] = useState<any[]>(usersCache ?? [])
  const [loadingData, setLoadingData] = useState(usersCache === null)
  const [loadError, setLoadError] = useState('')

  const [target, setTarget] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [depFilter, setDepFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (role !== 'Admin') return
    supabase
      .from('user')
      .select('user_id, user_code, full_name, email, is_active, role(role_name), department(dep_name)')
      .order('full_name')
      .then(({ data, error }) => {
        if (error) setLoadError(error.message)
        else { usersCache = data || []; setRows(usersCache) }
        setLoadingData(false)
      })
  }, [role])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (role !== 'Admin') return <div className="p-10 text-muted-foreground">Trang này chỉ dành cho Admin.</div>

  const isActive = (u: any) => u.is_active !== false
  const deactivating = target ? isActive(target) : false

  // Danh sach lua chon lay tu chinh du lieu dang co
  const roleOptions = [...new Set(rows.map((u) => u.role?.role_name).filter(Boolean))].sort() as string[]
  const depOptions = [...new Set(rows.map((u) => u.department?.dep_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')) as string[]

  const kw = normalize(keyword.trim())
  const filteredRows = rows.filter((u) => {
    if (roleFilter !== 'all' && u.role?.role_name !== roleFilter) return false
    if (depFilter !== 'all' && u.department?.dep_name !== depFilter) return false
    if (statusFilter === 'active' && !isActive(u)) return false
    if (statusFilter === 'inactive' && isActive(u)) return false
    if (kw && !normalize([u.full_name, u.email, u.user_code].filter(Boolean).join(' ')).includes(kw)) return false
    return true
  })

  // Xuat danh sach DANG HIEN THI (da ap bo loc) ra file mo duoc bang Excel
  function exportExcel() {
    downloadCsv(
      'danh-sach-nguoi-dung',
      ['Mã nhân viên', 'Họ tên', 'Email', 'Vai trò', 'Phòng ban', 'Trạng thái'],
      filteredRows.map((u) => [
        u.user_code || '', u.full_name || '', u.email || '', u.role?.role_name || '', u.department?.dep_name || '',
        isActive(u) ? 'Đang hoạt động' : 'Đã vô hiệu hóa',
      ]),
    )
  }

  function clearFilters() {
    setKeyword('')
    setRoleFilter('all')
    setDepFilter('all')
    setStatusFilter('all')
  }

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
    // Loi tu ham SQL co dang "MA_LOI: noi dung" -> chi hien phan noi dung tieng Viet
    if (error) { setSaveError(error.message.replace(/^[A-Z_]+:\s*/, '')); return }
    // Cap nhat ngay dong vua doi trang thai thay vi tai lai ca danh sach
    const updated = rows.map((u) => (u.user_id === target.user_id ? { ...u, is_active: !isActive(target) } : u))
    usersCache = updated
    setRows(updated)
    setTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Người dùng</h1>
          <p className="text-sm text-muted-foreground">Danh sách tài khoản; vô hiệu hóa tài khoản khi nhân sự không còn tham gia xử lý sự cố</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportExcel} disabled={filteredRows.length === 0}>
            <Download className="mr-2 h-4 w-4" />Xuất Excel ({filteredRows.length})
          </Button>
          <Link href="/admin/create-user">
            <Button><UserPlus className="mr-2 h-4 w-4" />Tạo tài khoản</Button>
          </Link>
        </div>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label>Tìm kiếm</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Họ tên, email, mã nhân viên..." className="w-64" />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Vai trò</Label>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? 'all')}>
              <SelectTrigger className="w-36">
                <SelectValue>{roleFilter === 'all' ? 'Tất cả' : roleFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Phòng ban</Label>
            <Select value={depFilter} onValueChange={(v) => setDepFilter(v ?? 'all')}>
              <SelectTrigger className="w-52">
                <SelectValue>{depFilter === 'all' ? 'Tất cả' : depFilter}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {depOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Trạng thái</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className="w-44">
                <SelectValue>{STATUS_LABEL[statusFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="inactive">Đã vô hiệu hóa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={clearFilters}>Xóa bộ lọc</Button>
          <span className="ml-auto self-center text-sm text-muted-foreground">{filteredRows.length}/{rows.length} người dùng</span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : loadError ? (
            <p className="p-6 text-destructive">Không tải được danh sách người dùng: {loadError}</p>
          ) : filteredRows.length === 0 ? (
            <p className="p-6 text-muted-foreground">Không có người dùng nào khớp với bộ lọc.</p>
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
                {filteredRows.map((u) => {
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
                          <Button
                            variant={isActive(u) ? 'outline' : 'secondary'}
                            size="sm"
                            className={isActive(u)
                              ? 'hover:border-destructive hover:bg-destructive hover:text-white dark:hover:bg-destructive dark:hover:text-white'
                              : 'hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white'}
                            onClick={() => openConfirm(u)}
                          >
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
            <>Tài khoản <b>{target?.full_name}</b> ({target?.email}) sẽ bị đăng xuất ngay và không thể đăng nhập lại. Các ticket, nhiệm vụ và lịch sử do người này thực hiện trước đó vẫn được giữ nguyên.</>
          ) : (
            <>Tài khoản <b>{target?.full_name}</b> ({target?.email}) sẽ đăng nhập và sử dụng hệ thống trở lại với vai trò, phòng ban như trước.</>
          )}
        </p>
        {deactivating && target?.role?.role_name === 'Handler' && (
          <p className="text-xs text-muted-foreground">Chỉ vô hiệu hóa được khi mọi ticket người này đảm nhận đã đóng, hoặc đã được đánh giá không đạt và giao lại cho người khác.</p>
        )}
      </FormDialog>
    </div>
  )
}
