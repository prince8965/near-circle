import { useEffect, useState } from 'react'
import {
  BarChart3,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { ConfirmationModal } from '../components/ui/ConfirmationModal'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../hooks/AuthContext'
import { useToast } from '../hooks/ToastContext'
import {
  getAdminAuditLogs,
  getAllOrganizationsForAdmin,
  getPlatformAdminAnalytics,
  reviewOrganizationVerification,
} from '../services'
import type {
  AdminAuditLog,
  Organization,
  PlatformAdminAnalytics,
} from '../types'
import { formatDate } from '../utils/format'

type TabKey = 'verifications' | 'audit' | 'analytics'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const { notify } = useToast()

  const [activeTab, setActiveTab] = useState<TabKey>('verifications')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([])
  const [analytics, setAnalytics] = useState<PlatformAdminAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)

  // Verification review modal
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'verified' | 'rejected' | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const reload = async () => {
    setLoading(true)
    try {
      const [orgs, logs, stats] = await Promise.all([
        getAllOrganizationsForAdmin(),
        getAdminAuditLogs(),
        getPlatformAdminAnalytics(),
      ])
      setOrganizations(orgs)
      setAuditLogs(logs)
      setAnalytics(stats)
    } catch (err: any) {
      notify(err.message || 'Failed to load administrative data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const handleConfirmReview = async () => {
    if (!selectedOrg || !reviewDecision) return
    setActionBusy(true)
    try {
      await reviewOrganizationVerification(selectedOrg.id, reviewDecision, reviewNotes)
      notify(
        reviewDecision === 'verified'
          ? `Officially verified ${selectedOrg.name}!`
          : `Rejected verification request for ${selectedOrg.name}.`,
        reviewDecision === 'verified' ? 'success' : 'info',
      )
      setSelectedOrg(null)
      setReviewDecision(null)
      setReviewNotes('')
      void reload()
    } catch (err: any) {
      notify(err.message || 'Failed to process verification decision.', 'error')
    } finally {
      setActionBusy(false)
    }
  }

  const pendingOrgs = organizations.filter((o) => o.verificationStatus === 'pending')
  const verifiedOrgs = organizations.filter((o) => o.isVerified)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Platform Administration &amp; Moderation"
          subtitle="Manage verified campus credentials, review organization requests, and inspect audit logs."
        />
        <span className="rounded-full bg-brand/10 border border-brand/40 px-3 py-1 text-xs font-mono font-bold text-brand uppercase tracking-wider">
          Admin Role: {user?.name}
        </span>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[#334155] pb-3" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'verifications'}
          onClick={() => setActiveTab('verifications')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'verifications'
              ? 'bg-brand text-[#0B0F19] shadow-cyber'
              : 'bg-[#0F172A] border border-[#334155] text-ink-muted hover:text-white'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Organization Verifications</span>
          {pendingOrgs.length > 0 && (
            <span className="rounded-full bg-amber-400 text-black px-1.5 py-0.2 text-[10px] font-bold">
              {pendingOrgs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'audit'
              ? 'bg-brand text-[#0B0F19] shadow-cyber'
              : 'bg-[#0F172A] border border-[#334155] text-ink-muted hover:text-white'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'analytics'
              ? 'bg-brand text-[#0B0F19] shadow-cyber'
              : 'bg-[#0F172A] border border-[#334155] text-ink-muted hover:text-white'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Platform Analytics</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-2 text-brand" /> Loading administrative data...
        </div>
      ) : activeTab === 'verifications' ? (
        <div className="space-y-6">
          {/* Pending Verifications */}
          <div className="card p-6 border border-[#334155] space-y-4">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  Pending Verification Requests ({pendingOrgs.length})
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Review applicant campus credentials. Organizations cannot self-approve.
                </p>
              </div>
            </div>

            {pendingOrgs.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-4 text-center">
                No pending verification requests at this time.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pendingOrgs.map((org) => {
                  const isOwner = org.ownerId === user?.id
                  return (
                    <div
                      key={org.id}
                      className="rounded-xl bg-[#0F172A] border border-[#334155] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{org.name}</h4>
                          <span className="text-[10px] uppercase font-bold text-brand">
                            {org.category}
                          </span>
                        </div>
                        <span className="rounded-full bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          Pending Review
                        </span>
                      </div>

                      <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                        {org.description}
                      </p>

                      {org.verificationNotes && (
                        <div className="rounded-lg bg-[#0B0F19] border border-[#334155] p-2 text-xs text-ink-faint">
                          <strong className="text-white">Applicant Notes:</strong> {org.verificationNotes}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-[#334155] text-xs">
                        {org.websiteUrl ? (
                          <a
                            href={org.websiteUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-brand hover:underline flex items-center gap-1 font-mono text-[11px]"
                          >
                            Website <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-ink-faint">No website</span>
                        )}

                        {isOwner ? (
                          <span className="text-[11px] text-rose-400 font-semibold italic">
                            Cannot self-approve (Owner)
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrg(org)
                                setReviewDecision('verified')
                              }}
                              className="btn-primary py-1 px-3 text-xs flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrg(org)
                                setReviewDecision('rejected')
                              }}
                              className="btn-secondary text-rose-300 border-rose-500/30 py-1 px-3 text-xs flex items-center gap-1"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Currently Verified Organizations */}
          <div className="card p-6 border border-[#334155] space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#334155] pb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Verified Organizations ({verifiedOrgs.length})
            </h3>

            <div className="overflow-x-auto border border-[#334155] rounded-xl bg-[#0F172A]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B0F19] text-ink-faint uppercase font-semibold border-b border-[#334155]">
                  <tr>
                    <th className="py-2.5 px-3">Organization</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {verifiedOrgs.map((org) => (
                    <tr key={org.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="py-3 px-3 font-semibold text-white">{org.name}</td>
                      <td className="py-3 px-3 text-ink-muted">{org.category}</td>
                      <td className="py-3 px-3">
                        <span className="rounded-full bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          Active Verified Badge
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrg(org)
                            setReviewDecision('rejected')
                          }}
                          className="text-rose-400 hover:underline text-xs"
                        >
                          Revoke Badge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'audit' ? (
        <div className="card p-6 border border-[#334155] space-y-4">
          <div className="flex items-center justify-between border-b border-[#334155] pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="h-4 w-4 text-brand" />
                Administrative Audit Logs
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Immutable audit trail of verification reviews and platform moderation actions.
              </p>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-ink-muted italic py-4 text-center">
              No audit logs recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto border border-[#334155] rounded-xl bg-[#0F172A]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B0F19] text-ink-faint uppercase font-semibold border-b border-[#334155]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-elevated/40 transition">
                      <td className="py-3 px-3 font-mono text-ink-faint">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">{log.adminName}</td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-[#0B0F19] border border-[#334155] px-2 py-0.5 text-[10px] font-mono text-brand">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white">{log.targetName || log.targetId}</td>
                      <td className="py-3 px-3 text-ink-muted">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {analytics && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card p-5 border border-[#334155] text-center">
                <p className="text-[10px] uppercase font-bold text-ink-faint">Total Organizations</p>
                <p className="text-2xl font-bold text-white mt-1">{analytics.totalOrganizations}</p>
                <p className="text-xs text-emerald-400 mt-1">
                  {analytics.verifiedOrganizations} Officially Verified
                </p>
              </div>

              <div className="card p-5 border border-[#334155] text-center">
                <p className="text-[10px] uppercase font-bold text-ink-faint">Active Hackathons</p>
                <p className="text-2xl font-bold text-white mt-1">{analytics.activeEvents}</p>
                <p className="text-xs text-ink-muted mt-1">
                  {analytics.completedEvents} Completed Events
                </p>
              </div>

              <div className="card p-5 border border-[#334155] text-center">
                <p className="text-[10px] uppercase font-bold text-ink-faint">Total Registrations</p>
                <p className="text-2xl font-bold text-brand mt-1">{analytics.totalRegistrations}</p>
                <p className="text-xs text-ink-muted mt-1">Across all events</p>
              </div>

              <div className="card p-5 border border-[#334155] text-center">
                <p className="text-[10px] uppercase font-bold text-ink-faint">Project Submissions</p>
                <p className="text-2xl font-bold text-white mt-1">{analytics.totalSubmissions}</p>
                <p className="text-xs text-ink-muted mt-1">Ready for evaluation</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Confirmation Modal */}
      <ConfirmationModal
        open={selectedOrg !== null && reviewDecision !== null}
        title={reviewDecision === 'verified' ? 'Approve Official Verification' : 'Reject Verification Request'}
        confirmLabel={reviewDecision === 'verified' ? 'Approve Verification' : 'Reject Request'}
        danger={reviewDecision === 'rejected'}
        busy={actionBusy}
        onConfirm={handleConfirmReview}
        onClose={() => {
          setSelectedOrg(null)
          setReviewDecision(null)
          setReviewNotes('')
        }}
      >
        <p className="text-xs text-ink-muted leading-relaxed">
          {reviewDecision === 'verified'
            ? `Grant official campus verification credentials to "${selectedOrg?.name}"? A verified badge will be rendered across all their public events.`
            : `Reject verification request for "${selectedOrg?.name}"?`}
        </p>
        <div className="mt-3">
          <label htmlFor="review-notes" className="block text-xs font-semibold text-ink-faint mb-1">
            Review Notes / Feedback (Optional):
          </label>
          <input
            id="review-notes"
            type="text"
            placeholder="e.g. Verified official campus faculty advisor and domain."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            className="input w-full text-xs"
          />
        </div>
      </ConfirmationModal>
    </div>
  )
}
