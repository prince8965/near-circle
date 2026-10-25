import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, CalendarDays, Crown, MapPin, QrCode, Users } from 'lucide-react'
import { EventPoster } from '../components/events/EventPoster'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { useApp } from '../hooks/AppContext'
import { useToast } from '../hooks/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { cancelRegistration, getMyRegistrations } from '../services'
import type { EventRegistrationWithEvent } from '../types'
import { formatDate, formatPrice, formatTimeRange } from '../utils/format'

/** Deterministic pattern derived from the ticket code for visual ticket pass experience. */
function QrPlaceholder({ code }: { code: string }) {
  const size = 9
  const cells: boolean[] = []
  let seed = Array.from(code).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    cells.push(seed % 3 !== 0)
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-20 w-20 rounded-lg bg-[#0F172A] p-1.5 ring-1 ring-[#334155]"
      role="img"
      aria-label="QR pass code"
    >
      {cells.map((on, i) =>
        on ? <rect key={i} x={i % size} y={Math.floor(i / size)} width="1" height="1" fill="#00F2FE" /> : null,
      )}
    </svg>
  )
}

function Row({
  entry,
  onCancel,
}: {
  entry: EventRegistrationWithEvent
  onCancel: (e: EventRegistrationWithEvent) => void
}) {
  const { event, registration, isPast, team } = entry
  return (
    <article className="card overflow-hidden sm:flex border border-[#334155]/60">
      <Link to={`/events/${event.id}`} className="block shrink-0 sm:w-48">
        <EventPoster event={event} className="h-36 w-full sm:h-full" />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                registration.status === 'checked_in'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                  : 'bg-brand/15 text-brand border border-brand/30'
              }`}
            >
              {registration.status === 'checked_in' ? 'Checked In' : isPast ? 'Attended' : 'Confirmed'}
            </span>

            {/* Team Association Badge */}
            {team && (
              <span className="flex items-center gap-1.5 rounded-full bg-secondary border border-[#334155] px-2.5 py-0.5 text-xs font-medium text-white">
                {team.isLeader ? <Crown className="h-3 w-3 text-amber-400" /> : <Users className="h-3 w-3 text-brand" />}
                <span>
                  Team: {team.name} ({team.isLeader ? 'Leader' : 'Member'})
                </span>
              </span>
            )}

            {event.status === 'cancelled' && (
              <span className="rounded-full bg-rose-950/40 border border-rose-500/30 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                Event cancelled
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold leading-snug text-white">
            <Link to={`/events/${event.id}`} className="hover:text-brand transition">
              {event.title}
            </Link>
          </h3>

          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            <li className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand" aria-hidden />
              {formatDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand" aria-hidden />
              {event.venueName}
            </li>
          </ul>

          {!isPast && (
            <button
              type="button"
              className="btn-danger mt-3 px-3 py-1.5 text-xs"
              onClick={() => onCancel(entry)}
            >
              Cancel Registration
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#334155] bg-[#0F172A]/70 p-3 sm:flex-col sm:text-center">
          <QrPlaceholder code={registration.ticketCode} />
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-white">
              <QrCode className="h-3.5 w-3.5 text-brand" aria-hidden />
              {registration.ticketCode}
            </p>
            <p className="text-[11px] leading-tight text-ink-faint mt-0.5">
              Digital Entry Pass · {formatPrice(event.price)}
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function MyEventsPage() {
  const { localityId, interests } = useApp()
  const { notify } = useToast()
  const { data, loading, error, reload } = useAsync(
    () => getMyRegistrations(localityId, interests),
    [localityId, interests],
  )
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [target, setTarget] = useState<EventRegistrationWithEvent | null>(null)
  const [busy, setBusy] = useState(false)

  const confirmCancel = async () => {
    if (!target) return
    setBusy(true)
    try {
      await cancelRegistration(target.event.id)
      notify(`Registration for "${target.event.title}" cancelled.`, 'info')
      await reload()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not cancel registration.', 'error')
    } finally {
      setBusy(false)
      setTarget(null)
    }
  }

  const list = data ? data[tab] : []

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="My Events &amp; Registrations"
        subtitle="Manage your confirmed registrations, event passes, and team participation."
      />

      <div
        role="tablist"
        aria-label="My events"
        className="mt-6 inline-flex rounded-xl bg-secondary border border-[#334155] p-1 shadow-card"
      >
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? 'bg-brand text-[#0B0F19] shadow-cyber' : 'text-ink-muted hover:text-white'
            }`}
          >
            {t} {data ? `(${data[t].length})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4" role="tabpanel">
        {loading ? (
          <>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={tab === 'upcoming' ? 'No upcoming registrations yet' : 'No past events'}
            description={
              tab === 'upcoming'
                ? 'Register for a hackathon or event to secure your ticket pass and form a team.'
                : 'Events you attend will appear here after they finish.'
            }
            actionLabel="Discover events"
            actionTo="/"
          />
        ) : (
          list.map((entry) => (
            <Row key={entry.registration.id} entry={entry} onCancel={setTarget} />
          ))
        )}
      </div>

      <ConfirmationModal
        open={target !== null}
        title="Cancel your Registration?"
        confirmLabel="Yes, cancel registration"
        cancelLabel="Keep my spot"
        danger
        busy={busy}
        onConfirm={confirmCancel}
        onClose={() => setTarget(null)}
      >
        <p>
          You’ll release your reserved spot at <strong className="text-white">{target?.event.title}</strong>.
          {target?.team && ' Note: You will also be removed from your current team for this event.'}
        </p>
      </ConfirmationModal>
    </div>
  )
}
