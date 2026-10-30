'use client'

import { useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tag, type TagTone } from '@/components/Tag'
import { Download } from 'lucide-react'
import { downloadCsv, fmtDateTime } from '@/lib/exportCsv'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// Nhat ky thao tac (chi Admin doc). Du lieu do trigger audit_trigger() o co so du lieu ghi lai
// moi lan them / sua / xoa tren cac bang nghiep vu; giao dien chi doc, khong sua duoc.

const LIMIT = 500

const TABLE_LABEL: Record<string, string> = {
  incident_alert: 'Cảnh báo',
  incident_verification: 'Yêu cầu xác minh',
  ticket: 'Ticket',
  ticket_task: 'Nhiệm vụ',
  attachment: 'Tệp đính kèm',
  device: 'Thiết bị',
  devicetype: 'Loại thiết bị',
  incident_category: 'Loại sự cố',
  department: 'Đơn vị',
  user: 'Người dùng',
  role: 'Vai trò',
}

const ACTION: Record<string, { label: string; tone: TagTone }> = {
  INSERT: { label: 'Thêm', tone: 'green' },
  UPDATE: { label: 'Sửa', tone: 'blue' },
  DELETE: { label: 'Xóa', tone: 'red' },
}

const short = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '∅'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

// Tom tat thay doi de hien trong bang: UPDATE -> "cot: cu → moi"
function summarize(log: any) {
  if (log.action === 'UPDATE') {
    const fields: string[] = log.changed_fields || []
    const parts = fields.slice(0, 3).map((f) => `${f}: ${short(log.old_data?.[f])} → ${short(log.new_data?.[f])}`)
    if (fields.length > 3) parts.push(`+${fields.length - 3} cột khác`)
    return parts.join('; ')
  }
  if (log.action === 'INSERT') return 'Tạo bản ghi mới'
  return 'Xóa bản ghi'
}

export default function AuditLogPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const role = profile?.role?.role_name

  const [logs, setLogs] = useState<any[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [tableFilter, setTableFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<any | null>(null)

  useEffect(() => {
    if (role !== 'Admin') return
    async function load() {
      const [{ data, error }, { data: dir }] = await Promise.all([
        supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(LIMIT),
        supabase.rpc('list_user_directory'),
      ])
      if (error) setError(error.message)
      else setLogs(data || [])
      setNames(Object.fromEntries((dir || []).map((u: any) => [u.user_id, u.full_name])))
      setLoadingData(false)
    }
    load()
  }, [role])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (role !== 'Admin') return <div className="p-10 text-muted-foreground">Trang này chỉ dành cho Admin.</div>

  const actor = (l: any) => (l.changed_by ? names[l.changed_by] || 'Người dùng đã xóa' : 'Hệ thống / tích hợp')

  const kw = keyword.trim().toLowerCase()
  const visible = logs.filter((l) => {
    if (tableFilter !== 'all' && l.table_name !== tableFilter) return false
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    if (kw && !`${actor(l)} ${l.record_id} ${summarize(l)}`.toLowerCase().includes(kw)) return false
    return true
  })

  function exportExcel() {
    downloadCsv('nhat-ky-thao-tac', ['Thời gian', 'Người thực hiện', 'Vai trò', 'Thao tác', 'Đối tượng', 'Mã bản ghi', 'Thay đổi'],
      visible.map((l) => [
        fmtDateTime(l.changed_at), actor(l), l.actor_role || '', ACTION[l.action]?.label || l.action,
        TABLE_LABEL[l.table_name] || l.table_name, l.record_id, summarize(l),
      ]))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Nhật ký hệ thống</h1>
          <p className="text-sm text-muted-foreground">Ghi nhận tự động mọi thao tác thêm, sửa, xóa dữ liệu ({LIMIT} bản ghi gần nhất)</p>
        </div>
        <Button onClick={exportExcel} disabled={visible.length === 0}>
          <Download className="mr-2 h-4 w-4" />Xuất Excel ({visible.length})
        </Button>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label>Tìm kiếm</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Người thực hiện, mã bản ghi, nội dung..." className="w-72" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Đối tượng</Label>
            <Select value={tableFilter} onValueChange={(v) => setTableFilter(String(v ?? 'all'))}>
              <SelectTrigger className="w-44"><SelectValue>{tableFilter === 'all' ? 'Tất cả' : TABLE_LABEL[tableFilter]}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(TABLE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Thao tác</Label>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(String(v ?? 'all'))}>
              <SelectTrigger className="w-32"><SelectValue>{actionFilter === 'all' ? 'Tất cả' : ACTION[actionFilter].label}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="INSERT">Thêm</SelectItem>
                <SelectItem value="UPDATE">Sửa</SelectItem>
                <SelectItem value="DELETE">Xóa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setKeyword(''); setTableFilter('all'); setActionFilter('all') }}>Xóa bộ lọc</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : error ? (
            <p className="p-6 text-destructive">Không tải được nhật ký: {error}</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-muted-foreground">Chưa có thao tác nào khớp.</p>
          ) : (
            <Table maxHeight="max-h-[max(320px,calc(100dvh-22rem))]">
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Thao tác</TableHead>
                  <TableHead>Đối tượng</TableHead>
                  <TableHead>Thay đổi</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((l) => (
                  <TableRow key={l.log_id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(l.changed_at)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{actor(l)}</span>
                      {l.actor_role && <p className="text-xs text-muted-foreground">{l.actor_role}</p>}
                    </TableCell>
                    <TableCell><Tag tone={ACTION[l.action]?.tone || 'gray'}>{ACTION[l.action]?.label || l.action}</Tag></TableCell>
                    <TableCell className="whitespace-nowrap">
                      {TABLE_LABEL[l.table_name] || l.table_name}
                      <span className="text-muted-foreground"> #{String(l.record_id ?? '').slice(0, 8)}</span>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground" title={summarize(l)}>{summarize(l)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetail(l)}>Chi tiết</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog.Root open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[12px] bg-card p-6 shadow-xl ring-1 ring-foreground/10">
            {detail && (
              <>
                <div className="flex flex-col gap-1">
                  <Dialog.Title className="text-h3">
                    {ACTION[detail.action]?.label} {(TABLE_LABEL[detail.table_name] || detail.table_name).toLowerCase()} #{detail.record_id}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    {actor(detail)}{detail.actor_role ? ` (${detail.actor_role})` : ''} · {fmtDateTime(detail.changed_at)}
                  </Dialog.Description>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Trước khi thay đổi</span>
                    <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{detail.old_data ? JSON.stringify(detail.old_data, null, 2) : '—'}</pre>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Sau khi thay đổi</span>
                    <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{detail.new_data ? JSON.stringify(detail.new_data, null, 2) : '—'}</pre>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Dialog.Close render={<Button variant="secondary" className="h-10 rounded-[17px] border-0 px-5 text-sm" />}>Đóng</Dialog.Close>
                </div>
              </>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
