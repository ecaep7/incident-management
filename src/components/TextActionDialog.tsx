'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Hop thoai nho co 1 o nhap noi dung (dung cho "Tu choi" va "Yeu cau xac minh").
// Chi la lop giao dien: bam nut xac nhan moi goi ham xu ly cu cua trang.

export function TextActionDialog({
  open, onOpenChange, title, description, label, placeholder, value, onChange,
  fromAi, confirmLabel, tone = 'default', loading, error, onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  fromAi?: boolean          // noi dung dang la goi y cua AI?
  confirmLabel: string
  tone?: 'default' | 'destructive'
  loading?: boolean
  error?: string
  onConfirm: () => void
}) {
  const destructive = tone === 'destructive'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[12px] bg-card p-6 shadow-xl ring-1 ring-foreground/10 transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-h3">{title}</Dialog.Title>
            {description && <Dialog.Description className="text-sm text-muted-foreground">{description}</Dialog.Description>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{label}</span>
              {fromAi && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3" />Điền sẵn từ gợi ý AI
                </span>
              )}
            </div>
            <Textarea autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-28" />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button variant="secondary" className="h-10 rounded-[17px] border-0 px-5 text-sm" />}>
              Hủy
            </Dialog.Close>
            <Button
              disabled={loading || !value.trim()}
              onClick={onConfirm}
              variant={destructive ? 'destructive' : 'default'}
              className={`h-10 rounded-[17px] border-0 px-5 text-sm ${destructive ? 'bg-[#E05252] text-white hover:bg-[#CF4646] dark:bg-[#E05252] dark:hover:bg-[#CF4646]' : ''}`}
            >
              {loading ? 'Đang xử lý...' : confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}