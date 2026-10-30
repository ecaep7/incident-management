'use client'

import { useEffect, useState } from 'react'
import { useProfile } from '@/lib/useProfile'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { SeverityTag } from '@/components/Tag'
import { FormDialog } from '@/components/FormDialog'
import { Pencil, Plus } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// Danh muc loai su co (chi Admin): xem, them, sua ten / muc uu tien / so gio SLA.
// So gio SLA dung de tinh han xu ly khi TAO ticket moi; ticket da tao giu nguyen han cu.
// Khong co chuc nang xoa vi loai su co dang duoc ticket tham chieu.

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

type Form = { category_name: string; priority_level: string; sla_hours: string; description: string }
const EMPTY: Form = { category_name: '', priority_level: 'MEDIUM', sla_hours: '', description: '' }

export default function IncidentCategoriesPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const role = profile?.role?.role_name

  const [rows, setRows] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (role !== 'Admin') return
    supabase.from('incident_category').select('*').order('category_id').then(({ data, error }) => {
      if (error) setLoadError(error.message)
      else setRows(data || [])
      setLoadingData(false)
    })
  }, [role, reloadKey])

  if (loadingProfile) return <div className="flex items-center justify-center p-10 text-muted-foreground">Đang tải...</div>
  if (role !== 'Admin') return <div className="p-10 text-muted-foreground">Trang này chỉ dành cho Admin.</div>

  function openForm(row: any | null) {
    setSaveError('')
    setEditingId(row ? row.category_id : null)
    setForm(row
      ? { category_name: row.category_name ?? '', priority_level: row.priority_level ?? 'MEDIUM', sla_hours: String(row.sla_hours ?? ''), description: row.description ?? '' }
      : EMPTY)
    setOpen(true)
  }

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const sla = Number(form.sla_hours)
  const slaValid = Number.isInteger(sla) && sla > 0 && sla <= 720
  const canSubmit = !!form.category_name.trim() && slaValid

  async function submit() {
    setSaving(true)
    setSaveError('')
    const payload = {
      category_name: form.category_name.trim(),
      priority_level: form.priority_level,
      sla_hours: sla,
      description: form.description.trim() || null,
    }
    const { error } = editingId === null
      ? await supabase.from('incident_category').insert(payload)
      : await supabase.from('incident_category').update(payload).eq('category_id', editingId)
    setSaving(false)
    if (error) { setSaveError(`Không lưu được: ${error.message}`); return }
    setOpen(false)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Loại sự cố</h1>
          <p className="text-sm text-muted-foreground">Danh mục loại sự cố, mức ưu tiên và thời hạn xử lý (SLA) áp dụng khi tạo ticket</p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus className="mr-2 h-4 w-4" />Thêm loại sự cố
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingData ? (
            <p className="p-6 text-muted-foreground">Đang tải...</p>
          ) : loadError ? (
            <p className="p-6 text-destructive">Không tải được danh mục: {loadError}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại sự cố</TableHead>
                  <TableHead>Mức ưu tiên</TableHead>
                  <TableHead className="text-right">SLA (giờ)</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.category_id}>
                    <TableCell className="font-semibold">{c.category_name}</TableCell>
                    <TableCell><SeverityTag level={c.priority_level} /></TableCell>
                    <TableCell className="text-right">{c.sla_hours}</TableCell>
                    <TableCell className="max-w-md text-muted-foreground">{c.description || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" title="Sửa loại sự cố" onClick={() => openForm(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editingId === null ? 'Thêm loại sự cố' : 'Sửa loại sự cố'}
        description="Thay đổi số giờ SLA chỉ áp dụng cho các ticket được tạo sau thời điểm lưu."
        loading={saving}
        error={saveError}
        canSubmit={canSubmit}
        onSubmit={submit}
      >
        <div className="flex flex-col gap-2">
          <Label>Tên loại sự cố *</Label>
          <Input value={form.category_name} onChange={(e) => set('category_name')(e.target.value)} placeholder="VD: Tấn công DDoS" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>Mức ưu tiên *</Label>
            <Select value={form.priority_level} onValueChange={(v) => set('priority_level')(String(v ?? 'MEDIUM'))}>
              <SelectTrigger className="w-full"><SelectValue>{form.priority_level}</SelectValue></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>SLA (giờ) *</Label>
            <Input type="number" min={1} max={720} value={form.sla_hours} onChange={(e) => set('sla_hours')(e.target.value)} placeholder="VD: 24" />
          </div>
        </div>
        {form.sla_hours && !slaValid && (
          <p className="-mt-2 text-xs text-destructive">SLA phải là số nguyên từ 1 đến 720 giờ.</p>
        )}
        <div className="flex flex-col gap-2">
          <Label>Mô tả</Label>
          <Textarea value={form.description} onChange={(e) => set('description')(e.target.value)} placeholder="Dấu hiệu nhận biết loại sự cố này" className="min-h-20" />
        </div>
      </FormDialog>
    </div>
  )
}
