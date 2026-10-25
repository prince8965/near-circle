import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Check, CheckCircle2, Globe, History, Mail, MapPin, MessageSquare, Pencil, Plus, Users, X } from 'lucide-react'
import { CategoryChip } from '../ui/CategoryChip'
import { CategoryIcon } from '../ui/CategoryIcon'
import { EmptyState } from '../ui/EmptyState'
import { EventCard } from '../events/EventCard'
import { getLocality } from '../../data/localities'
import { useToast } from '../../hooks/ToastContext'
import {
  authAdapter,
  followOrganization,
  getOrganizationPublicEvents,
  unfollowOrganization,
} from '../../services'
import type { CommunityPost, EventWithMeta, Organization } from '../../types'
import { CommunityPostCard } from './CommunityPostCard'

interface Props {
  organization: Organization | null
  posts: CommunityPost[]
  open?: boolean
  onClose: () => void
  onFollowToggled?: () => void
  onPostUpdated?: () => void
  onEdit?: (org: Organization) => void
}

export function OrganizationProfileModal({
  organization,
  posts,
  open = true,
  onClose,
  onFollowToggled,
  onPostUpdated,
  onEdit,
}: Props) {
  const { notify } = useToast()
  const session = authAdapter.getSession()
  const isOwner = Boolean(
    session && organization && (session.id === organization.ownerId || session.role === 'admin'),
  )

  const [activeTab, setActiveTab] = useState<'posts' | 'events' | 'history'>('posts')
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<EventWithMeta[]>([])
  const [pastEvents, setPastEvents] = useState<EventWithMeta[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Close on Escape key
  useEffect(() => {
    if (!open || !organization) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, organization, onClose])

  // Load upcoming and past events for public event history from real records
  useEffect(() => {
    if (!organization) return
    let active = true
    setEventsLoading(true)

    getOrganizationPublicEvents(organization.id)
      .then((res) => {
        if (!active) return
        setEvents(res.upcoming)
        setPastEvents(res.past)
      })
      .catch((err) => {
        console.warn('Could not load organization public events:', err)
      })
      .finally(() => {
        if (active) setEventsLoading(false)
      })

    return () => {
      active = false
    }
  }, [organization])

  const orgPosts = useMemo(() => {
    if (!organization) return []
    return posts.filter(
      (p) =>
        p.organizationId === organization.id ||
        (p.organizationName && p.organizationName.toLowerCase() === organization.name.toLowerCase()),
    )
  }, [posts, organization])

  const [isFollowing, setIsFollowing] = useState(Boolean(organization?.isFollowing))
  const [followerCount, setFollowerCount] = useState(organization?.followerCount ?? 0)

  useEffect(() => {
    if (organization) {
      setIsFollowing(Boolean(organization.isFollowing))
      setFollowerCount(organization.followerCount)
    }
  }, [organization])

  if (!open || !organization) return null

  const locality = getLocality(organization.localityId)

  const handleToggleFollow = async () => {
    if (!organization) return
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
      onFollowToggled?.()
    } catch {
      setIsFollowing(!nextState)
      setFollowerCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)))
      notify('Failed to update follow.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="org-profile-title">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} aria-hidden />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#334155] bg-[#0B0F19] shadow-2xl">
        {/* Banner with accent header */}
        <div
          className="relative h-28 w-full shrink-0 border-b border-[#334155]/60 sm:h-36"
          style={{
            background: `linear-gradient(135deg, ${organization.accentColor}33 0%, #0B0F19 100%)`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-ink-muted backdrop-blur-md transition hover:bg-black/90 hover:text-white"
            aria-label="Close organization profile"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile info bar */}
        <div className="relative border-b border-[#1E293B] bg-secondary/80 px-6 pb-6 pt-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div
                className="-mt-14 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-[#0B0F19] text-[#0B0F19] shadow-lift sm:h-24 sm:w-24"
                style={{ backgroundColor: organization.accentColor }}
                aria-hidden
              >
                <CategoryIcon category={organization.category} className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="org-profile-title" className="text-xl font-bold text-white sm:text-2xl">
                    {organization.name}
                  </h2>
                  {/* Verified badge only when isVerified is true */}
                  {organization.isVerified && (
                    <span
                      title="Verified Campus Organization"
                      className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand border border-brand/30"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 fill-brand text-[#0B0F19]" />
                      Verified
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

            <div className="flex items-center gap-2 self-start sm:self-end">
              {isOwner && onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(organization)}
                  className="btn-secondary text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-semibold"
                >
                  <Pencil className="h-4 w-4 text-brand" />
                  <span>Edit Profile</span>
                </button>
              )}
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

        {/* Sub tabs: Posts vs Events vs Event History */}
        <div className="border-b border-[#1E293B] bg-[#0B0F19] px-6 pt-3">
          <div className="flex flex-wrap gap-4">
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
              Community Posts ({orgPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'events'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Upcoming Events ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition ${
                activeTab === 'history'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-ink-muted hover:text-white'
              }`}
            >
              <History className="h-4 w-4" />
              Public Event History ({pastEvents.length})
            </button>
          </div>
        </div>

        {/* Tab content area with scrollbar */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'posts' ? (
            orgPosts.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No posts yet"
                description={`${organization.name} hasn't published any community posts yet.`}
              />
            ) : (
              <div className="space-y-4">
                {orgPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    onPostUpdated={onPostUpdated}
                    onOpenOrgProfile={() => {}}
                  />
                ))}
              </div>
            )
          ) : activeTab === 'events' ? (
            eventsLoading ? (
              <p className="text-sm text-ink-muted">Loading scheduled events…</p>
            ) : events.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No upcoming events"
                description={`${organization.name} doesn't have any scheduled events right now. Follow them to be notified!`}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {events.map((evt) => (
                  <EventCard key={evt.id} event={evt} />
                ))}
              </div>
            )
          ) : (
            /* Event History Tab */
            eventsLoading ? (
              <p className="text-sm text-ink-muted">Loading event history…</p>
            ) : pastEvents.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No past events yet"
                description={`${organization.name} hasn't concluded any public events on NearCircle yet.`}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pastEvents.map((evt) => (
                  <EventCard key={evt.id} event={evt} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
