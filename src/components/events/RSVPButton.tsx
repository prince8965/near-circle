import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { useToast } from '../../hooks/ToastContext'
import { useAuth } from '../../hooks/AuthContext'
import { cancelRSVP, createRSVP } from '../../services'
import type { EventWithMeta } from '../../types'
import { formatPrice } from '../../utils/format'
import { ConfirmationModal } from '../ui/ConfirmationModal'

interface Props {
  event: EventWithMeta
  size?: 'sm' | 'lg'
  className?: string
}

export function RSVPButton({ event, size = 'sm', className = '' }: Props) {
  const { notify } = useToast()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<'rsvp' | 'cancel' | null>(null)
  const sizing = size === 'lg' ? 'px-6 py-3 text-base' : 'px-3.5 py-2'
  const ended = new Date(event.endsAt).getTime() < Date.now()

  const requireAuth = (): boolean => {
    if (!isAuthenticated) {
      notify('Please sign in to RSVP for events.', 'info')
      navigate('/auth')
      return false
    }
    return true
  }

  const run = async (action: 'rsvp' | 'cancel') => {
    setBusy(true)
    try {
      if (action === 'rsvp') {
        await createRSVP(event.id)
        notify(`You’re in! RSVP saved for “${event.title}”.`)
      } else {
        await cancelRSVP(event.id)
        notify('Your RSVP was cancelled.', 'info')
      }
      setModal(null)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Something went wrong.', 'error')
      setModal(null)
    } finally {
      setBusy(false)
    }
  }

  if (event.status === 'draft')
    return (
      <button type="button" disabled className={`btn-secondary ${sizing} ${className}`}>
        Not published yet
      </button>
    )
  if (event.status === 'cancelled')
    return (
      <button type="button" disabled className={`btn-secondary ${sizing} ${className}`}>
        Event cancelled
      </button>
    )
  if (ended && !event.isRsvped)
    return (
      <button type="button" disabled className={`btn-secondary ${sizing} ${className}`}>
        Event ended
      </button>
    )

  return (
    <>
      {event.isRsvped ? (
        <button
          type="button"
          disabled={busy || ended}
          onClick={() => setModal('cancel')}
          className={`btn border border-brand/60 bg-brand/15 text-brand hover:bg-brand/25 hover:border-brand ${sizing} ${className}`}
          aria-label={`You are going to ${event.title}. Cancel RSVP`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          {size === 'lg' ? 'Going — Cancel RSVP' : 'Going'}
        </button>
      ) : event.seatsLeft <= 0 ? (
        <button type="button" disabled className={`btn-secondary ${sizing} ${className}`}>
          Event full
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!requireAuth()) return
            if (event.price > 0) setModal('rsvp')
            else void run('rsvp')
          }}
          className={`btn-primary ${sizing} ${className}`}
          aria-label={`RSVP to ${event.title}`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          RSVP{event.price > 0 ? ` · ${formatPrice(event.price)}` : ''}
        </button>
      )}

      <ConfirmationModal
        open={modal === 'rsvp'}
        title="Confirm your RSVP"
        confirmLabel="Confirm RSVP"
        busy={busy}
        onConfirm={() => run('rsvp')}
        onClose={() => setModal(null)}
      >
        <p>
          You’re reserving a spot at <strong className="text-ink">{event.title}</strong> ({formatPrice(event.price)}).
        </p>
        <p className="mt-2 text-xs text-ink-faint">Demo only: no payment is taken and no ticket is issued.</p>
      </ConfirmationModal>

      <ConfirmationModal
        open={modal === 'cancel'}
        title="Cancel your RSVP?"
        confirmLabel="Yes, cancel RSVP"
        cancelLabel="Keep my spot"
        danger
        busy={busy}
        onConfirm={() => run('cancel')}
        onClose={() => setModal(null)}
      >
        <p>
          Your spot at <strong className="text-ink">{event.title}</strong> will be released for others.
        </p>
      </ConfirmationModal>
    </>
  )
}
