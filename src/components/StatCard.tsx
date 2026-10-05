import { cn } from 'cn'

// O so lieu dang "khoi mau" (color block): nen pastel, bo goc lon, khong vien, khong bong.
// Nhan dung chu mono viet hoa; so lon, net manh. Gia tri = 0 thi ve nen xam nhat.
export type StatColor = 'orange' | 'amber' | 'red' | 'blue' | 'green'

const BLOCK: Record<StatColor | 'zero', { bg: string; number: string }> = {
  blue: { bg: 'bg-[var(--block-blue)]', number: 'text-[#0B3D73] dark:text-blue-200' },
  orange: { bg: 'bg-[var(--block-peach)]', number: 'text-[#8A3B0C] dark:text-orange-200' },
  amber: { bg: 'bg-[var(--block-cream)]', number: 'text-[#6B4E0A] dark:text-amber-200' },
  red: { bg: 'bg-[var(--block-pink)]', number: 'text-[#8C1D1D] dark:text-rose-200' },
  green: { bg: 'bg-[var(--block-mint)]', number: 'text-[#135C2A] dark:text-emerald-200' },
  zero: { bg: 'bg-card', number: 'text-muted-foreground' },
}

export function StatCard({ label, value, color, hint, onClick, active }: {
  label: string
  value: number | string
  color: StatColor
  hint?: string
  onClick?: () => void
  active?: boolean
}) {
  const isZero = value === 0 || value === '0'
  const style = BLOCK[isZero ? 'zero' : color]
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[12px] p-5 text-foreground',
        style.bg,
        onClick && 'cursor-pointer transition-transform hover:-translate-y-0.5',
        active && 'ring-2 ring-primary',
      )}
      onClick={onClick}
    >
      <span className="text-[13px] font-medium text-foreground/70">{label}</span>
      <span className={cn('text-5xl font-normal leading-none tracking-[-0.03em]', style.number)}>{value}</span>
      {hint && <span className="text-xs text-foreground/70">{hint}</span>}
    </div>
  )
}
