'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Button } from '@/components/ui/button'

// Khung hop thoai dung chung cho cac form them / sua danh muc.
// Chi la lop giao dien: noi dung form truyen vao qua children, bam "Luu" thi goi onSubmit.

export function FormDialog({
  open, onOpenChange, title, description, children, submitLabel = 'Lưu', loading, error, canSubmit = true, onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  submitLabel?: string
  loading?: boolean
  error?: string
  canSubmit?: boolean
  onSubmit: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-[12px] bg-card p-6 shadow-xl ring-1 ring-foreground/10 transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
            {description && <Dialog.Description className="text-xs italic text-muted-foreground">{description}</Dialog.Description>}
          </div>

          <div className="flex flex-col gap-4">{children}</div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Dialog.Close render={<Button variant="secondary" className="h-10 rounded-[17px] border-0 px-5 text-sm" />}>
              Hủy
            </Dialog.Close>
            <Button disabled={loading || !canSubmit} onClick={onSubmit} className="h-10 rounded-[17px] border-0 px-5 text-sm">
              {loading ? 'Đang lưu...' : submitLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
