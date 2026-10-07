'use client'

import { Sparkles, ArrowRight, Loader2, CircleAlert } from 'lucide-react'
import { Tag, type TagTone } from '@/components/Tag'
import { AI_VERDICT_LABEL, confidenceLevel, type AiSuggestion, type AiVerdict } from '@/lib/aiSuggestion'

// Card "Goi y cua AI" o trang chi tiet canh bao (chi Admin thay).
// Nen xanh rat nhat + bieu tuong lap lanh de tach biet ro voi du lieu he thong.

const VERDICT_TONE: Record<AiVerdict, TagTone> = {
  TRUE_INCIDENT: 'blue',
  FALSE_POSITIVE: 'gray',
  NEED_VERIFICATION: 'amber',
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-h3">Gợi ý của AI</h2>
        </div>
        <span className="text-xs text-muted-foreground">Chỉ mang tính tham khảo · Admin là người quyết định</span>
      </div>

      {state === 'pending' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI đang phân tích cảnh báo này, kết quả sẽ tự hiện sau ít phút…
        </p>
      )}

      {state === 'failed' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleAlert className="h-4 w-4" />
          AI chưa phân tích được cảnh báo này. Bạn vẫn xử lý bình thường bằng các thao tác bên dưới.
        </p>
      )}

      {state === 'ready' && suggestion && (
        <>
          {/* Ket luan + loai su co + huong xu ly */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <AiVerdictTag verdict={suggestion.verdict} />
            {suggestion.verdict === 'TRUE_INCIDENT' && (
              <>
                <span className="font-semibold text-foreground">{suggestion.incident_category?.category_name ?? `Loại #${suggestion.suggested_category_id}`}</span>
                {suggestion.incident_category?.sla_hours != null && (
                  <span className="text-muted-foreground">SLA {suggestion.incident_category.sla_hours}h</span>
                )}
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Xử lý: <span className="font-medium text-foreground">{suggestion.suggested_direction === 'ONSITE' ? 'Hiện trường (ONSITE)' : 'Hệ thống (SYSTEM)'}</span>
                </span>
              </>
            )}
          </div>

          {/* Do tin cay */}
          {suggestion.confidence != null && (
            <div className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-muted-foreground">
                Độ tin cậy: <span className="font-medium text-foreground">{confidenceLevel(suggestion.confidence)}</span>
              </span>
              <div className="h-1.5 max-w-60 flex-1 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(suggestion.confidence * 100)}%` }} />
              </div>
              <span className="w-10 text-right tabular-nums text-muted-foreground">{Math.round(suggestion.confidence * 100)}%</span>
            </div>
          )}

          {/* Giai thich */}
          {suggestion.reasoning && (
            <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/80">
              {suggestion.reasoning}
            </blockquote>
          )}

          {/* Chan card: thong tin model + nut hanh dong (chi khi canh bao con mo) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {suggestion.model_name}{suggestion.prompt_version ? ` · prompt ${suggestion.prompt_version}` : ''} · {relTime(suggestion.created_at)}
            </span>
            {isOpen && suggestion.verdict === 'TRUE_INCIDENT' && (
              <button onClick={onCreateTicket}
                className="inline-flex h-9 items-center gap-1.5 rounded-[15px] bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85">
                Tạo ticket theo gợi ý <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {isOpen && suggestion.verdict === 'FALSE_POSITIVE' && suggestion.reasoning && (
              <button onClick={() => onUseAsReason(suggestion.reasoning!)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[15px] border border-primary/30 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/5">
                Dùng làm lý do từ chối
              </button>
            )}
            {isOpen && suggestion.verdict === 'NEED_VERIFICATION' && suggestion.reasoning && (
              <button onClick={() => onUseAsNote(suggestion.reasoning!)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[15px] border border-primary/30 bg-card px-4 text-sm font-medium text-primary hover:bg-primary/5">
                Dùng làm nội dung yêu cầu xác minh
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
