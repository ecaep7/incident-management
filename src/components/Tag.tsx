import { cn } from 'cn'

// The trang thai dang "o chu nhat bo goc nho" (thay cho vien thuoc bo tron).
// - soft: nen nhat + chu dam (muc do thap / trang thai thong thuong)
// - medium: nen vua + chu trang
// - solid: nen dam + chu trang (muc do cao, can chu y)

export type TagTone =
  | 'red-soft' | 'red-medium' | 'red-solid' | 'red-strong'
  | 'blue' | 'amber' | 'green' | 'gray' | 'orange'

const TONE_CLASS: Record<TagTone, string> = {
  'red-soft': 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  'red-medium': 'bg-rose-400 text-white dark:bg-rose-500/70',
  'red-solid': 'bg-rose-500 text-white',
  'red-strong': 'bg-rose-700 text-white',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
}

export function Tag({ tone, children, className }: { tone: TagTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-[4.5rem] items-center justify-center whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

const SEVERITY_TONE: Record<string, TagTone> = {
  LOW: 'red-soft',
  MEDIUM: 'red-medium',
  HIGH: 'red-solid',
  CRITICAL: 'red-strong',
}
const SEVERITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' }

export function SeverityTag({ level }: { level?: string | null }) {
  if (!level) return <span className="text-muted-foreground">—</span>
  return <Tag tone={SEVERITY_TONE[level] || 'gray'}>{SEVERITY_LABEL[level] || level}</Tag>
}

const TICKET_STATUS_TONE: Record<string, TagTone> = { Assigned: 'blue', 'Pending Review': 'amber', Closed: 'green' }

export function TicketStatusTag({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return <Tag tone={TICKET_STATUS_TONE[status] || 'gray'}>{status}</Tag>
}

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới',
  Verifying: 'Đang xác minh',
  Ticket_Created: 'Đã tạo ticket',
  Closed_False: 'Cảnh báo sai',
}
const INCIDENT_STATUS_TONE: Record<string, TagTone> = {
  NEW: 'orange', Verifying: 'amber', Ticket_Created: 'blue', Closed_False: 'gray',
}

export function IncidentStatusTag({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>
  return <Tag tone={INCIDENT_STATUS_TONE[status] || 'gray'}>{INCIDENT_STATUS_LABEL[status] || status}</Tag>
}

// Ket qua cua mot task: Chua nop / Cho duyet / Dat / Khong dat
export function TaskResultTag({ task }: { task: { submitted_at?: string | null; is_passed?: boolean | null } }) {
  if (!task.submitted_at) return <Tag tone="gray">Chưa nộp</Tag>
  if (task.is_passed === null || task.is_passed === undefined) return <Tag tone="amber">Chờ duyệt</Tag>
  return task.is_passed ? <Tag tone="green">Đạt</Tag> : <Tag tone="red-solid">Không đạt</Tag>
}
