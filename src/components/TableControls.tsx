'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from 'cn'
import { PAGE_SIZE_OPTIONS, type SortDir } from '@/lib/useTableView'

// Tieu de cot thoi gian co mui ten: bam de doi giua "moi nhat truoc" va "cu nhat truoc"
export function SortableHead({ label, field, sortKey, sortDir, onSort, className }: {
  label: string
  field: string
  sortKey: string | null
  sortDir: SortDir | null
  onSort: (field: string) => void
  className?: string
}) {
  const active = sortKey === field
  const Icon = !active ? ArrowUpDown : sortDir === 'desc' ? ArrowDown : ArrowUp
  const title = !active ? 'Sắp xếp theo thời gian' : sortDir === 'desc' ? 'Đang xếp: mới nhất trước' : 'Đang xếp: cũ nhất trước'
  return (
    <TableHead className={className} aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => onSort(field)} title={title}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}>
        {label}
        <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-50')} />
      </button>
    </TableHead>
  )
}

// Danh sach so trang co dau "…" khi nhieu trang: 1 … 4 5 6 … 12
function pageList(page: number, count: number): (number | '…')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const lo = Math.max(2, page - 1)
  const hi = Math.min(count - 1, page + 1)
  if (lo > 2) out.push('…')
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < count - 1) out.push('…')
  out.push(count)
  return out
}

// Thanh phan trang dat duoi bang
export function TablePagination({ page, pageCount, pageSize, total, from, to, setPage, setPageSize, unit = 'dòng' }: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  from: number
  to: number
  setPage: (p: number) => void
  setPageSize: (n: number) => void
  unit?: string
}) {
  if (total === 0) return null
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-[10px] px-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Hiển thị {from}–{to} / {total} {unit}</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">Mỗi trang</span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v ?? 10))}>
          <SelectTrigger size="sm" className="w-[72px]"><SelectValue>{pageSize}</SelectValue></SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, 'hover:bg-muted')} onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Trang trước">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageList(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1">…</span>
            ) : (
              <button key={p} type="button" onClick={() => setPage(p)} aria-current={p === page ? 'page' : undefined}
                className={cn(btn, p === page ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted text-foreground')}>
                {p}
              </button>
            ),
          )}
          <button type="button" className={cn(btn, 'hover:bg-muted')} onClick={() => setPage(page + 1)} disabled={page === pageCount} aria-label="Trang sau">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
