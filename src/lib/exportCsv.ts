// Xuat du lieu ra file CSV mo duoc bang Excel (co BOM de hien dung tieng Viet).
// Chi chay o trinh duyet, khong goi server.

export function downloadCsv(filenamePrefix: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '')
