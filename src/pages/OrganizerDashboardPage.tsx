import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe,
  ImageUp,
  MapPin,
  Pencil,
  PlusCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Trash2,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import { DashboardStatCard } from '../components/ui/DashboardStatCard'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton } from '../components/ui/Skeleton'
import { EditOrganizationModal } from '../components/organization/EditOrganizationModal'
import { OrganizationProfileModal } from '../components/community/OrganizationProfileModal'
import { AttendeeListModal } from '../components/events/AttendeeListModal'
import { OrganizerJudgingModal } from '../components/judging/OrganizerJudgingModal'
import { useAuth } from '../hooks/AuthContext'
import { useToast } from '../hooks/ToastContext'
import { useAsync } from '../hooks/useAsync'
import {
  cancelEvent,
  deleteDraftEvent,
  getCommunityPosts,
  getOrganizerAnalytics,
  getOrganizerEvents,
  getOrganizationById,
  getOrganizationByOwnerId,
  requestOrganizationVerification,
  updateEvent,
} from '../services'
import type { CommunityPost, EventStatus, EventWithMeta, Organization } from '../types'
import { formatDate, formatTime } from '../utils/format'

type FilterTab = 'all' | 'published' | 'draft' | 'completed' | 'cancelled'

const STATUS_STYLES: Record<EventStatus, string> = {
  published: 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30',
  draft: 'bg-amber-950/40 text-amber-300 border border-amber-500/30',
  completed: 'bg-sky-950/40 text-sky-300 border border-sky-500/30',
  cancelled: 'bg-rose-950/40 text-rose-300 border border-rose-500/30',
}

export default function OrganizerDashboardPage() {
  const { user } = useAuth()
  const { notify } = useToast()

  const analytics = useAsync(getOrganizerAnalytics, [])
  const events = useAsync(getOrganizerEvents, [])
  const [org, setOrg] = useState<Organization | null>(null)

  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  // Modals state
  const [attendeesTarget, setAttendeesTarget] = useState<EventWithMeta | null>(null)
  const [judgingTarget, setJudgingTarget] = useState<EventWithMeta | null>(null)
  const [cancelTarget, setCancelTarget] = useState<EventWithMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EventWithMeta | null>(null)
  const [publishTarget, setPublishTarget] = useState<EventWithMeta | null>(null)
  const [isEditOrgOpen, setIsEditOrgOpen] = useState(false)
  const [isViewOrgOpen, setIsViewOrgOpen] = useState(false)
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [actionBusy, setActionBusy] = useState(false)

  // Fetch organizer's organization profile
  const reloadOrg = async () => {
    if (!user) return
    try {
      let found: Organization | null = null
      if (user.organizationId) {
        found = await getOrganizationById(user.organizationId)
      }
      if (!found && user.id) {
        found = await getOrganizationByOwnerId(user.id)
      }
      setOrg(found)
    } catch (err) {
      console.warn('Could not load organization profile:', err)
    }
  }

  const handleRequestVerification = async () => {
    if (!org) return
    try {
      await requestOrganizationVerification(org.id, 'Campus organizer verification request')
      notify('Verification request submitted for administrator review!')
      await reloadOrg()
    } catch (err: any) {
      notify(err.message || 'Failed to submit verification request.', 'error')
    }
  }

  useEffect(() => {
    void reloadOrg()
  }, [user])

  // Load community posts for organization public modal
  useEffect(() => {
    if (isViewOrgOpen && org) {
      getCommunityPosts({
        tab: 'organizations',
        category: 'all',
        sort: 'newest',
        localityId: org.localityId,
      }).then(setCommunityPosts)
    }
  }, [isViewOrgOpen, org])

  const reloadAll = () => {
    analytics.reload()
    events.reload()
  }

  // Cancel Event action
  const confirmCancel = async () => {
    if (!cancelTarget) return
    setActionBusy(true)
    try {
      await cancelEvent(cancelTarget.id)
      notify(`“${cancelTarget.title}” was cancelled.`, 'info')
      reloadAll()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not cancel the event.', 'error')
    } finally {
      setActionBusy(false)
      setCancelTarget(null)
    }
  }

  // Quick Publish Draft action
  const confirmPublish = async () => {
    if (!publishTarget) return
    setActionBusy(true)
    try {
      await updateEvent(publishTarget.id, { status: 'published' })
      notify(`“${publishTarget.title}” is now published and live on Discover!`, 'success')
      reloadAll()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not publish draft.', 'error')
    } finally {
      setActionBusy(false)
      setPublishTarget(null)
    }
  }

  // Delete Draft action
  const confirmDelete = async () => {
    if (!deleteTarget) return
    setActionBusy(true)
    try {
      await deleteDraftEvent(deleteTarget.id)
      notify(`Draft “${deleteTarget.title}” was deleted.`, 'info')
      reloadAll()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete draft.', 'error')
    } finally {
      setActionBusy(false)
      setDeleteTarget(null)
    }
  }

  const allEvents = events.data ?? []
  const now = Date.now()

  // Compute effective status for each event
  const eventsWithEffectiveStatus = allEvents.map((e) => {
    const isCompleted = e.status === 'completed' || (e.status === 'published' && new Date(e.endsAt).getTime() < now)
    return {
      ...e,
      effectiveStatus: (isCompleted ? 'completed' : e.status) as EventStatus,
    }
  })

  const publishedCount = eventsWithEffectiveStatus.filter((e) => e.effectiveStatus === 'published').length
  const draftCount = eventsWithEffectiveStatus.filter((e) => e.effectiveStatus === 'draft').length
  const completedCount = eventsWithEffectiveStatus.filter((e) => e.effectiveStatus === 'completed').length
  const cancelledCount = eventsWithEffectiveStatus.filter((e) => e.effectiveStatus === 'cancelled').length

  const filteredEvents = eventsWithEffectiveStatus.filter((e) => {
    if (activeTab === 'all') return true
    return e.effectiveStatus === activeTab
  })

  const a = analytics.data

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <PageHeader
        title="Organizer Dashboard"
        subtitle="Manage your campus organization, drafts, hackathons, and published events."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/organizer/poster" className="btn-secondary">
              <ImageUp className="h-4 w-4" aria-hidden /> Draft from poster
            </Link>
            <Link to="/organizer/create" className="btn-primary px-5">
              <PlusCircle className="h-4 w-4" aria-hidden /> Create Event
            </Link>
          </div>
        }
      />

      {/* Organization Profile Management Card */}
      <section aria-labelledby="sec-org-profile" className="card relative overflow-hidden border border-[#334155] p-5 sm:p-6 bg-gradient-to-br from-[#0F172A] to-[#0B0F19]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-[#0B0F19] shadow-lift"
              style={{ backgroundColor: org?.accentColor || '#00F2FE' }}
            >
              {org?.name ? org.name.slice(0, 2).toUpperCase() : <Building2 className="h-7 w-7" />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="sec-org-profile" className="text-xl font-bold text-white">
                  {org?.name || 'Your Organization Profile'}
                </h2>
                {org?.isVerified ? (
                  <span
                    title="Verified Campus Organization"
                    className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand border border-brand/30"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 fill-brand text-[#0B0F19]" />
                    Verified Organization
                  </span>
                ) : org?.verificationStatus === 'pending' ? (
                  <span
                    title="Verification status is under review by NearCircle administrators"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Pending Verification Review
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestVerification}
                    className="inline-flex items-center gap-1 rounded-full bg-brand/10 hover:bg-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand border border-brand/30 transition cursor-pointer"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Request Campus Verification
                  </button>
                )}
              </div>

              {org ? (
                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-brand" /> {org.category} · {org.localityId}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-brand" /> {org.followerCount.toLocaleString('en-IN')} followers
                  </span>
                  {org.websiteUrl && (
                    <>
                      <span>•</span>
                      <a href={org.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand hover:underline">
                        <Globe className="h-3 w-3" /> Website
                      </a>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-ink-muted">
                  Set up your organization profile to showcase your brand, website, and public event history to students.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {org && (
              <button
                type="button"
                onClick={() => setIsViewOrgOpen(true)}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
              >
                <Eye className="h-4 w-4" />
                <span>Public Page</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsEditOrgOpen(true)}
              className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <Pencil className="h-4 w-4" />
              <span>{org ? 'Edit Organization' : 'Create Organization Profile'}</span>
            </button>
          </div>
        </div>

        {org?.description && (
          <p className="mt-4 text-xs leading-relaxed text-ink-muted border-t border-[#1E293B] pt-3">
            {org.description}
          </p>
        )}
      </section>

      {/* Summary Statistics */}
      <section aria-label="Summary statistics">
        {analytics.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : analytics.error ? (
          <ErrorState message={analytics.error} onRetry={analytics.reload} />
        ) : a ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardStatCard
              icon={CalendarDays}
              label="Total events"
              value={String(a.totalEvents)}
              helper={`${a.publishedEvents} live · ${a.draftEvents} drafts`}
            />
            <DashboardStatCard
              icon={Send}
              label="Published & Upcoming"
              value={String(a.publishedEvents)}
              helper="Visible in public discovery"
            />
            <DashboardStatCard
              icon={Ticket}
              label="Total RSVPs & Seats"
              value={a.totalRsvps.toLocaleString('en-IN')}
              helper={a.isRealData ? 'Live database registrations' : 'Demo data simulation'}
            />
            <DashboardStatCard
              icon={TrendingUp}
              label="Concluded Events"
              value={String(a.completedEvents)}
              helper="Finished events in your history"
            />
          </div>
        ) : null}
      </section>

      {/* Events Management List with Sub-tabs */}
      <section aria-labelledby="recent" className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="recent" className="text-xl font-bold text-white">Your Events &amp; Drafts</h2>

          {/* Sub-tabs filter */}
          <div className="flex flex-wrap rounded-xl bg-[#0F172A] border border-[#334155] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === 'all' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              All ({allEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('published')}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === 'published' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              Published ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('draft')}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === 'draft' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              Drafts ({draftCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === 'completed' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              Completed ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cancelled')}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeTab === 'cancelled' ? 'bg-brand text-[#0B0F19]' : 'text-ink-muted hover:text-white'
              }`}
            >
              Cancelled ({cancelledCount})
            </button>
          </div>
        </div>

        {events.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.reload} />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={activeTab === 'all' ? 'You haven’t created any events' : `No ${activeTab} events`}
            description={
              activeTab === 'all'
                ? 'Create your first event or draft one from a poster.'
                : `You don’t have any events currently in the ${activeTab} status.`
            }
            actionLabel="Create Event"
            actionTo="/organizer/create"
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden grid-cols-[1.5fr_140px_110px_110px_200px] gap-4 border-b border-[#334155] bg-[#0B0F19]/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint md:grid">
              <span>Event / Domain</span>
              <span>Schedule</span>
              <span>Status</span>
              <span>RSVPs</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-[#334155]/60">
              {filteredEvents.map((e) => {
                const isDraft = e.effectiveStatus === 'draft'
                const isPublished = e.effectiveStatus === 'published'
                const isCompleted = e.effectiveStatus === 'completed'
                const isCancelled = e.effectiveStatus === 'cancelled'

                return (
                  <li
                    key={e.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_140px_110px_110px_200px] md:items-center md:gap-4 hover:bg-[#1E293B]/20 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={isDraft ? `/organizer/edit/${e.id}` : `/events/${e.id}`}
                          className="truncate font-semibold text-white hover:text-brand"
                        >
                          {e.title}
                        </Link>
                        {e.mode && (
                          <span className="rounded bg-[#0F172A] px-1.5 py-0.5 text-[10px] uppercase font-semibold text-ink-muted border border-[#334155]">
                            {e.mode}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-ink-faint">{e.venueName}</p>
                    </div>

                    <p className="text-sm text-ink-muted">
                      {formatDate(e.startsAt)}
                      <span className="block text-xs">{formatTime(e.startsAt)}</span>
                    </p>

                    <p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[e.effectiveStatus]}`}>
                        {e.effectiveStatus}
                      </span>
                    </p>

                    <p className="text-sm text-ink-muted">
                      {e.rsvpCount} / {e.capacity}
                    </p>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {isDraft && (
                        <>
                          <button
                            type="button"
                            className="btn-primary px-3 py-1 text-xs flex items-center gap-1"
                            onClick={() => setPublishTarget(e)}
                            title="Publish draft to public discovery"
                          >
                            <Send className="h-3.5 w-3.5" /> Publish
                          </button>
                          <Link
                            to={`/organizer/edit/${e.id}`}
                            className="btn-secondary px-3 py-1 text-xs flex items-center gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Link>
                          <button
                            type="button"
                            className="btn-danger px-2.5 py-1 text-xs"
                            onClick={() => setDeleteTarget(e)}
                            title="Delete this draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {isPublished && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1 text-brand border-brand/30 hover:border-brand/60"
                            onClick={() => setAttendeesTarget(e)}
                            title="View attendee roster"
                          >
                            <Users className="h-3.5 w-3.5" /> Attendees
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1 text-amber-400 border-amber-500/30 hover:border-amber-500/60"
                            onClick={() => setJudgingTarget(e)}
                            title="Configure judging criteria & review scores"
                          >
                            <Award className="h-3.5 w-3.5" /> Judging
                          </button>
                          <Link
                            to={`/organizer/edit/${e.id}`}
                            className="btn-secondary px-3 py-1 text-xs flex items-center gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Link>
                          <Link
                            to={`/events/${e.id}`}
                            className="btn-secondary px-2.5 py-1 text-xs"
                            title="View public page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            className="btn-danger px-2.5 py-1 text-xs"
                            onClick={() => setCancelTarget(e)}
                            title="Cancel event"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1 text-brand border-brand/30 hover:border-brand/60"
                            onClick={() => setAttendeesTarget(e)}
                            title="View attendee roster"
                          >
                            <Users className="h-3.5 w-3.5" /> Attendees
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-2.5 py-1 text-xs flex items-center gap-1 text-amber-400 border-amber-500/30 hover:border-amber-500/60"
                            onClick={() => setJudgingTarget(e)}
                            title="Configure judging criteria & review scores"
                          >
                            <Award className="h-3.5 w-3.5" /> Judging
                          </button>
                          <Link
                            to={`/events/${e.id}`}
                            className="btn-secondary px-3 py-1 text-xs flex items-center gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                        </>
                      )}

                      {isCancelled && (
                        <Link
                          to={`/events/${e.id}`}
                          className="btn-secondary px-3 py-1 text-xs flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Confirmation Modal: Cancel Event */}
      <ConfirmationModal
        open={cancelTarget !== null}
        title="Cancel this event?"
        confirmLabel="Cancel event"
        cancelLabel="Keep event"
        danger
        busy={actionBusy}
        onConfirm={confirmCancel}
        onClose={() => setCancelTarget(null)}
      >
        <p>
          <strong className="text-white">{cancelTarget?.title}</strong> will be marked as cancelled.
          People who registered will see it as cancelled and it will no longer accept new registrations.
        </p>
      </ConfirmationModal>

      {/* Confirmation Modal: Quick Publish Draft */}
      <ConfirmationModal
        open={publishTarget !== null}
        title="Publish this draft?"
        confirmLabel="Publish Now"
        cancelLabel="Keep as Draft"
        busy={actionBusy}
        onConfirm={confirmPublish}
        onClose={() => setPublishTarget(null)}
      >
        <p>
          <strong className="text-white">{publishTarget?.title}</strong> will be immediately published and
          made visible to students on the NearCircle Discover feed and map.
        </p>
      </ConfirmationModal>

      {/* Confirmation Modal: Delete Draft */}
      <ConfirmationModal
        open={deleteTarget !== null}
        title="Delete draft event?"
        confirmLabel="Delete Draft"
        cancelLabel="Cancel"
        danger
        busy={actionBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      >
        <p>
          Are you sure you want to delete the draft <strong className="text-white">{deleteTarget?.title}</strong>?
          This action cannot be undone.
        </p>
      </ConfirmationModal>

      {/* Edit Organization Profile Modal */}
      <EditOrganizationModal
        organization={org}
        isOpen={isEditOrgOpen}
        onClose={() => setIsEditOrgOpen(false)}
        onSaved={(updated) => {
          setOrg(updated)
          reloadOrg()
        }}
      />

      {/* Public Organization Profile Preview Modal */}
      <OrganizationProfileModal
        organization={org}
        posts={communityPosts}
        open={isViewOrgOpen}
        onClose={() => setIsViewOrgOpen(false)}
        onEdit={() => {
          setIsViewOrgOpen(false)
          setIsEditOrgOpen(true)
        }}
      />

      {/* Organizer Attendee Roster Modal */}
      <AttendeeListModal
        open={attendeesTarget !== null}
        event={attendeesTarget}
        onClose={() => setAttendeesTarget(null)}
      />

      {/* Organizer Judging & Results Modal */}
      <OrganizerJudgingModal
        open={judgingTarget !== null}
        event={judgingTarget}
        onClose={() => setJudgingTarget(null)}
        onUpdate={() => void events.reload()}
      />
    </div>
  )
}
