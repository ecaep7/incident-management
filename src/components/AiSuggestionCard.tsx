'use client'

import { Sparkles, ArrowRight, Loader2, CircleAlert } from 'lucide-react'
import { Tag, type TagTone } from '@/components/Tag'
import { AI_VERDICT_LABEL, confidenceLevel, type AiSuggestion, type AiVerdict } from '@/lib/aiSuggestion'

// Card "Goi y cua AI" o trang chi tiet canh bao (chi Admin thay).
// Nen xanh rat nhat + bieu tuong lap lanh de tach biet ro voi du lieu he thong.

const VERDICT_TONE: Record<AiVerdict, TagTone> = {
  TRUE_INCIDENT: 'blue',
  FALSE_POSITIVE: 'gray',
  NEED_VERIFICATION: 'pending',
}

export function AiVerdictTag({ verdict, confidence }: { verdict: AiVerdict; confidence?: number | null }) {
  return (
    <Tag tone={VERDICT_TONE[verdict]}>
      {AI_VERDICT_LABEL[verdict]}
      {confidence != null && <span className="ml-1 opacity-70">· {Math.round(confidence * 100)}%</span>}
    </Tag>
  )
}

function relTime(v: string) {
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} giờ trước`
  return new Date(v).toLocaleString('vi-VN')
}

export function AiSuggestionCard({
  suggestion, state, isOpen, onCreateTicket, onUseAsReason, onUseAsNote,
}: {
  suggestion: AiSuggestion | null
  state: 'pending' | 'failed' | 'ready'
  isOpen: boolean // canh bao con dang cho xu ly?
  onCreateTicket: () => void
  onUseAsReason: (text: string) => void
  onUseAsNote: (text: string) => void
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

      {state === 'pending' && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          AI đang phân tích cảnh báo này, kết quả sẽ tự hiện sau ít phút…
        </p>
      )}

      {state === 'failed' && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          AI chưa phân tích được cảnh báo này. Bạn vẫn xử lý bình thường bằng các thao tác bên cạnh.
        </p>
      )}

      {state === 'ready' && suggestion && (
        <>
          {/* Ket luan */}
          <div className="flex items-center justify-between gap-2">
            <AiVerdictTag verdict={suggestion.verdict} />
            <span className="text-xs text-muted-foreground">{relTime(suggestion.created_at)}</span>
          </div>

          {/* Loai su co + huong xu ly (chi khi la su co that) */}
          {suggestion.verdict === 'TRUE_INCIDENT' && (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Loại sự cố</dt>
                <dd className="text-right font-semibold text-foreground">
                  {suggestion.incident_category?.category_name ?? `Loại #${suggestion.suggested_category_id}`}
                  {suggestion.incident_category?.sla_hours != null && (
                    <span className="block text-xs font-normal text-muted-foreground">SLA {suggestion.incident_category.sla_hours} giờ</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Hướng xử lý</dt>
                <dd className="font-semibold text-foreground">{suggestion.suggested_direction === 'ONSITE' ? 'Hiện trường' : 'Hệ thống'}</dd>
              </div>
            </dl>
          )}

          {/* Do tin cay */}
          {suggestion.confidence != null && (
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Độ tin cậy</span>
                <span className="font-medium text-foreground">{confidenceLevel(suggestion.confidence)} · {Math.round(suggestion.confidence * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(suggestion.confidence * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Giai thich */}
          {suggestion.reasoning && (
            <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/80">
              {suggestion.reasoning}
            </blockquote>
          )}

          {/* Nut hanh dong (chi khi canh bao con mo) */}
          {isOpen && suggestion.verdict === 'TRUE_INCIDENT' && (
            <button onClick={onCreateTicket}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[17px] bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85">
              Tạo ticket theo gợi ý <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {isOpen && suggestion.verdict === 'FALSE_POSITIVE' && suggestion.reasoning && (
            <button onClick={() => onUseAsReason(suggestion.reasoning!)}
              className="inline-flex h-10 w-full items-center justify-center rounded-[17px] border border-primary/30 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/5">
              Dùng làm lý do từ chối
            </button>
          )}
          {isOpen && suggestion.verdict === 'NEED_VERIFICATION' && suggestion.reasoning && (
            <button onClick={() => onUseAsNote(suggestion.reasoning!)}
              className="inline-flex h-10 w-full items-center justify-center rounded-[17px] border border-primary/30 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/5">
              Dùng làm nội dung yêu cầu xác minh
            </button>
          )}
        </>
      )}
    </section>
  )
}
