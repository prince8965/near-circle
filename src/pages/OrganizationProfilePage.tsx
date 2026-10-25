import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Plus,
  Users,
} from 'lucide-react'
import { CategoryChip } from '../components/ui/CategoryChip'
import { CategoryIcon } from '../components/ui/CategoryIcon'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { EventCard } from '../components/events/EventCard'
import { Skeleton } from '../components/ui/Skeleton'
import { CommunityPostCard } from '../components/community/CommunityPostCard'
import { getLocality } from '../data/localities'
import { useToast } from '../hooks/ToastContext'
import { useAsync } from '../hooks/useAsync'
import {
  authAdapter,
  followOrganization,
  getCommunityPosts,
  getOrganizationById,
  getOrganizationPublicEvents,
  unfollowOrganization,
} from '../services'
import type { CommunityPost, EventWithMeta, Organization } from '../types'

export default function OrganizationProfilePage() {
  const { id = '' } = useParams<{ id: string }>()
  const { notify } = useToast()
  const session = authAdapter.getSession()

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'posts' | 'about'>('upcoming')
  const [busy, setBusy] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  // 1. Fetch Organization public profile
  const orgResult = useAsync(() => getOrganizationById(id), [id])
  const organization: Organization | null = orgResult.data ?? null

  // 2. Fetch Organization public events (Upcoming & Past Concluded)
  const eventsResult = useAsync(
    () => (id ? getOrganizationPublicEvents(id) : Promise.resolve({ upcoming: [], past: [], completedCount: 0 })),
    [id],
  )
  const upcomingEvents: EventWithMeta[] = eventsResult.data?.upcoming ?? []
  const pastEvents: EventWithMeta[] = eventsResult.data?.past ?? []
  const conductedCount: number = eventsResult.data?.completedCount ?? 0

  // 3. Fetch Organization Community Posts
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)

  const reloadPosts = () => {
    if (!id) return
    setPostsLoading(true)
    getCommunityPosts({ organizationId: id })
      .then((res) => setPosts(res))
      .catch((err) => console.warn('Could not load org posts:', err))
      .finally(() => setPostsLoading(false))
  }

  useEffect(() => {
    reloadPosts()
  }, [id])

  useEffect(() => {
    if (organization) {
      setIsFollowing(Boolean(organization.isFollowing))
      setFollowerCount(organization.followerCount)
    }
  }, [organization])

  const handleToggleFollow = async () => {
    if (!organization) return
    if (!session) {
      notify('Please sign in to follow organizations.', 'info')
      return
    }

    setBusy(true)
    const nextState = !isFollowing
    setIsFollowing(nextState)
    setFollowerCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)))

    try {
      if (nextState) {
        await followOrganization(organization.id)
        notify(`Following ${organization.name}!`, 'success')
      } else {
        await unfollowOrganization(organization.id)
        notify(`Unfollowed ${organization.name}.`, 'info')
      }
    } catch {
      setIsFollowing(!nextState)
      setFollowerCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)))
      notify('Failed to update follow status.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (orgResult.loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (orgResult.error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={orgResult.error} onRetry={orgResult.reload} />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState
          icon={Building2}
          title="Organization not found"
          description="The organization profile you are looking for does not exist or may have been removed."
          actionLabel="Back to Discover"
          actionTo="/"
        />
      </div>
    )
  }

  const locality = getLocality(organization.localityId)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top back navigation */}
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="h-4 w-4 text-brand" aria-hidden /> Back to Discover
      </Link>

      {/* Hero profile card */}
      <div className="overflow-hidden rounded-2xl border border-[#334155] bg-[#0B0F19] shadow-2xl">
        {/* Banner with organization accent gradient */}
        <div
          className="relative h-32 w-full border-b border-[#334155]/60 sm:h-44"
          style={{
            background: `linear-gradient(135deg, ${organization.accentColor}33 0%, #0B0F19 100%)`,
          }}
        />

        {/* Profile info bar */}
        <div className="relative border-b border-[#1E293B] bg-secondary/80 px-6 pb-6 pt-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div
                className="-mt-16 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-[#0B0F19] text-[#0B0F19] shadow-lift sm:h-24 sm:w-24"
                style={{ backgroundColor: organization.accentColor }}
                aria-hidden
              >
                <CategoryIcon category={organization.category} className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-white sm:text-3xl">{organization.name}</h1>
                  {organization.isVerified && (
                    <span
                      title="Verified Campus Organization"
                      className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand border border-brand/30 shadow-cyber"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 fill-brand text-[#0B0F19]" />
                      Verified Campus Organization
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-brand" />
                    {locality.name}, {locality.city}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-brand" />
                    {followerCount.toLocaleString('en-IN')} followers
                  </span>
                </div>
              </div>
            </div>

            {/* Follow action button */}
            <div className="flex items-center gap-2 self-start sm:self-end">
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={busy}
                className={`btn text-sm px-4 py-2 rounded-xl font-semibold transition ${
                  isFollowing
                    ? 'bg-[#1E293B] text-ink-muted border border-[#334155] hover:border-rose-500/50 hover:text-rose-400'
                    : 'btn-primary'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Follow Organization</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink-muted">{organization.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
            <CategoryChip category={organization.category} size="sm" />
            {organization.websiteUrl && (
              <a
                href={organization.websiteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 text-brand hover:underline"
              >
                <Globe className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            {organization.contactEmail && (
              <a
                href={`mailto:${organization.contactEmail}`}
                className="flex items-center gap-1 text-ink-muted hover:text-white"
              >
                <Mail className="h-3.5 w-3.5" />
                {organization.contactEmail}
              </a>
            )}
          </div>
        </div>

        {/* Real Stats Cards */}
        <div className="grid grid-cols-3 divide-x divide-[#1E293B] border-b border-[#1E293B] bg-[#0F172A]/80 p-4 text-center">
          <div>
            <p className="text-xl font-bold text-white sm:text-2xl">{conductedCount}</p>
            <p className="text-xs uppercase font-medium text-ink-faint mt-0.5">Conducted Events</p>
          </div>
          <div>
            <p className="text-xl font-bold text-brand sm:text-2xl">{upcomingEvents.length}</p>
            <p className="text-xs uppercase font-medium text-ink-faint mt-0.5">Upcoming Events</p>
          </div>
          <div>
            <p className="text-xl font-bold text-white sm:text-2xl">{followerCount}</p>
            <p className="text-xs uppercase font-medium text-ink-faint mt-0.5">Followers</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#1E293B] bg-[#0B0F19] px-6 pt-3">
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'upcoming'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-white'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Upcoming Events ({upcomingEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'past'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-white'
              }`}
            >
              <CalendarCheck className="h-4 w-4" />
              Past &amp; Concluded Events ({pastEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'posts'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-white'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Community Posts ({posts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'about'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-white'
              }`}
            >
              <Building2 className="h-4 w-4" />
              About Organization
            </button>
          </div>
        </div>

        {/* Tab content area */}
        <div className="p-6">
          {activeTab === 'upcoming' ? (
            eventsResult.loading ? (
              <p className="text-sm text-ink-muted">Loading scheduled events…</p>
            ) : upcomingEvents.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming events"
                description={`${organization.name} doesn't have any scheduled upcoming events right now. Follow them to be notified when new events are published!`}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )
          ) : activeTab === 'past' ? (
            eventsResult.loading ? (
              <p className="text-sm text-ink-muted">Loading past event history…</p>
            ) : pastEvents.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No concluded events yet"
                description={`${organization.name} has not concluded any public events on NearCircle yet.`}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {pastEvents.map((e) => (
                  <div key={e.id} className="relative">
                    <span className="absolute right-3 top-3 z-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                      Concluded
                    </span>
                    <EventCard event={e} />
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'posts' ? (
            postsLoading ? (
              <p className="text-sm text-ink-muted">Loading community posts…</p>
            ) : posts.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No community posts"
                description={`${organization.name} has not published any posts on the community feed.`}
              />
            ) : (
              <div className="space-y-4 max-w-2xl">
                {posts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    onPostUpdated={reloadPosts}
                    onOpenOrgProfile={() => {}}
                  />
                ))}
              </div>
            )
          ) : (
            /* About tab */
            <div className="space-y-6 max-w-3xl">
              <div className="card p-5 space-y-3">
                <h3 className="text-base font-semibold text-white">About {organization.name}</h3>
                <p className="whitespace-pre-line text-sm text-ink-muted leading-relaxed">
                  {organization.description}
                </p>
              </div>

              {(organization.rules || organization.eligibility) && (
                <div className="card p-5 space-y-4">
                  <h3 className="text-base font-semibold text-white">Participation Guidelines</h3>
                  {organization.eligibility && (
                    <div>
                      <h4 className="text-xs uppercase font-semibold text-brand">Eligibility</h4>
                      <p className="text-sm text-ink-muted mt-1">{organization.eligibility}</p>
                    </div>
                  )}
                  {organization.rules && (
                    <div>
                      <h4 className="text-xs uppercase font-semibold text-brand">Rules &amp; Code of Conduct</h4>
                      <p className="whitespace-pre-line text-sm text-ink-muted mt-1">{organization.rules}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="card p-5 space-y-3">
                <h3 className="text-base font-semibold text-white">Organization Details</h3>
                <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-ink-faint">Category</dt>
                    <dd className="font-semibold text-white mt-0.5">{organization.category}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-ink-faint">Campus Locality</dt>
                    <dd className="font-semibold text-white mt-0.5">{locality.name}, {locality.city}</dd>
                  </div>
                  {organization.websiteUrl && (
                    <div>
                      <dt className="text-xs uppercase text-ink-faint">Website</dt>
                      <dd className="mt-0.5">
                        <a
                          href={organization.websiteUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-brand hover:underline"
                        >
                          {organization.websiteUrl}
                        </a>
                      </dd>
                    </div>
                  )}
                  {organization.contactEmail && (
                    <div>
                      <dt className="text-xs uppercase text-ink-faint">Public Contact</dt>
                      <dd className="mt-0.5">
                        <a href={`mailto:${organization.contactEmail}`} className="text-brand hover:underline">
                          {organization.contactEmail}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
