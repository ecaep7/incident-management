'use client'

import { Sparkles, Loader2, CircleAlert } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tag, type TagTone } from '@/components/Tag'
import { AI_VERDICT_LABEL, confidenceLevel, type AiSuggestion, type AiVerdict } from '@/lib/aiSuggestion'

// Card "Goi y cua AI" o trang chi tiet canh bao (chi Admin thay).
// Nen xanh rat nhat + bieu tuong lap lanh de tach biet ro voi du lieu he thong.

const VERDICT_TONE: Record<AiVerdict, TagTone> = {
  TRUE_INCIDENT: 'blue',
  FALSE_POSITIVE: 'gray',
  NEED_VERIFICATION: 'pending',
}

function relTime(v: string) {
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} giờ trước`
  return new Date(v).toLocaleString('vi-VN')
}

export function AiSuggestionCard({ suggestion, state }: {
  suggestion: AiSuggestion | null
  state: 'loading' | 'pending' | 'failed' | 'ready'
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[12px] bg-[#F2F7FD] p-5 ring-1 ring-primary/15 dark:bg-[#11223A] dark:ring-primary/25">
      {/* Dau card */}
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-h3">Gợi ý của AI</h2>
      </div>

      {state === 'loading' && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-28 bg-primary/10" />
          <Skeleton className="h-4 w-full bg-primary/10" />
          <Skeleton className="h-4 w-4/5 bg-primary/10" />
          <Skeleton className="h-16 w-full bg-primary/10" />
        </div>
      )}

      {state === 'pending' && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          AI đang phân tích cảnh báo này, kết quả sẽ tự hiện sau ít phút…
        </p>
      )}

      {state === 'failed' && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          AI chưa phân tích được cảnh báo này. Bạn vẫn xử lý bình thường bằng các thao tác bên dưới.
        </p>
      )}

      {state === 'ready' && suggestion && (
        <>
          {/* Ket luan + thoi gian */}
          <div className="flex items-center justify-between gap-2">
            <Tag tone={VERDICT_TONE[suggestion.verdict]}>{AI_VERDICT_LABEL[suggestion.verdict]}</Tag>
            <span className="text-xs text-muted-foreground">{relTime(suggestion.created_at)}</span>
          </div>

          {/* Loai su co + huong xu ly (chi khi la su co that) */}
          {suggestion.verdict === 'TRUE_INCIDENT' && (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-foreground">Loại sự cố</dt>
                <dd className="text-right font-light text-foreground/70">
                  {suggestion.incident_category?.category_name ?? `Loại #${suggestion.suggested_category_id}`}
                  {suggestion.incident_category?.sla_hours != null && (
                    <span className="block text-xs font-normal text-muted-foreground">SLA {suggestion.incident_category.sla_hours} giờ</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold text-foreground">Hướng xử lý</dt>
                <dd className="font-light text-foreground/70">{suggestion.suggested_direction === 'ONSITE' ? 'Hiện trường' : 'Hệ thống'}</dd>
              </div>
            </dl>
          )}

          {/* Do tin cay */}
          {suggestion.confidence != null && (
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Độ tin cậy</span>
                <span className="font-light text-foreground/70">{confidenceLevel(suggestion.confidence)} · {Math.round(suggestion.confidence * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(suggestion.confidence * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Giai thich cua AI */}
          {suggestion.reasoning && (
            <blockquote className="border-l-2 border-primary/40 pl-3 text-sm font-light leading-relaxed text-foreground/70">
              {suggestion.reasoning}
            </blockquote>
          )}
        </>
      )}
    </section>
  )
}