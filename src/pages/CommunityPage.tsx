import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Building2,
  Filter,
  MessageSquare,
  PlusCircle,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { CommunityPostCard } from '../components/community/CommunityPostCard'
import { CommunityTabs } from '../components/community/CommunityTabs'
import { CreatePostModal } from '../components/community/CreatePostModal'
import { OrganizationCard } from '../components/community/OrganizationCard'
import { OrganizationProfileModal } from '../components/community/OrganizationProfileModal'
import { LocationSelector } from '../components/events/LocationSelector'
import { CategoryChip } from '../components/ui/CategoryChip'
import { DemoNote } from '../components/ui/DemoNote'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { getLocality } from '../data/localities'
import { useApp } from '../hooks/AppContext'
import { useAsync } from '../hooks/useAsync'
import {
  getCommunityPosts,
  getCurrentUserId,
  getOrganizations,
  subscribeChange,
} from '../services'
import {
  CATEGORIES,
  type Category,
  type CommunityTab,
  type Organization,
  type PostSortKey,
} from '../types'

export default function CommunityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { localityId, interests } = useApp()

  // Query parameter handling: ?tab=..., ?postId=..., ?shareEventId=..., ?org=...
  const initialTab = (searchParams.get('tab') as CommunityTab) || 'for-you'
  const targetPostId = searchParams.get('postId')
  const shareEventId = searchParams.get('shareEventId')
  const targetOrgId = searchParams.get('org')

  const [activeTab, setActiveTab] = useState<CommunityTab>(initialTab)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [sort, setSort] = useState<PostSortKey>('newest')

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(Boolean(shareEventId))
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)

  const currentUserId = getCurrentUserId()

  // Feed loader
  const {
    data: posts,
    loading: postsLoading,
    error: postsError,
    reload: reloadPosts,
  } = useAsync(
    () =>
      getCommunityPosts({
        tab: activeTab,
        category,
        query,
        sort,
        localityId,
        interests,
      }),
    [activeTab, category, query, sort, localityId, interests],
  )

  // Organizations loader (for Organizations tab & lookup)
  const {
    data: organizations,
    loading: orgsLoading,
    error: orgsError,
    reload: reloadOrgs,
  } = useAsync(getOrganizations, [])

  // Auto-subscribe to changes on the bus so any likes/follows/new posts re-render automatically
  useEffect(() => {
    const unsub = subscribeChange(() => {
      reloadPosts()
      reloadOrgs()
    })
    return unsub
  }, [reloadPosts, reloadOrgs])

  // Open target organization modal if specified in query param
  useEffect(() => {
    if (targetOrgId && organizations && organizations.length > 0) {
      const match = organizations.find((o) => o.id === targetOrgId)
      if (match) setSelectedOrg(match)
    }
  }, [targetOrgId, organizations])

  // Keep selectedOrg in sync when organizations list updates
  useEffect(() => {
    if (selectedOrg && organizations) {
      const match = organizations.find((o) => o.id === selectedOrg.id)
      if (match && (match.isFollowing !== selectedOrg.isFollowing || match.followerCount !== selectedOrg.followerCount)) {
        setSelectedOrg(match)
      }
    }
  }, [organizations, selectedOrg])

  // If shareEventId was passed in, auto-open the create post modal
  useEffect(() => {
    if (shareEventId) {
      setIsCreateModalOpen(true)
    }
  }, [shareEventId])

  // Scroll to targeted post if ?postId=... is present
  useEffect(() => {
    if (targetPostId && posts && posts.length > 0) {
      const element = document.getElementById(`post-${targetPostId}`)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
      }
    }
  }, [targetPostId, posts])

  const myPostsCount = useMemo(() => {
    return (posts ?? []).filter((p) => p.authorId === currentUserId).length
  }, [posts, currentUserId])

  const handleTabChange = (tab: CommunityTab) => {
    setActiveTab(tab)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams, { replace: true })
  }

  const handleOpenOrgProfile = (orgId: string) => {
    const match = (organizations ?? []).find((o) => o.id === orgId)
    if (match) setSelectedOrg(match)
  }

  // Filter organizations when in the Organizations tab
  const filteredOrganizations = useMemo(() => {
    if (!organizations) return []
    const q = query.trim().toLowerCase()
    return organizations.filter(
      (o) =>
        (category === 'all' || o.category === category) &&
        (!q ||
          o.name.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.category.toLowerCase().includes(q)),
    )
  }, [organizations, query, category])

  const currentLocality = getLocality(localityId)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header with Prominent Create Post Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Community Hub"
          subtitle="Connect with students, event organizers, and campus clubs near you."
        />

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold shadow-cyber hover:shadow-neon sm:w-auto"
            aria-label="Create a new community post"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Post</span>
          </button>
        </div>
      </div>

      <DemoNote>
        Interactive NearCircle Community prototype. Posts, likes, comments, and organization follows persist in your browser.
      </DemoNote>

      {/* Tabs navigation */}
      <div className="mt-6">
        <CommunityTabs
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          myPostsCount={myPostsCount}
          localityName={currentLocality.name}
        />
      </div>

      {/* Search, Category filters, and Sort bar */}
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-xl">
            <label htmlFor="community-search-input" className="sr-only">
              Search community
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
              aria-hidden
            />
            <input
              id="community-search-input"
              type="search"
              className="input h-11 pl-10 text-sm"
              placeholder={
                activeTab === 'organizations'
                  ? 'Search campus organizations, student clubs, or categories…'
                  : 'Search posts, student discussions, creators, or topics…'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Sort Dropdown & Locality selector */}
          <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
            {activeTab === 'nearby' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-muted">Area:</span>
                <LocationSelector />
              </div>
            )}

            {activeTab !== 'organizations' && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-ink-faint" />
                <label htmlFor="community-sort" className="sr-only">
                  Sort posts
                </label>
                <select
                  id="community-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as PostSortKey)}
                  className="input h-11 py-1 text-xs font-semibold"
                >
                  <option value="newest" className="bg-secondary text-white">
                    Newest First
                  </option>
                  <option value="popular" className="bg-secondary text-white">
                    Most Popular (Likes &amp; Comments)
                  </option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter community by category"
        >
          <CategoryChip
            category="all"
            selected={category === 'all'}
            onClick={() => setCategory('all')}
          />
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat}
              category={cat}
              selected={category === cat}
              onClick={() => setCategory(category === cat ? 'all' : cat)}
            />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-8">
        {/* Organizations Tab View */}
        {activeTab === 'organizations' ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand" />
                <span>Campus Organizations &amp; Clubs</span>
              </h2>
              <span className="text-xs text-ink-muted">
                {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
              </span>
            </div>

            {orgsLoading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : orgsError ? (
              <ErrorState message={orgsError} onRetry={reloadOrgs} />
            ) : filteredOrganizations.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No organizations found"
                description="Try another search query or category filter."
                actionLabel="Reset filters"
                onAction={() => {
                  setQuery('')
                  setCategory('all')
                }}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredOrganizations.map((org) => (
                  <OrganizationCard
                    key={org.id}
                    organization={org}
                    onSelect={(o) => setSelectedOrg(o)}
                    onFollowToggled={() => {
                      reloadOrgs()
                      reloadPosts()
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Feed Posts View (For You, Following, Nearby, My Posts) */
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            {/* Feed Column */}
            <div className="space-y-6">
              {/* Active Tab Notice Banner */}
              {activeTab === 'following' && (
                <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs leading-relaxed text-ink-muted flex items-start gap-3">
                  <Users className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Following Feed:</strong> Showing updates from organizations, clubs, and creators you follow. Follow more clubs in the Organizations tab!
                  </div>
                </div>
              )}

              {activeTab === 'nearby' && (
                <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-xs leading-relaxed text-ink-muted flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Nearby Feed for {currentLocality.name}:</strong> Showing student questions, event announcements, and meetups in your selected locality.
                  </div>
                </div>
              )}

              {/* Feed List */}
              {postsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full" />
                  ))}
                </div>
              ) : postsError ? (
                <ErrorState message={postsError} onRetry={reloadPosts} />
              ) : !posts || posts.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={
                    activeTab === 'my-posts'
                      ? 'You haven’t posted yet'
                      : activeTab === 'following'
                      ? 'No posts from followed clubs'
                      : activeTab === 'nearby'
                      ? `No posts found in ${currentLocality.name}`
                      : 'No community posts found'
                  }
                  description={
                    activeTab === 'my-posts'
                      ? 'Share your thoughts, ask a question, or announce an event to get started.'
                      : activeTab === 'following'
                      ? 'Follow campus organizations and communities to see their latest posts here.'
                      : 'Try broadening your search or change the category filter.'
                  }
                  actionLabel={
                    activeTab === 'my-posts'
                      ? 'Create First Post'
                      : activeTab === 'following'
                      ? 'Explore Organizations'
                      : 'Reset Filters'
                  }
                  onAction={() => {
                    if (activeTab === 'my-posts') {
                      setIsCreateModalOpen(true)
                    } else if (activeTab === 'following') {
                      handleTabChange('organizations')
                    } else {
                      setQuery('')
                      setCategory('all')
                    }
                  }}
                />
              ) : (
                <div className="space-y-6">
                  {posts.map((post) => (
                    <CommunityPostCard
                      key={post.id}
                      post={post}
                      onPostUpdated={() => {
                        reloadPosts()
                        reloadOrgs()
                      }}
                      onOpenOrgProfile={handleOpenOrgProfile}
                      isHighlighted={post.id === targetPostId}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Column: Suggested Clubs, Quick Actions, Community Guidelines */}
            <aside className="space-y-6 hidden lg:block" aria-label="Community Sidebar">
              {/* Quick Create Prompt Card */}
              <div className="card p-5 space-y-3 bg-gradient-to-br from-secondary to-[#0F172A] border-brand/30">
                <div className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-brand" />
                  <h3 className="font-bold text-sm">Got something to share?</h3>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Post project questions, announce upcoming club events, or find hackathon teammates across campus.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="btn-primary w-full text-xs font-bold py-2 shadow-cyber"
                >
                  Create Community Post
                </button>
              </div>

              {/* Verified Campus Organizations Widget */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                    Featured Campus Clubs
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange('organizations')}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    View All →
                  </button>
                </div>

                <div className="space-y-3">
                  {(organizations ?? []).slice(0, 4).map((org) => (
                    <div
                      key={org.id}
                      onClick={() => setSelectedOrg(org)}
                      className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2 transition hover:bg-[#0F172A]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#0B0F19] text-xs font-bold shadow-sm"
                          style={{ backgroundColor: org.accentColor }}
                        >
                          {org.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white group-hover:text-brand">
                            {org.name}
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {org.followerCount.toLocaleString('en-IN')} followers
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-brand opacity-0 group-hover:opacity-100 transition">
                        View
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guidelines Card */}
              <div className="card p-5 space-y-2 border-[#334155]/60 text-xs text-ink-muted">
                <h3 className="font-semibold text-white">Campus Community Guidelines</h3>
                <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed">
                  <li>Be respectful and welcoming to all students.</li>
                  <li>No spam, academic dishonesty, or hate speech.</li>
                  <li>Keep event dates and locations accurate.</li>
                  <li>Report any suspicious or harmful content.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          // Clear shareEventId query param if set
          if (shareEventId) {
            const nextParams = new URLSearchParams(searchParams)
            nextParams.delete('shareEventId')
            setSearchParams(nextParams, { replace: true })
          }
        }}
        onCreated={() => {
          reloadPosts()
          reloadOrgs()
        }}
        initialEventId={shareEventId ?? undefined}
      />

      {/* Organization Profile Modal */}
      <OrganizationProfileModal
        organization={selectedOrg}
        posts={posts ?? []}
        onClose={() => setSelectedOrg(null)}
        onFollowToggled={() => {
          reloadOrgs()
          reloadPosts()
        }}
        onPostUpdated={() => {
          reloadPosts()
          reloadOrgs()
        }}
      />
    </div>
  )
}
