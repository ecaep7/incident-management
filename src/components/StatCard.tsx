import { Card, CardContent } from '@/components/ui/card'
import { cn } from 'cn'

// The so lieu co mau. Khi gia tri = 0 thi chuyen ve mau xam de mat tap trung vao so khac 0.
export type StatColor = 'orange' | 'amber' | 'red' | 'blue' | 'green'

const STYLE: Record<StatColor | 'zero', { card: string; number: string }> = {
  orange: { card: 'border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-500/10', number: 'text-orange-600 dark:text-orange-400' },
  amber: { card: 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-500/10', number: 'text-amber-600 dark:text-amber-400' },
  red: { card: 'border-l-4 border-l-rose-600 bg-rose-50 dark:bg-rose-500/10', number: 'text-rose-600 dark:text-rose-400' },
  blue: { card: 'border-l-4 border-l-blue-600 bg-blue-50 dark:bg-blue-500/10', number: 'text-blue-600 dark:text-blue-400' },
  green: { card: 'border-l-4 border-l-emerald-600 bg-emerald-50 dark:bg-emerald-500/10', number: 'text-emerald-600 dark:text-emerald-400' },
  zero: { card: 'border-l-4 border-l-slate-300 dark:border-l-slate-600', number: 'text-muted-foreground' },
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
  const style = STYLE[isZero ? 'zero' : color]
  return (
    <Card
      className={cn(style.card, onClick && 'cursor-pointer transition-shadow hover:shadow-md', active && 'ring-2 ring-primary')}
      onClick={onClick}
    >
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn('text-4xl font-light tracking-[-0.03em] tabular-nums', style.number)}>{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  )
}
