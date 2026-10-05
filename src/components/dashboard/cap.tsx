'use client'

import Link from 'next/link'
import { cn } from 'cn'
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'

// Bo khung giao dien dashboard theo phong cach Capitalio (Watermelon UI, MIT),
// da chinh lai theo tong xanh-trang, thang chu va bo goc 12px cua he thong.
// Chi la lop trinh bay: khong chua logic du lieu.

// Khoi noi dung (card) - vien mong, nen trang
export function DashCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <article className={cn('flex min-w-0 flex-col gap-5 rounded-[12px] border border-border bg-card p-5 text-card-foreground', className)}>
      {children}
    </article>
  )
}

// Dau khoi: tieu de + mo ta ngan, ben phai la nhan / nut
export function DashHeader({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-h3">{title}</h2>
        {subtitle && <p className="mt-1 truncate text-caption text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>}
    </div>
  )
}

// Nhan mau nhat (nen 10% cua mau chu)
export function DashTag({ children, color = 'var(--primary)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="whitespace-nowrap rounded-[8px] px-2.5 py-1 text-caption font-medium"
      style={{ color, backgroundColor: `color-mix(in oklab, ${color} 10%, transparent)` }}>
      {children}
    </span>
  )
}

// Huy hieu icon: o vuong xanh chuyen mau (thay cho mau xam dam cua Capitalio)
export function IconBadge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'danger' }) {
  return (
    <span className={cn(
      'flex size-8 shrink-0 items-center justify-center rounded-[8px] border text-white [&_svg]:size-4',
      tone === 'primary'
        ? 'border-primary bg-linear-to-t from-[color-mix(in_oklab,var(--primary)_78%,black)] to-primary'
        : 'border-[#C24848] bg-linear-to-t from-[#A33A3A] to-[#D45454]',
    )}>
      {children}
    </span>
  )
}

// O vuong mau nho dung cho chu thich
export function Marker({ color, className }: { color: string; className?: string }) {
  return <span className={cn('size-3 shrink-0 rounded-[3px]', className)} style={{ backgroundColor: color }} />
}

export function LegendRow({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2 text-caption text-foreground/80">
          <Marker color={i.color} />{i.label}
        </span>
      ))}
    </div>
  )
}

// Thay doi so voi ky truoc
export function Delta({ delta, goodWhen, label = 'so với kỳ trước' }: { delta: number | null; goodWhen: 'up' | 'down'; label?: string }) {
  if (delta === null) return null
  const good = goodWhen === 'up' ? delta >= 0 : delta <= 0
  return (
    <span className="flex min-w-0 items-center gap-1 text-micro text-muted-foreground">
      <span className={cn('inline-flex shrink-0 items-center gap-0.5 font-semibold', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
        {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {delta >= 0 ? '+' : ''}{Math.round(delta)}%
      </span>
      <span className="truncate">{label}</span>
    </span>
  )
}

// The tong quan: tieu de + huy hieu, so lon, thay doi, thanh tien do o duoi
export function SummaryCard({ title, icon, value, delta, goodWhen, progress, hint, danger }: {
  title: string; icon: React.ReactNode; value: string; delta: number | null; goodWhen: 'up' | 'down'
  progress: number; hint?: string; danger?: boolean
}) {
  return (
    <DashCard className="gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-body text-foreground/80">{title}</span>
        <IconBadge tone={danger ? 'danger' : 'primary'}>{icon}</IconBadge>
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className={cn('text-[40px] leading-none font-[520] tracking-[-0.03em]', danger && 'text-red-700 dark:text-red-300')}>{value}</span>
        <span className="pb-1"><Delta delta={delta} goodWhen={goodWhen} /></span>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
          <div className={cn('h-full rounded-full', danger ? 'bg-[#E05252]' : 'bg-primary')}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </div>
        {hint && <span className="text-micro text-muted-foreground">{hint}</span>}
      </div>
    </DashCard>
  )
}

// Hang chi so nho ben duoi bieu do chinh
export function MetricRow({ items }: { items: { label: string; value: React.ReactNode; note?: React.ReactNode; danger?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 gap-5 border-t border-border pt-5 xl:grid-cols-4">
      {items.map((m) => (
        <div key={m.label} className="flex min-w-0 flex-col gap-2">
          <span className="truncate text-caption text-muted-foreground">{m.label}</span>
          <span className={cn('text-[24px] leading-none font-[520] tracking-[-0.02em]', m.danger && 'text-red-700 dark:text-red-300')}>{m.value}</span>
          {m.note && <span className="truncate text-micro text-muted-foreground">{m.note}</span>}
        </div>
      ))}
    </div>
  )
}

// Nen cham luoi phia sau bieu do chinh
export function DotGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('dash-dot-grid min-w-0 rounded-[8px] p-2', className)}>{children}</div>
}

// Bang dang luoi: dai tieu de bo goc, cac dong ke mong
export function GridTable<T>({ columns, rows, rowKey, empty, maxHeight, rowHref }: {
  columns: { label: string; width: string; align?: 'left' | 'right' | 'center'; render: (row: T) => React.ReactNode }[]
  rows: T[]
  rowKey: (row: T) => string | number
  empty?: string
  maxHeight?: string
  rowHref?: (row: T) => string
}) {
  const template = columns.map((c) => c.width).join(' ')
  const align = (a?: string) => (a === 'right' ? 'text-right justify-end' : a === 'center' ? 'text-center justify-center' : '')
  return (
    <div className="min-w-0">
      <div className="grid items-center gap-3 rounded-[8px] border border-border bg-[var(--surface-soft)] px-4 py-2.5 text-caption font-medium text-foreground/70"
        style={{ gridTemplateColumns: template }}>
        {columns.map((c) => <span key={c.label} className={cn('flex truncate', align(c.align))}>{c.label}</span>)}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-body text-muted-foreground">{empty || 'Không có dữ liệu.'}</p>
      ) : (
        <div className={cn(maxHeight && 'scroll-thin overflow-y-auto', maxHeight)}>
          {rows.map((r) => {
            const cells = columns.map((c) => (
              <div key={c.label} className={`text-body ${cn('flex min-w-0 items-center', align(c.align))}`}>{c.render(r)}</div>
            ))
            const cls = 'grid items-center gap-3 border-b border-border px-4 py-3 last:border-b-0'
            return rowHref ? (
              <Link key={rowKey(r)} href={rowHref(r)} className={cn(cls, 'transition-colors hover:bg-[var(--surface-soft)]')} style={{ gridTemplateColumns: template }}>{cells}</Link>
            ) : (
              <div key={rowKey(r)} className={cls} style={{ gridTemplateColumns: template }}>{cells}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Muc "nhan dinh / can chu y": huy hieu + tieu de + mo ta + nut hanh dong
export function InsightItem({ icon, title, description, action, tone, first }: {
  icon: React.ReactNode; title: React.ReactNode; description: React.ReactNode
  action?: { label: string; href: string }; tone?: 'primary' | 'danger'; first?: boolean
}) {
  return (
    <div className={cn('flex gap-3', !first && 'border-t border-border pt-5')}>
      <IconBadge tone={tone}>{icon}</IconBadge>
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold leading-tight">{title}</div>
        <div className="mt-1.5 text-caption leading-snug text-muted-foreground">{description}</div>
        {action && (
          <div className="mt-3 flex justify-end">
            <Link href={action.href}
              className="inline-flex h-8 items-center gap-1 rounded-[12px] bg-[var(--surface-soft)] px-3 text-caption font-medium text-foreground hover:bg-muted">
              {action.label}<ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// Nut phu nho (kieu "View" cua Capitalio)
export function SoftLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-8 items-center gap-1 rounded-[12px] bg-[var(--surface-soft)] px-3 text-caption font-medium text-foreground hover:bg-muted">
      {children}<ArrowUpRight className="size-3.5" />
    </Link>
  )
}

// Nhom chon nhanh (Ngay / Tuan / Thang ...)
export function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex gap-1 rounded-[14px] bg-[var(--surface-soft)] p-1">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`text-micro rounded-[10px] px-3 py-1 font-medium transition-colors ${value === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}
