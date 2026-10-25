import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, CalendarX2, CheckCircle2, Clock, ExternalLink, MapPin, MessageSquare, Navigation, Ticket, Users } from 'lucide-react'
import { EventCard } from '../components/events/EventCard'
import { EventPoster } from '../components/events/EventPoster'
import { RSVPButton } from '../components/events/RSVPButton'
import { RegistrationModal } from '../components/events/RegistrationModal'
import { TeamSection } from '../components/teams/TeamSection'
import { EventSubmissionsTab } from '../components/events/EventSubmissionsTab'
import { MapView } from '../components/maps/MapView'
import { CategoryChip } from '../components/ui/CategoryChip'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { getLocality } from '../data/localities'
import { SEED_COMMUNITIES } from '../data/communities'
import { useApp } from '../hooks/AppContext'
import { useAsync } from '../hooks/useAsync'
import {
  getEventById,
  searchEvents,
  defaultFilters,
  getOrganizationById,
  getOrganizationByOwnerId,
  getOrganizationCompletedEventsCount,
  getRegistrationForEvent,
} from '../services'
import { formatDistance, formatLongDate, formatPrice, formatTimeRange } from '../utils/format'

export default function EventDetailsPage() {
  const { id = '' } = useParams()
  const { localityId, interests } = useApp()
  const { data: event, loading, error, reload } = useAsync(() => getEventById(id, localityId, interests), [id, localityId, interests])
  const registration = useAsync(() => getRegistrationForEvent(id), [id])
  const [regModalOpen, setRegModalOpen] = useState(false)
  const related = useAsync(
    () => searchEvents({ ...defaultFilters, localityId, interests }),
    [localityId, interests],
  )

  const orgResult = useAsync(async () => {
    if (!event) return null
    if (event.organizationId) {
      const org = await getOrganizationById(event.organizationId)
      if (org) return org
    }
    if (event.ownerId) {
      const org = await getOrganizationByOwnerId(event.ownerId)
      if (org) return org
    }
    return null
  }, [event?.organizationId, event?.ownerId])

  const completedCountResult = useAsync(async () => {
    if (!orgResult.data?.id) return 0
    return await getOrganizationCompletedEventsCount(orgResult.data.id)
  }, [orgResult.data?.id])

  if (loading)
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8" role="status" aria-label="Loading event">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="aspect-[16/7] w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={error} onRetry={reload} />
      </div>
    )

  if (!event)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState icon={CalendarX2} title="Event not found" description="This event may have been removed or the link is incorrect." actionLabel="Back to Discover" actionTo="/" />
      </div>
    )

  const community = SEED_COMMUNITIES.find((c) => c.id === event.communityId)
  const locality = getLocality(event.localityId)
  const distance = formatDistance(event.distanceKm)
  const relatedEvents = (related.data ?? [])
    .filter((e) => e.id !== event.id && (e.category === event.category || (event.communityId && e.communityId === event.communityId)))
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="h-4 w-4 text-brand" aria-hidden /> Back to Discover
      </Link>

      {event.status !== 'published' && (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-300">
          {event.status === 'draft' ? 'This is a draft preview. It is not visible on Discover yet.' : 'This event has been cancelled by the organizer.'}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-secondary shadow-card border border-[#334155]/60">
        <EventPoster event={event} className="aspect-[16/8] max-h-[420px] w-full" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <header>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <CategoryChip category={event.category} size="sm" />
              {event.mode && (
                <span className="rounded-full bg-brand/10 border border-brand/30 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand">
                  {event.mode}
                </span>
              )}
              {event.isDemo && <span className="rounded-full bg-[#0F172A] border border-[#334155] px-2.5 py-1 text-xs font-medium text-ink-muted">Demo event</span>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">{event.title}</h1>
            <p className="mt-2 text-ink-muted">Organized by {event.organizerName}</p>
          </header>

          <section aria-labelledby="about" className="card space-y-3 p-5 sm:p-6">
            <h2 id="about" className="text-lg font-semibold text-white">About this event</h2>
            <p className="whitespace-pre-line leading-relaxed text-ink-muted">{event.description}</p>
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {event.tags.map((t) => (
                  <span key={t} className="rounded-full bg-[#0F172A] border border-[#334155] px-2.5 py-1 text-xs text-ink-muted">#{t}</span>
                ))}
              </div>
            )}
          </section>

          {(event.minTeamSize || event.maxTeamSize || event.registrationDeadline || event.submissionDeadline || event.prizesSummary || event.rules) && (
            <section aria-labelledby="hackathon-details" className="card space-y-4 p-5 sm:p-6">
              <h2 id="hackathon-details" className="text-lg font-semibold text-white">Hackathon &amp; Participation Details</h2>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                {(event.minTeamSize || event.maxTeamSize) && (
                  <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                    <p className="text-xs uppercase font-medium text-ink-faint">Team Size</p>
                    <p className="font-semibold text-white mt-1">
                      {event.minTeamSize === event.maxTeamSize
                        ? `${event.minTeamSize || 1} Member`
                        : `${event.minTeamSize || 1} - ${event.maxTeamSize || 4} Members`}
                    </p>
                  </div>
                )}
                {event.registrationDeadline && (
                  <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                    <p className="text-xs uppercase font-medium text-ink-faint">Registration Closes</p>
                    <p className="font-semibold text-white mt-1">{formatLongDate(event.registrationDeadline)}</p>
                  </div>
                )}
                {event.submissionDeadline && (
                  <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                    <p className="text-xs uppercase font-medium text-ink-faint">Submissions Deadline</p>
                    <p className="font-semibold text-white mt-1">{formatLongDate(event.submissionDeadline)}</p>
                  </div>
                )}
                {event.eligibility && (
                  <div className="rounded-xl bg-[#0F172A] border border-[#334155] p-3.5">
                    <p className="text-xs uppercase font-medium text-ink-faint">Eligibility</p>
                    <p className="font-semibold text-white mt-1">{event.eligibility}</p>
                  </div>
                )}
              </div>

              {event.prizesSummary && (
                <div className="space-y-1.5 pt-2">
                  <h3 className="text-sm font-semibold text-brand">Prizes &amp; Rewards</h3>
                  <p className="whitespace-pre-line text-sm text-ink-muted leading-relaxed">{event.prizesSummary}</p>
                </div>
              )}

              {event.rules && (
                <div className="space-y-1.5 pt-2">
                  <h3 className="text-sm font-semibold text-brand">Rules &amp; Guidelines</h3>
                  <p className="whitespace-pre-line text-sm text-ink-muted leading-relaxed">{event.rules}</p>
                </div>
              )}
            </section>
          )}

          <section aria-labelledby="when-where" className="card p-5 sm:p-6">
            <h2 id="when-where" className="mb-4 text-lg font-semibold text-white">When &amp; where</h2>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Date</dt>
                  <dd className="text-sm font-medium text-white">{formatLongDate(event.startsAt)}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Time</dt>
                  <dd className="text-sm font-medium text-white">{formatTimeRange(event.startsAt, event.endsAt)}</dd>
                  {new Date(event.startsAt).toDateString() !== new Date(event.endsAt).toDateString() && (
                    <dd className="text-xs text-ink-muted">Ends {formatLongDate(event.endsAt)}</dd>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Venue</dt>
                  <dd className="text-sm font-medium text-white">{event.venueName}</dd>
                  <dd className="text-sm text-ink-muted">{event.address}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Navigation className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">Distance</dt>
                  <dd className="text-sm font-medium text-white">{distance ?? 'Not available'}</dd>
                  <dd className="text-xs text-ink-muted">From {getLocality(localityId).name} · event area: {locality.name}</dd>
                </div>
              </div>
            </dl>
            <div className="mt-5">
              <MapView lat={event.lat} lng={event.lng} title={event.venueName} address={`${event.venueName}, ${event.address}`} />
            </div>
          </section>

          {/* Phase 7: Team Formation & Management Section */}
          <TeamSection
            event={event}
            isRegistered={!!registration.data || event.isRsvped}
            onUpdate={() => {
              void reload()
              void registration.reload()
            }}
          />

          {/* Phase 8 & 9: Project Submissions & Hackathon Results */}
          <EventSubmissionsTab
            event={event}
            isRegistered={!!registration.data || event.isRsvped}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Tickets and organizer">
          <div className="card space-y-4 p-5 sm:p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Ticket</p>
                <p className="text-3xl font-bold text-white">{formatPrice(event.price)}</p>
              </div>
              <Ticket className="h-8 w-8 text-brand" aria-hidden />
            </div>

            {/* Confirmed Registration Pass */}
            {(registration.data || event.isRsvped) && (
              <div className="rounded-xl border border-dashed border-[#00F2FE]/40 bg-[#0F172A] p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-ink-faint">Your Digital Pass</span>
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-sm text-white font-bold">
                  <Ticket className="h-4 w-4 text-brand" />
                  <span>{registration.data?.ticketCode ?? 'NC-CONFIRMED'}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Users className="h-4 w-4 text-brand" aria-hidden />
              {event.seatsLeft > 0 ? (
                <span>
                  <strong className="text-white">{event.seatsLeft}</strong> of {event.capacity} seats left
                </span>
              ) : (
                <span className="font-semibold text-amber-400">This event is full</span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#0F172A] border border-[#334155]" aria-hidden>
              <div className="h-full rounded-full bg-brand shadow-[0_0_10px_rgba(0,242,254,0.5)]" style={{ width: `${Math.min(100, (event.rsvpCount / event.capacity) * 100)}%` }} />
            </div>
            <RSVPButton event={event} size="lg" className="w-full" />
            {!event.isRsvped && !registration.data && event.seatsLeft > 0 && (
              <button
                type="button"
                onClick={() => setRegModalOpen(true)}
                className="btn-secondary w-full text-xs py-2"
              >
                Detailed Registration Form
              </button>
            )}
            <Link
              to={`/community?shareEventId=${event.id}`}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-xs"
            >
              <MessageSquare className="h-4 w-4 text-brand" aria-hidden />
              Share to Community Feed
            </Link>
            {event.registrationUrl && (
              <a href={event.registrationUrl} target="_blank" rel="noreferrer noopener" className="btn-secondary w-full">
                Organizer’s registration page <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            )}
            <RegistrationModal
              open={regModalOpen}
              event={event}
              onClose={() => setRegModalOpen(false)}
              onSuccess={() => {
                void reload()
                void registration.reload()
                setRegModalOpen(false)
              }}
            />
          </div>

          <div className="card p-5 sm:p-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Organizer</h2>
            {orgResult.data ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-[#0B0F19] shadow-card"
                    style={{ backgroundColor: orgResult.data.accentColor || '#00F2FE' }}
                  >
                    <CategoryIcon category={orgResult.data.category} className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-white truncate">{orgResult.data.name}</p>
                      {orgResult.data.isVerified && (
                        <span title="Verified Campus Organization" className="inline-flex items-center">
                          <CheckCircle2 className="h-4 w-4 fill-brand text-[#0B0F19]" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {orgResult.data.followerCount} followers · {completedCountResult.data ?? 0} conducted events
                    </p>
                  </div>
                </div>

                <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                  {orgResult.data.description}
                </p>

                <Link
                  to={`/organizations/${orgResult.data.id}`}
                  className="btn-secondary w-full text-center text-xs flex items-center justify-center gap-1.5 font-semibold py-2"
                >
                  Inspect Organization Profile <ArrowRight className="h-3.5 w-3.5 text-brand" />
                </Link>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-white">{event.organizerName}</p>
                {community ? (
                  <Link to={`/communities/${community.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                    View the {community.name} community →
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">Independent organizer</p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {relatedEvents.length > 0 && (
        <section className="mt-14" aria-labelledby="related">
          <h2 id="related" className="mb-5 text-xl font-bold text-white">Related events</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relatedEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
