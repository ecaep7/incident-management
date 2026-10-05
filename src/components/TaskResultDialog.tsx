'use client'

import { Dialog } from '@base-ui/react/dialog'
import { X, Clock, User, Compass, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tag } from '@/components/Tag'
import { TaskAttachments, type TaskAttachment } from '@/components/TaskAttachments'

// Popup "Ket qua xu ly" cua mot task: ghi chu, tep bang chung, thoi gian gui va (neu duoc phep) o duyet ket qua.
// Chi la lop giao dien: cac ham duyet (onPass/onFail) van la logic cu cua trang chi tiet ticket.

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString('vi-VN') : '—')

function duration(from?: string | null, to?: string | null) {
  if (!from || !to) return null
  const mins = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  if (mins < 60) return `${mins} phút`
  const h = Math.floor(mins / 60), m = mins % 60
  if (h < 24) return m ? `${h} giờ ${m} phút` : `${h} giờ`
  const d = Math.floor(h / 24), rh = h % 24
  return rh ? `${d} ngày ${rh} giờ` : `${d} ngày`
}

export function ReviewStatusTag({ task }: { task: any }) {
  if (!task.submitted_at) return <Tag tone="blue">Đang xử lý</Tag>
  if (task.is_passed === null) return <Tag tone="pending">Chờ duyệt</Tag>
  return task.is_passed
    ? <Tag tone="green">Đạt</Tag>
    : <Tag tone="failed">Không đạt</Tag>
}

export function TaskResultDialog({
  open, onOpenChange, task, ticketCode, attachments, canReview,
  reviewNotes, onReviewNotesChange, message, actionLoading, onPass, onFail, children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: any | null
  ticketCode: string
  attachments: TaskAttachment[]
  canReview: boolean
  reviewNotes: string
  onReviewNotesChange: (v: string) => void
  message?: string
  actionLoading?: boolean
  onPass: () => void
  onFail: () => void
  children?: React.ReactNode // hop thoai xac nhan long ben trong
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[12px] bg-card shadow-xl ring-1 ring-foreground/10 transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 after:pointer-events-none after:absolute after:inset-0 after:rounded-[12px] after:bg-black/0 after:transition-colors data-nested-dialog-open:after:bg-black/30">
          {task && (
            <>
              {/* Dau popup */}
              <div className="flex items-start justify-between gap-4 border-b px-6 pt-6 pb-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13px] text-muted-foreground">{ticketCode} · Task #{task.task_id}</span>
                  <Dialog.Title className="text-h2">Kết quả xử lý</Dialog.Title>
                </div>
                <div className="flex items-center gap-2">
                  <ReviewStatusTag task={task} />
                  <Dialog.Close
                    aria-label="Đóng"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
              </div>

              {/* Noi dung cuon duoc */}
              <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-[8px] bg-[var(--surface-soft)] p-4 text-sm sm:grid-cols-2">
                  <Meta icon={User} label="Người xử lý" value={task.handler_full_name || task.handler_user_id} />
                  <Meta icon={Compass} label="Hướng xử lý" value={task.direction === 'ONSITE' ? 'Hiện trường (ONSITE)' : task.direction === 'SYSTEM' ? 'Hệ thống (SYSTEM)' : task.direction || '—'} />
                  <Meta icon={CalendarPlus} label="Giao việc lúc" value={fmt(task.created_at)} />
                  <Meta
                    icon={Clock}
                    label="Gửi kết quả lúc"
                    value={task.submitted_at ? fmt(task.submitted_at) : 'Chưa gửi'}
                    hint={duration(task.created_at, task.submitted_at) ? `sau ${duration(task.created_at, task.submitted_at)} kể từ khi giao` : undefined}
                  />
                </dl>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Ghi chú của người xử lý</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/70">
                    {task.handler_description || <span className="text-muted-foreground">(Không có ghi chú)</span>}
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Bằng chứng xử lý{attachments.length ? ` (${attachments.length} tệp)` : ''}
                  </h3>
                  <TaskAttachments items={attachments} />
                </section>

                {task.is_passed === false && task.admin_review_notes && (
                  <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Lý do không đạt</h3>
                    <p className="rounded-[8px] bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">{task.admin_review_notes}</p>
                  </section>
                )}

                {canReview && (
                  <section className="flex flex-col gap-2 border-t pt-5">
                    <h3 className="text-sm font-semibold text-foreground">Duyệt kết quả</h3>
                    <Textarea
                      value={reviewNotes}
                      onChange={(e) => onReviewNotesChange(e.target.value)}
                      placeholder="Nhận xét / lý do (bắt buộc nếu Không đạt)"
                      className="min-h-24"
                    />
                    {message && <p className="text-sm text-destructive">{message}</p>}
                  </section>
                )}
              </div>

              {/* Chan popup */}
              <div className="flex justify-end gap-2 border-t px-6 py-4">
                <Dialog.Close render={<Button variant="secondary" className="h-10 rounded-[17px] border-0 px-5 text-sm" />}>
                  Đóng
                </Dialog.Close>
                {canReview && (
                  <>
                    <Button
                      variant="destructive"
                      disabled={actionLoading}
                      onClick={onFail}
                      className="h-10 rounded-[17px] border-0 bg-[#E05252] px-5 text-sm text-white hover:bg-[#CF4646] dark:bg-[#E05252] dark:hover:bg-[#CF4646]"
                    >Không đạt</Button>
                    <Button disabled={actionLoading} onClick={onPass} className="h-10 rounded-[17px] border-0 px-5 text-sm">
                      Đạt
                    </Button>
                  </>
                )}
              </div>
              {children}
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Meta({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <dt className="text-[13px] font-semibold text-foreground">{label}</dt>
        <dd className="text-foreground/70">{value}</dd>
        {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
      </div>
    </div>
  )
}
