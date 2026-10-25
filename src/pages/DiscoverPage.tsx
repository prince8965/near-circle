import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarSearch, ChevronLeft, ChevronRight, Flame, Navigation, PlusCircle, SlidersHorizontal } from 'lucide-react'
import { EventCard } from '../components/events/EventCard'
import { FilterPanel } from '../components/events/FilterPanel'
import { LocationSelector } from '../components/events/LocationSelector'
import { SearchBar } from '../components/events/SearchBar'
import { CategoryChip } from '../components/ui/CategoryChip'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { EventGridSkeleton } from '../components/ui/Skeleton'
import { DemoNote } from '../components/ui/DemoNote'
import { useApp } from '../hooks/AppContext'
import { useAsync } from '../hooks/useAsync'
import { defaultFilters, searchEvents, searchHackathons, isSupabaseConfigured } from '../services'
import { CATEGORIES, type Category, type EventFilters } from '../types'
import { getLocality } from '../data/localities'

type FilterState = Omit<EventFilters, 'localityId' | 'interests'>

const INITIAL: FilterState = {
  query: '',
  category: 'all',
  date: 'any',
  customDate: undefined,
  price: 'all',
  radiusKm: 0,
  sort: 'recommended',
  mode: 'all',
  technology: undefined,
  hasPrizes: false,
  teamSize: 'all',
  openRegistrationOnly: false,
  page: 1,
  pageSize: 9,
}

export default function DiscoverPage() {
  const { localityId, interests, toggleInterest } = useApp()
  const [state, setState] = useState<FilterState>(INITIAL)
  const [showFilters, setShowFilters] = useState(false)
  const resultsRef = useRef<HTMLElement>(null)

  const filters: EventFilters = useMemo(() => ({ ...state, localityId, interests }), [state, localityId, interests])
  const baseFilters: EventFilters = useMemo(
    () => ({ ...defaultFilters, localityId, interests }),
    [localityId, interests],
  )

  // Unfiltered list drives Featured and Nearby sections; searchHackathons drives the paginated results grid
  const base = useAsync(() => searchEvents(baseFilters), [baseFilters])
  const results = useAsync(() => searchHackathons(filters), [filters])

  const featured = useMemo(() => (base.data ?? []).slice(0, 3), [base.data])
  const nearby = useMemo(
    () =>
      [...(base.data ?? [])]
        .filter((e) => (e.distanceKm ?? Infinity) <= 6)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
        .slice(0, 3),
    [base.data],
  )

  const activeCount =
    (state.query.trim() ? 1 : 0) +
    (state.category !== 'all' ? 1 : 0) +
    (state.date !== 'any' ? 1 : 0) +
    (state.price !== 'all' ? 1 : 0) +
    (state.radiusKm > 0 ? 1 : 0) +
    (state.mode && state.mode !== 'all' ? 1 : 0) +
    (state.technology ? 1 : 0) +
    (state.hasPrizes ? 1 : 0) +
    (state.teamSize && state.teamSize !== 'all' ? 1 : 0) +
    (state.openRegistrationOnly ? 1 : 0)

  const patch = (p: Partial<EventFilters>) => setState((s) => ({ ...s, ...p }))
  const clear = () => setState(INITIAL)
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const pickCategory = (c: Category | 'all') => {
    patch({ category: state.category === c ? 'all' : c, page: 1 })
    scrollToResults()
  }

  const setPage = (pageNumber: number) => {
    patch({ page: pageNumber })
    scrollToResults()
  }

  const locality = getLocality(localityId)

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#1E293B] bg-gradient-to-b from-[#111827] via-[#0D1424] to-[#0B0F19]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-brand-purple/15 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand shadow-cyber">
              <Navigation className="h-3.5 w-3.5 text-brand" aria-hidden /> Find your people, nearby
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
              Discover <span className="bg-gradient-to-r from-brand via-[#38BDF8] to-brand-purple bg-clip-text text-transparent">amazing events</span> around you.
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-muted sm:text-lg">
              Workshops, meetups, hackathons and gigs happening near campus. Pick your interests, RSVP in a tap, and
              follow the communities you love.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn-primary px-5 py-3" onClick={scrollToResults}>
                Explore events <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <Link to="/organizer/create" className="btn-secondary px-5 py-3">
                <PlusCircle className="h-4 w-4" aria-hidden /> Host an event
              </Link>
            </div>
          </div>

          <div className="glass mt-8 rounded-2xl p-3 shadow-lift sm:p-4 border border-[#1E293B]">
            <div className="grid gap-3 md:grid-cols-[1fr_320px]">
              <SearchBar value={state.query} onChange={(query) => patch({ query })} />
              <LocationSelector className="h-12 [&_select]:h-12" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Browse by category">
            {CATEGORIES.map((c) => (
              <CategoryChip key={c} category={c} selected={state.category === c} onClick={() => pickCategory(c)} />
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 sm:px-6 lg:px-8">
        {!isSupabaseConfigured() && (
          <DemoNote>
            All events, venues and organizers on NearCircle are fictional demo content. Distances are approximate and
            measured from the centre of {locality.name}.
          </DemoNote>
        )}

        {/* Featured */}
        <section aria-labelledby="featured-title">
          <div className="mb-5 flex items-center gap-2">
            <Flame className="h-5 w-5 text-brand" aria-hidden />
            <h2 id="featured-title" className="text-xl font-bold text-white">Featured for you</h2>
          </div>
          {base.loading ? (
            <EventGridSkeleton count={3} />
          ) : base.error ? (
            <ErrorState message={base.error} onRetry={base.reload} />
          ) : featured.length === 0 ? (
            <EmptyState icon={CalendarSearch} title="No upcoming events yet" description="Check back soon or host the first one." actionLabel="Create an event" actionTo="/organizer/create" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        {/* Nearby */}
        {!base.loading && !base.error && nearby.length > 0 && (
          <section aria-labelledby="nearby-title">
            <div className="mb-5 flex items-center gap-2">
              <Navigation className="h-5 w-5 text-brand" aria-hidden />
              <h2 id="nearby-title" className="text-xl font-bold text-white">Happening near {locality.name}</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        )}

        {/* All events + filters */}
        <section ref={resultsRef} id="events" aria-labelledby="all-title" className="scroll-mt-24">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="all-title" className="text-xl font-bold text-white">All upcoming events</h2>
              <p className="text-sm text-ink-muted" aria-live="polite">
                {results.loading
                  ? 'Searching events…'
                  : results.data
                    ? `${results.data.totalCount} ${results.data.totalCount === 1 ? 'event' : 'events'} found`
                    : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary lg:hidden"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((s) => !s)}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className={showFilters ? 'block' : 'hidden lg:block'}>
              <div className="lg:sticky lg:top-24">
                <FilterPanel
                  filters={filters}
                  onChange={patch}
                  onClear={clear}
                  onToggleInterest={toggleInterest}
                  activeCount={activeCount}
                />
              </div>
            </div>

            <div>
              {results.loading ? (
                <EventGridSkeleton count={6} />
              ) : results.error ? (
                <ErrorState message={results.error} onRetry={results.reload} />
              ) : results.data && results.data.events.length === 0 ? (
                <EmptyState
                  icon={CalendarSearch}
                  title="No events match your filters"
                  description="Try a wider distance, a different date, or clear your filters to see everything."
                  actionLabel="Clear all filters"
                  onAction={clear}
                />
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {results.data?.events.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {results.data && results.data.totalPages > 1 && (() => {
                    const pagination = results.data
                    return (
                      <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#1E293B] pt-6 sm:flex-row">
                        <p className="text-xs text-ink-muted">
                          Showing{' '}
                          <strong className="text-white">
                            {(pagination.page - 1) * pagination.pageSize + 1}
                          </strong>{' '}
                          to{' '}
                          <strong className="text-white">
                            {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}
                          </strong>{' '}
                          of <strong className="text-white">{pagination.totalCount}</strong> events
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={pagination.page <= 1}
                            onClick={() => setPage(pagination.page - 1)}
                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-4 w-4" /> Previous
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setPage(p)}
                                className={`h-8 w-8 rounded-lg text-xs font-semibold transition ${
                                  pagination.page === p
                                    ? 'bg-brand text-[#0B0F19] shadow-cyber'
                                    : 'bg-[#0F172A] border border-[#334155] text-ink-muted hover:text-white'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => setPage(pagination.page + 1)}
                            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
