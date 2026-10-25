import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  value: string
  helper?: string
}

export function DashboardStatCard({ icon: Icon, label, value, helper }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 border border-brand/20 text-brand shadow-cyber">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p>
      {helper && <p className="mt-1 text-xs text-ink-faint">{helper}</p>}
    </div>
  )
}
