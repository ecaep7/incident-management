import { cn } from 'cn'
import { StatusDot, severityColor } from '@/components/StatusDot'

// The trang thai dang "o chu nhat bo goc nho", nen nhat + chu dam de de doc ma khong choi.
// Rieng muc do (severity) dung cham tron mau (xem SeverityTag).

export type TagTone =
  | 'red' | 'blue' | 'amber' | 'green' | 'gray' | 'orange'

const TONE_CLASS: Record<TagTone, string> = {
  // Do diu: nen rat nhat + vien mong, khong gay choi mat
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
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

const SEVERITY_LABEL: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' }

// Muc do hien thi dang cham tron: Low vang, Medium cam, High do, Critical do dam
export function SeverityTag({ level }: { level?: string | null }) {
  if (!level) return <span className="text-muted-foreground">—</span>
  return <StatusDot label={SEVERITY_LABEL[level] || level} color={severityColor(level)} />
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
  return task.is_passed ? <Tag tone="green">Đạt</Tag> : <Tag tone="red">Không đạt</Tag>
}
