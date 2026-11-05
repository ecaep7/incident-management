'use client'

import { useState } from 'react'

// Sap xep theo cot thoi gian + phan trang cho cac bang danh sach (lam o phia giao dien,
// tren danh sach da tai va da loc). Dung chung cho moi trang danh sach.
//
// - sortFields: ten cot -> ham lay gia tri thoi gian cua dong (chuoi ISO / so / null)
// - defaultSort: cot sap xep mac dinh (bo trong = giu nguyen thu tu tai ve)
// - resetKey: chuoi dai dien cho bo loc hien tai; khi bo loc doi thi quay ve trang 1

export type SortDir = 'desc' | 'asc'

type TimeValue = string | number | null | undefined

export const PAGE_SIZE_OPTIONS = [10, 20, 50]

function toTime(v: TimeValue) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : new Date(v).getTime()
  return Number.isNaN(n) ? null : n
}

export function useTableView<T>(
  items: T[],
  opts: {
    sortFields?: Record<string, (row: T) => TimeValue>
    defaultSort?: { key: string; dir: SortDir } | null
    resetKey?: string
    pageSize?: number
  } = {},
) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(opts.defaultSort ?? null)
  const [pageSize, setPageSizeState] = useState(opts.pageSize ?? 10)
  const [pageState, setPageState] = useState({ page: 1, key: opts.resetKey ?? '' })

  // Bo loc doi -> ve trang 1 (cap nhat ngay trong luc render, khong can useEffect)
  if (pageState.key !== (opts.resetKey ?? '')) {
    setPageState({ page: 1, key: opts.resetKey ?? '' })
  }

  const getter = sort ? opts.sortFields?.[sort.key] : undefined
  const sorted = getter
    ? [...items].sort((a, b) => {
        const x = toTime(getter(a))
        const y = toTime(getter(b))
        if (x === null && y === null) return 0
        if (x === null) return 1 // dong khong co thoi gian luon nam cuoi
        if (y === null) return -1
        return sort!.dir === 'desc' ? y - x : x - y
      })
    : items

  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(pageState.page, pageCount)
  const start = (page - 1) * pageSize
  const rows = sorted.slice(start, start + pageSize)

  function toggleSort(key: string) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
    setPageState((p) => ({ ...p, page: 1 }))
  }

  return {
    rows,
    sorted,
    sortKey: sort?.key ?? null,
    sortDir: sort?.dir ?? null,
    toggleSort,
    page,
    pageCount,
    pageSize,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    setPage: (p: number) => setPageState((s) => ({ ...s, page: Math.max(1, Math.min(p, pageCount)) })),
    setPageSize: (n: number) => { setPageSizeState(n); setPageState((s) => ({ ...s, page: 1 })) },
  }
}

export type TableView = ReturnType<typeof useTableView>
