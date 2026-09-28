'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { loadTicketBundle, type TicketBundle } from '@/lib/ticketBundle'
import { slaLabel } from '@/components/SlaBadge'

// Ban in "Bien ban xu ly su co". Trang nay khong co sidebar (xem AppShell),
// tu mo hop thoai in cua trinh duyet sau khi tai xong du lieu.

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

export default function TicketPrintPage() {
  const { profile, loading } = useProfile()
  const params = useParams()
  const ticketId = params.id as string
  const [bundle, setBundle] = useState<TicketBundle | null | undefined>(undefined)

  useEffect(() => {
    if (!loading && profile) loadTicketBundle(ticketId).then(setBundle)
  }, [ticketId, loading, profile])

  useEffect(() => {
    if (bundle) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [bundle])

  if (loading || bundle === undefined) return <p className="p-10 text-sm">Đang chuẩn bị biên bản...</p>
  if (bundle === null) return <p className="p-10 text-sm">Không tìm thấy ticket hoặc bạn không có quyền xem.</p>

  const { ticket, incident, category, tasks, nameById, depById } = bundle
  const name = (id?: string | null) => (id ? nameById.get(id) || '—' : '—')
  const finalTask = tasks[tasks.length - 1]
  const statusVi: Record<string, string> = { Assigned: 'Đang xử lý', 'Pending Review': 'Chờ duyệt', Closed: 'Đã đóng' }

  return (
    <div className="min-h-screen bg-white">
    <div className="mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-relaxed text-black">
      <div className="mb-2 flex justify-between print:hidden">
        <button onClick={() => window.print()} className="rounded border px-3 py-1 text-sm">In lại</button>
        <button onClick={() => window.close()} className="rounded border px-3 py-1 text-sm">Đóng</button>
      </div>

      <div className="text-center">
        <p className="font-semibold uppercase">Hệ thống quản lý sự cố an toàn thông tin</p>
        <h1 className="mt-4 text-xl font-bold uppercase">Biên bản xử lý sự cố</h1>
        <p>Mã ticket: <b>{ticket.ticket_code}</b></p>
      </div>

      <Section title="I. Thông tin sự cố">
        <Row label="Nội dung cảnh báo" value={incident?.alert_summary} />
        <Row label="Thiết bị (IP)" value={incident?.device_ip} />
        <Row label="Mức độ cảnh báo" value={incident?.severity_level} />
        <Row label="Nguồn cảnh báo" value={incident?.source_system} />
        <Row label="Thời điểm tiếp nhận" value={fmt(incident?.received_at)} />
      </Section>

      <Section title="II. Phân loại và phân công">
        <Row label="Loại sự cố" value={category ? `${category.category_name} (${category.priority_level})` : '—'} />
        <Row label="Thời hạn SLA" value={category ? `${category.sla_hours} giờ · hạn chót ${fmt(ticket.sla_deadline)}` : fmt(ticket.sla_deadline)} />
        <Row label="Người tạo ticket" value={`${name(ticket.created_by)} · ${fmt(ticket.created_at)}`} />
        <Row label="Phòng ban phụ trách" value={depById.get(ticket.assigned_dep_id)} />
        <Row label="Hướng xử lý" value={ticket.direction} />
      </Section>

      <Section title="III. Quá trình xử lý">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {['Lượt', 'Người xử lý', 'Mô tả xử lý', 'Nộp lúc', 'Kết quả duyệt'].map((h) => (
                <th key={h} className="border border-black px-2 py-1 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr key={t.task_id} className="align-top">
                <td className="border border-black px-2 py-1">{i + 1}</td>
                <td className="border border-black px-2 py-1">{name(t.handler_user_id)}<br />{depById.get(t.assigned_dep_id)}</td>
                <td className="border border-black px-2 py-1">{t.handler_description || '(chưa nộp)'}</td>
                <td className="border border-black px-2 py-1">{fmt(t.submitted_at)}</td>
                <td className="border border-black px-2 py-1">
                  {t.is_passed === null ? 'Chưa duyệt' : t.is_passed ? 'Đạt' : `Không đạt: ${t.admin_review_notes || ''}`}
                  {t.reviewed_at && <><br />{name(t.reviewed_by)} · {fmt(t.reviewed_at)}</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="IV. Kết luận">
        <Row label="Trạng thái ticket" value={statusVi[ticket.status] || ticket.status} />
        <Row label="Thời điểm đóng" value={fmt(ticket.closed_at)} />
        <Row label="Tình trạng SLA" value={slaLabel(ticket)} />
        <Row label="Số lượt xử lý" value={`${tasks.length}${tasks.length > 1 ? ' (có tái phân công)' : ''}`} />
      </Section>

      <div className="mt-10 grid grid-cols-2 text-center">
        <div>
          <p className="font-semibold">Người xử lý</p>
          <p className="italic">(Ký, ghi rõ họ tên)</p>
          <p className="mt-16">{name(finalTask?.handler_user_id)}</p>
        </div>
        <div>
          <p className="font-semibold">Người duyệt</p>
          <p className="italic">(Ký, ghi rõ họ tên)</p>
          <p className="mt-16">{name(finalTask?.reviewed_by)}</p>
        </div>
      </div>

      <p className="mt-10 text-right text-[11px] italic">
        In lúc {new Date().toLocaleString('vi-VN')} bởi {profile?.full_name}
      </p>
    </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 font-bold">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="w-48 shrink-0">{label}:</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}
