import { Award, X } from 'lucide-react'
import type { EventWithMeta } from '../../types'
import { OrganizerJudgingTab } from './OrganizerJudgingTab'

interface Props {
  open: boolean
  event: EventWithMeta | null
  onClose: () => void
  onUpdate?: () => void
}

export function OrganizerJudgingModal({ open, event, onClose, onUpdate }: Props) {
  if (!open || !event) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organizer-judging-title"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-[#334155] bg-[#0B0F19] p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-[#334155] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Award className="h-4 w-4" />
              <span>Organizer Judging &amp; Results Management</span>
            </div>
            <h2 id="organizer-judging-title" className="text-xl font-bold text-white mt-1">
              {event.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-elevated hover:text-white"
            aria-label="Close judging modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <OrganizerJudgingTab
            event={event}
            onUpdate={() => {
              onUpdate?.()
            }}
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-[#334155]">
          <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
