export function StatusDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

export function severityColor(level: string) {
  switch (level) {
    case 'CRITICAL': return '#DC2626'
    case 'HIGH': return '#EA580C'
    case 'MEDIUM': return '#D97706'
    case 'LOW': return '#64748B'
    default: return '#94A3B8'
  }
}

export function ticketStatusColor(status: string) {
  switch (status) {
    case 'Assigned': return '#2563EB'
    case 'Pending Review': return '#D97706'
    case 'Closed': return '#16A34A'
    default: return '#94A3B8'
  }
}