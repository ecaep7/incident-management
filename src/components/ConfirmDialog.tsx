'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info } from 'lucide-react'

// Hop thoai xac nhan truoc cac thao tac khong the hoan tac.
// Chi la mot buoc hoi lai o giao dien: khi bam "Xac nhan" moi goi ham xu ly cu,
// khong thay doi logic hay du lieu nao.

export type ConfirmTone = 'default' | 'destructive'

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = 'Xác nhận', tone = 'default', onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  tone?: ConfirmTone
  onConfirm: () => void
}) {
  const destructive = tone === 'destructive'
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[12px] bg-card p-6 shadow-xl ring-1 ring-foreground/10 transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="flex gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${destructive ? 'bg-red-50 text-red-600 dark:bg-red-500/15' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/15'}`}>
              {destructive ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <AlertDialog.Title className="text-base font-semibold">{title}</AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground">{description}</AlertDialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Close
              render={<Button variant="secondary" className="h-10 rounded-[17px] border-0 px-5 text-sm" />}
            >Hủy</AlertDialog.Close>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              className={`h-10 rounded-[17px] border-0 px-5 text-sm ${destructive ? 'bg-[#E05252] text-white hover:bg-[#CF4646] dark:bg-[#E05252] dark:hover:bg-[#CF4646]' : ''}`}
              onClick={() => { onOpenChange(false); onConfirm() }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
