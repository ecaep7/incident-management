'use client'

import { FileText, FileImage, File as FileIcon, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Tep bang chung handler nop kem mot task. `url` la signed URL (bucket rieng tu), co the rong neu khong ky duoc.
export type TaskAttachment = {
  attachment_id: number
  entity_id: number
  file_name: string | null
  file_url: string
  uploaded_at: string | null
  url?: string | null
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

function extOf(name: string) {
  const m = name.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toUpperCase() : 'FILE'
}

function iconFor(name: string) {
  if (IMAGE_EXT.test(name)) return FileImage
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(name)) return FileText
  return FileIcon
}

// Moi lan bam tao link tai moi (link tao luc mo trang chi song 1 gio, de lau se het han)
async function openFresh(e: React.MouseEvent, path: string, fileName: string, isImage: boolean) {
  e.preventDefault()
  // Anh: mo tab moi de xem. Mo tab truoc khi cho mang de trinh duyet khong chan popup.
  const tab = isImage ? window.open('', '_blank') : null
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 60 * 5)
  if (error || !data?.signedUrl) {
    tab?.close()
    window.alert('Không tải được tệp, vui lòng thử lại.')
    return
  }
  if (tab) { tab.location.href = data.signedUrl; return }   // anh: xem trong tab moi

  // File: tai ve bo nho roi tu luu voi dung ten (giu nguyen chu tieng Viet co dau)
  const res = await fetch(data.signedUrl)
  if (!res.ok) { window.alert('Không tải được tệp, vui lòng thử lại.'); return }
  const blobUrl = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}
export function TaskAttachments({ items }: { items: TaskAttachment[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Không có tệp đính kèm.</p>
  }

  const images = items.filter((a) => IMAGE_EXT.test(a.file_name || a.file_url) && a.url)
  const files = items.filter((a) => !images.includes(a))

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a
              key={a.attachment_id}
              href={a.url!}
              target="_blank"
              rel="noopener noreferrer"
              title={a.file_name || undefined}
              onClick={(e) => openFresh(e, a.file_url, a.file_name || 'tep', true)}
              className="group relative block h-28 w-40 overflow-hidden rounded-md border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url!} alt={a.file_name || 'Ảnh đính kèm'} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-xs text-white">
                {a.file_name}
              </span>
            </a>
          ))}
        </div>
      )}
      {files.map((a) => {
        const name = a.file_name || a.file_url.split('/').pop() || 'Tệp'
        const Icon = iconFor(name)
        const inner = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--block-blue)] text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-foreground/70">{name}</span>
              <span className="text-xs text-muted-foreground">
                {extOf(name)}
                {a.uploaded_at && ` · Tải lên ${new Date(a.uploaded_at).toLocaleString('vi-VN')}`}
                {!a.url && ' · Không mở được tệp'}
              </span>
            </span>
            {a.url && <Download className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />}
          </>
        )
        return a.url ? (
          <a
            key={a.attachment_id}
            href={a.url}
            onClick={(e) => openFresh(e, a.file_url, name, false)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm hover:border-primary/40 hover:bg-[var(--surface-soft)]"
          >
            {inner}
          </a>
        ) : (
          <div key={a.attachment_id} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
            {inner}
          </div>
        )
      })}
    </div>
  )
}
