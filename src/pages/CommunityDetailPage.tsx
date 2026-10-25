import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarX2, MapPin, Users } from 'lucide-react'
import { FollowButton } from '../components/communities/FollowButton'
import { EventCard } from '../components/events/EventCard'
import { CategoryChip } from '../components/ui/CategoryChip'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { EventGridSkeleton, Skeleton } from '../components/ui/Skeleton'
import { getLocality } from '../data/localities'
import { useApp } from '../hooks/AppContext'
import { useAsync } from '../hooks/useAsync'
import { defaultFilters, getCommunityById, searchEvents } from '../services'

export default function CommunityDetailPage() {
  const { id = '' } = useParams()
  const { localityId, interests } = useApp()
  const community = useAsync(() => getCommunityById(id), [id])
  const events = useAsync(() => searchEvents({ ...defaultFilters, sort: 'soonest', localityId, interests }), [localityId, interests])

  if (community.loading)
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8" role="status" aria-label="Loading community">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  if (community.error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={community.error} onRetry={community.reload} />
      </div>
    )
  const c = community.data
  if (!c)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState icon={Users} title="Community not found" description="It may have been removed." actionLabel="All communities" actionTo="/communities" />
      </div>
    )

  const upcoming = (events.data ?? []).filter((e) => e.communityId === c.id)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/communities" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="h-4 w-4 text-brand" aria-hidden /> All communities
      </Link>

      <header className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-[#0B0F19] shadow-cyber" style={{ backgroundColor: c.accent }} aria-hidden>
          <CategoryIcon category={c.category} className="h-10 w-10" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{c.name}</h1>
          <p className="mt-1 max-w-2xl text-ink-muted">{c.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <CategoryChip category={c.category} size="sm" />
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-brand" aria-hidden />{c.members.toLocaleString('en-IN')} members</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand" aria-hidden />{getLocality(c.localityId).name}</span>
          </div>
        </div>
        <FollowButton community={c} className="sm:self-start" />
      </header>

      <section className="mt-10" aria-labelledby="community-events">
        <h2 id="community-events" className="mb-5 text-xl font-bold text-white">Upcoming events</h2>
        {events.loading ? (
          <EventGridSkeleton count={3} />
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.reload} />
        ) : upcoming.length === 0 ? (
          <EmptyState icon={CalendarX2} title="No upcoming events" description="This community hasn’t scheduled anything yet. Follow it to be first to know." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
