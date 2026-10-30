'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FormDialog } from '@/components/FormDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// Form them moi / sua thong tin thiet bi (chi Admin). Ghi thang vao bang device,
// quyen ghi do policy admin_all_device o co so du lieu kiem soat.
// Khong co chuc nang xoa: thiet bi dang duoc canh bao tham chieu, chi chuyen sang "Ngung su dung".

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

const STATUS_LABEL: Record<string, string> = { active: 'Đang hoạt động', inactive: 'Ngừng sử dụng' }

type Form = {
  device_code: string
  device_name: string
  management_ip: string
  devicetype_id: string
  location: string
  manufacturer: string
  status: string
}

const EMPTY: Form = { device_code: '', device_name: '', management_ip: '', devicetype_id: '', location: '', manufacturer: '', status: 'active' }

export function DeviceFormDialog({
  open, onOpenChange, deviceId, onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId: number | null          // null = them moi
  onSaved: () => void
}) {
  const isEdit = deviceId !== null
  const [form, setForm] = useState<Form>(EMPTY)
  const [types, setTypes] = useState<{ devicetype_id: number; devicetype_name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Trang cha gan key moi moi lan mo form, nen state luon bat dau tu EMPTY;
  // effect chi tai danh muc loai thiet bi va (khi sua) thong tin thiet bi hien tai.
  useEffect(() => {
    if (!open) return
    supabase.from('devicetype').select('devicetype_id, devicetype_name').order('devicetype_name')
      .then(({ data }) => setTypes(data || []))
    if (deviceId === null) return
    supabase.from('device').select('*').eq('device_id', deviceId).single()
      .then(({ data, error }) => {
        if (error || !data) { setError('Không tải được thông tin thiết bị.'); return }
        setForm({
          device_code: data.device_code ?? '',
          device_name: data.device_name ?? '',
          management_ip: data.management_ip ?? '',
          devicetype_id: data.devicetype_id ? String(data.devicetype_id) : '',
          location: data.location ?? '',
          manufacturer: data.manufacturer ?? '',
          status: data.status === 'inactive' ? 'inactive' : 'active',
        })
      })
  }, [open, deviceId])

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const ipValid = IPV4.test(form.management_ip.trim())
  const canSubmit = !!form.device_code.trim() && !!form.device_name.trim() && ipValid && !!form.devicetype_id

  async function submit() {
    setLoading(true)
    setError('')
    const payload = {
      device_code: form.device_code.trim(),
      device_name: form.device_name.trim(),
      devicetype_id: Number(form.devicetype_id),
      location: form.location.trim() || null,
      manufacturer: form.manufacturer.trim() || null,
      status: form.status,
    }
    const { error } = isEdit
      ? await supabase.from('device').update(payload).eq('device_id', deviceId)
      : await supabase.from('device').insert({ ...payload, management_ip: form.management_ip.trim() })
    setLoading(false)
    if (error) {
      setError(error.code === '23505' ? 'Địa chỉ IP quản lý này đã được đăng ký cho thiết bị khác.' : `Không lưu được: ${error.message}`)
      return
    }
    onOpenChange(false)
    onSaved()
  }

  const typeName = types.find((t) => String(t.devicetype_id) === form.devicetype_id)?.devicetype_name

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Sửa thông tin thiết bị' : 'Thêm thiết bị'}
      description={isEdit ? 'Cập nhật thông tin thiết bị trong danh mục.' : 'Thiết bị phải được đăng ký thì hệ thống mới tiếp nhận cảnh báo từ địa chỉ IP này.'}
      loading={loading}
      error={error}
      canSubmit={canSubmit}
      onSubmit={submit}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Mã thiết bị <span className="text-destructive">*</span></Label>
          <Input value={form.device_code} onChange={(e) => set('device_code')(e.target.value)} placeholder="VD: SW-HN-Core-02" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>IP quản lý <span className="text-destructive">*</span></Label>
          <Input
            value={form.management_ip}
            onChange={(e) => set('management_ip')(e.target.value)}
            placeholder="VD: 10.14.22.106"
            disabled={isEdit}
          />
        </div>
      </div>
      {isEdit && (
        <p className="-mt-2 text-xs text-muted-foreground">IP quản lý không sửa được vì các cảnh báo cũ của thiết bị đang gắn với địa chỉ này.</p>
      )}
      {!isEdit && form.management_ip && !ipValid && (
        <p className="-mt-2 text-xs text-destructive">Địa chỉ IP chưa đúng định dạng IPv4.</p>
      )}

      <div className="flex flex-col gap-2">
        <Label>Tên thiết bị <span className="text-destructive">*</span></Label>
        <Input value={form.device_name} onChange={(e) => set('device_name')(e.target.value)} placeholder="VD: Switch lõi Hà Nội 02" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Loại thiết bị <span className="text-destructive">*</span></Label>
          <Select value={form.devicetype_id} onValueChange={(v) => set('devicetype_id')(String(v ?? ''))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="-- Chọn --">{typeName}</SelectValue></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t.devicetype_id} value={String(t.devicetype_id)}>{t.devicetype_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Trạng thái</Label>
          <Select value={form.status} onValueChange={(v) => set('status')(String(v ?? 'active'))}>
            <SelectTrigger className="w-full"><SelectValue>{STATUS_LABEL[form.status]}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Đang hoạt động</SelectItem>
              <SelectItem value="inactive">Ngừng sử dụng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>Vị trí</Label>
          <Input value={form.location} onChange={(e) => set('location')(e.target.value)} placeholder="VD: Hà Nội - Tòa nhà VNPT" />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Hãng sản xuất</Label>
          <Input value={form.manufacturer} onChange={(e) => set('manufacturer')(e.target.value)} placeholder="VD: Cisco" />
        </div>
      </div>
    </FormDialog>
  )
}
