import { FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'

/** Consistent label for temporary / mock behaviour so demo content is never mistaken for real data. */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#334155] bg-secondary/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      <p>{children}</p>
    </div>
  )
}
