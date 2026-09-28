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
    case 'LOW': return '#E5B83C'      // vang diu
    case 'MEDIUM': return '#EE8A3C'   // cam
    case 'HIGH': return '#E05252'     // do
    case 'CRITICAL': return '#A82828' // do dam
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