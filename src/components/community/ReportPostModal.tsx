import { useEffect, useState } from 'react'
import { Flag, X } from 'lucide-react'
import { useToast } from '../../hooks/ToastContext'
import { reportPost } from '../../services'

interface Props {
  postId: string
  open: boolean
  onClose: () => void
  onReported?: () => void
}

const REPORT_REASONS = [
  'Spam or advertising',
  'Harassment or hate speech',
  'Inappropriate media or content',
  'False or misleading event details',
  'Violates campus community guidelines',
  'Other',
]

export function ReportPostModal({ postId, open, onClose, onReported }: Props) {
  const { notify } = useToast()
  const [reason, setReason] = useState(REPORT_REASONS[0])
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await reportPost(postId, reason, details)
      notify('Thank you for reporting. Our moderation team will review this post.', 'info')
      onReported?.()
      onClose()
    } catch {
      notify('Could not submit report. Please try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={busy ? undefined : onClose} aria-hidden />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#334155] bg-secondary p-6 shadow-lift">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-[#334155] hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 text-rose-400">
          <div className="rounded-xl bg-rose-500/10 p-2.5 border border-rose-500/20">
            <Flag className="h-5 w-5 text-rose-400" />
          </div>
          <h2 id="report-modal-title" className="text-lg font-bold text-white">
            Report this post
          </h2>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          NearCircle is committed to maintaining a safe, respectful campus community. Reports are confidential.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="label text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Reason for report
            </label>
            <div className="space-y-2 mt-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-xs transition ${
                    reason === r
                      ? 'border-brand/60 bg-brand/5 text-white font-medium'
                      : 'border-[#334155] bg-[#0F172A]/50 text-ink-muted hover:border-[#475569]'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="h-4 w-4 accent-brand border-[#334155]"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="report-details" className="label text-xs">
              Additional details (optional)
            </label>
            <textarea
              id="report-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Tell us more about why you are reporting this post…"
              className="input text-xs"
              maxLength={400}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="btn bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold px-4 py-2 rounded-xl"
            >
              {busy ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
