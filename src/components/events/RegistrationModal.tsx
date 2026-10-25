import { useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2, MapPin, ShieldAlert, Sparkles, Ticket, X } from 'lucide-react'
import { useAuth } from '../../hooks/AuthContext'
import { useToast } from '../../hooks/ToastContext'
import { registerForEvent } from '../../services'
import type { EventWithMeta } from '../../types'
import { formatDate, formatPrice, formatTimeRange } from '../../utils/format'

interface Props {
  open: boolean
  event: EventWithMeta
  onClose: () => void
  onSuccess: () => void
}

export function RegistrationModal({ open, event, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [dietary, setDietary] = useState('')
  const [agreeRules, setAgreeRules] = useState(true)
  const [confirmedTicket, setConfirmedTicket] = useState<string | null>(null)

  if (!open) return null

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      notify('Please sign in before registering for this event.', 'error')
      return
    }

    if (!agreeRules) {
      notify('Please agree to the event guidelines to continue.', 'error')
      return
    }

    setBusy(true)
    try {
      const reg = await registerForEvent(event.id, {
        githubUrl: githubUrl.trim() || undefined,
        dietary: dietary.trim() || undefined,
      })
      setConfirmedTicket(reg.ticketCode)
      notify(`Registration confirmed for "${event.title}"!`)
      onSuccess()
    } catch (err: any) {
      notify(err.message || 'Registration failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reg-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[#334155] bg-[#0B0F19] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-surface-elevated hover:text-white"
          aria-label="Close registration modal"
        >
          <X className="h-5 w-5" />
        </button>

        {confirmedTicket ? (
          <div className="text-center py-4 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">You're Officially Registered!</h3>
              <p className="mt-1 text-sm text-ink-muted">
                Your spot has been reserved for <strong className="text-white">{event.title}</strong>.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-[#00F2FE]/50 bg-[#0F172A] p-4 text-left space-y-2 shadow-cyber">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-faint">Digital Entry Pass</span>
                <span className="rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Confirmed
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-brand" />
                <p className="font-mono text-lg font-bold text-white">{confirmedTicket}</p>
              </div>
              <p className="text-xs text-ink-muted">
                Participant: <strong className="text-white">{user?.name}</strong> ({user?.email})
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary w-full py-2.5 mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
                <Sparkles className="h-4 w-4" />
                <span>Event Registration</span>
              </div>
              <h2 id="reg-modal-title" className="text-xl font-bold text-white mt-1">
                {event.title}
              </h2>
            </div>

            <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3 text-xs text-ink-muted space-y-1.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand" />
                <span>{formatDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand" />
                <span>{event.venueName}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#334155]">
                <span>Ticket Price:</span>
                <span className="font-semibold text-white">{formatPrice(event.price)}</span>
              </div>
            </div>

            {!user && (
              <div className="flex items-start gap-3 rounded-xl bg-amber-950/30 border border-amber-500/30 p-3 text-xs text-amber-200">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Authentication Required</p>
                  <p className="mt-0.5 text-amber-200/80">Please sign in to register and secure your spot.</p>
                </div>
              </div>
            )}

            {user && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="reg-github" className="block text-xs font-medium text-ink-muted mb-1">
                    GitHub or Portfolio URL (Optional)
                  </label>
                  <input
                    id="reg-github"
                    type="url"
                    placeholder="https://github.com/username"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="reg-dietary" className="block text-xs font-medium text-ink-muted mb-1">
                    Dietary or Accessibility Needs (Optional)
                  </label>
                  <input
                    id="reg-dietary"
                    type="text"
                    placeholder="e.g. Vegetarian, wheelchair access"
                    value={dietary}
                    onChange={(e) => setDietary(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink-muted pt-1">
                  <input
                    type="checkbox"
                    checked={agreeRules}
                    onChange={(e) => setAgreeRules(e.target.checked)}
                    className="mt-0.5 rounded border-[#334155] bg-[#0F172A] text-brand focus:ring-0"
                  />
                  <span>
                    I confirm my eligibility and agree to follow the event code of conduct and organizers’ rules.
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-[#334155]">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !user || !agreeRules}
                className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Registration
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
