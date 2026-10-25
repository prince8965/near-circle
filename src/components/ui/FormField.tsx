import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

export interface FieldFlag {
  state: 'ok' | 'review' | 'missing'
  note?: string
}

interface Props {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  /** Optional review flag, used by the poster-to-event workflow. */
  flag?: FieldFlag
  children: ReactNode
}

export function FormField({ id, label, error, hint, required, flag, children }: Props) {
  const needsReview = flag && flag.state !== 'ok'
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required && (
          <span className="text-rose-400" aria-hidden>
            {' '}
            *
          </span>
        )}
        {needsReview && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-300">
            <AlertCircle className="h-3 w-3" aria-hidden />
            {flag.state === 'missing' ? 'Missing — please add' : 'Please review'}
          </span>
        )}
      </label>
      {children}
      {needsReview && flag.note && !error && <p className="mt-1 text-xs text-amber-400">{flag.note}</p>}
      {hint && !error && !needsReview && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-rose-400">
          {error}
        </p>
      )}
    </div>
  )
}
