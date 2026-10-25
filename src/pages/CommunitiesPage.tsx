import { useMemo, useState } from 'react'
import { Search, Users } from 'lucide-react'
import { CommunityCard } from '../components/communities/CommunityCard'
import { CategoryChip } from '../components/ui/CategoryChip'
import { DemoNote } from '../components/ui/DemoNote'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { useAsync } from '../hooks/useAsync'
import { getCommunities } from '../services'
import { CATEGORIES, type Category } from '../types'

export default function CommunitiesPage() {
  const { data, loading, error, reload } = useAsync(getCommunities, [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [onlyFollowing, setOnlyFollowing] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter(
      (c) =>
        (category === 'all' || c.category === category) &&
        (!onlyFollowing || c.isFollowing) &&
        (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)),
    )
  }, [data, query, category, onlyFollowing])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader title="Communities" subtitle="Follow groups to see their events first." />
      <DemoNote>All communities are fictional. Follows are saved only in this browser (temporary demo behavior).</DemoNote>

      <div className="mt-6 flex flex-col gap-4">
        <div className="relative max-w-xl">
          <label htmlFor="community-search" className="sr-only">Search communities</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand" aria-hidden />
          <input
            id="community-search"
            type="search"
            className="input h-12 pl-11"
            placeholder="Search communities…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <CategoryChip category="all" selected={category === 'all'} onClick={() => setCategory('all')} />
          {CATEGORIES.map((c) => (
            <CategoryChip key={c} category={c} selected={category === c} onClick={() => setCategory(category === c ? 'all' : c)} />
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#334155] accent-brand"
              checked={onlyFollowing}
              onChange={(e) => setOnlyFollowing(e.target.checked)}
            />
            Following only
          </label>
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-muted" aria-live="polite">
        {!loading && data ? `${filtered.length} ${filtered.length === 1 ? 'community' : 'communities'}` : ''}
      </p>

      <div className="mt-3">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No communities found"
            description="Try another search or category."
            actionLabel="Reset filters"
            onAction={() => {
              setQuery('')
              setCategory('all')
              setOnlyFollowing(false)
            }}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
