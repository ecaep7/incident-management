import { supabase } from '@/lib/supabase'

// Goi y cua AI (Gemini) cho mot canh bao. Bang ai_suggestion do n8n ghi, chi Admin doc duoc (RLS).
// Giao dien chi DOC, khong ghi gi.

export type AiVerdict = 'TRUE_INCIDENT' | 'FALSE_POSITIVE' | 'NEED_VERIFICATION'

export type AiSuggestion = {
  suggestion_id: number
  incident_id: number
  verdict: AiVerdict
  suggested_category_id: number | null
  suggested_direction: 'ONSITE' | 'SYSTEM' | null
  confidence: number | null
  reasoning: string | null
  created_at: string
  incident_category: { category_name: string; priority_level: string | null; sla_hours: number | null } | null
}

export const AI_VERDICT_LABEL: Record<AiVerdict, string> = {
  TRUE_INCIDENT: 'Sự cố thật',
  FALSE_POSITIVE: 'Cảnh báo sai',
  NEED_VERIFICATION: 'Cần xác minh',
}

export function confidenceLevel(c: number | null | undefined) {
  if (c == null) return null
  if (c >= 0.8) return 'Cao'
  if (c >= 0.5) return 'Trung bình'
  return 'Thấp'
}

// Lay goi y OK gan nhat cua mot canh bao (dong ERROR chi de theo doi loi, khong hien len)
export async function fetchLatestSuggestion(incidentId: string | number) {
  const { data } = await supabase
    .from('ai_suggestion')
    .select('suggestion_id, incident_id, verdict, suggested_category_id, suggested_direction, confidence, reasoning, created_at, incident_category(category_name, priority_level, sla_hours)')
    .eq('incident_id', incidentId)
    .eq('status', 'OK')
    .order('created_at', { ascending: false })
    .limit(1)
  return ((data?.[0] as unknown) as AiSuggestion | undefined) ?? null
}

// So lan AI da that bai voi canh bao nay (n8n bo qua sau 3 lan)
export async function countFailedSuggestions(incidentId: string | number) {
  const { count } = await supabase
    .from('ai_suggestion')
    .select('suggestion_id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
    .eq('status', 'ERROR')
  return count ?? 0
}