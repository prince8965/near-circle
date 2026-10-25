import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type {
  AdminAuditLog,
  Organization,
  PlatformAdminAnalytics,
} from '../types'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import {
  readAdminAuditLogs,
  readCommunityPosts,
  readEvents,
  readOrganizations,
  readRegistrations,
  readSubmissions,
  writeAdminAuditLogs,
  writeCommunityPosts,
  writeOrganizations,
} from './db'
import { createNotification } from './notificationService'

/**
 * Admin Service
 *
 * Dedicated administrative workflows for platform administrators:
 * - Organization verification moderation (preventing self-approval).
 * - System audit logging.
 * - Community report moderation.
 * - Platform-wide analytics aggregation.
 *
 * Security: Every admin action strictly validates sessionUser.role === 'admin'.
 * There is no public admin signup.
 */

function requireAdmin() {
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Authentication required.')
  }
  if (sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: Platform administrator privileges required.')
  }
  return sessionUser
}

/**
 * Gets organizations with pending verification requests. Admin only.
 */
export async function getPendingVerifications(): Promise<Organization[]> {
  await delay(100)
  requireAdmin()

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('verification_status', 'pending')

      if (!error && data) {
        return data as Organization[]
      }
    } catch {
      // Local fallback
    }
  }

  const orgs = readOrganizations()
  return orgs.filter((o) => o.verificationStatus === 'pending')
}

/**
 * Gets all organizations for administration and status tracking. Admin only.
 */
export async function getAllOrganizationsForAdmin(): Promise<Organization[]> {
  await delay(100)
  requireAdmin()

  const orgs = readOrganizations()
  return orgs
}

/**
 * Organization owner submits a request for official campus/institution verification.
 */
export async function requestOrganizationVerification(
  orgId: string,
  notes?: string,
): Promise<Organization> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const orgs = readOrganizations()
  const org = orgs.find((o) => o.id === orgId)
  if (!org) {
    throw new Error('Organization not found.')
  }

  // Ownership verification check
  if (org.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: You can only request verification for organizations you own.')
  }

  if (org.isVerified) {
    throw new Error('Organization is already officially verified.')
  }

  const nowIso = new Date().toISOString()
  const updatedOrg: Organization = {
    ...org,
    verificationStatus: 'pending',
    verificationRequestedAt: nowIso,
    verificationNotes: notes?.trim() || undefined,
    updatedAt: nowIso,
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('organizations')
        .update({
          verification_status: 'pending',
          verification_requested_at: nowIso,
          verification_notes: updatedOrg.verificationNotes,
          updated_at: nowIso,
        })
        .eq('id', orgId)
    } catch {
      // Local fallback
    }
  }

  writeOrganizations(orgs.map((o) => (o.id === orgId ? updatedOrg : o)))

  // Notify owner of request receipt
  void createNotification({
    userId: sessionUser.id,
    type: 'verification_status',
    title: `Verification Request Submitted: ${org.name}`,
    message: `Your campus verification request for ${org.name} has been submitted to platform administrators for review.`,
    link: `/organizations/${org.id}`,
    data: { orgId: org.id },
  }).catch(() => {})

  return updatedOrg
}

/**
 * Admin reviews and approves or rejects an organization verification request.
 * Strict security: Organizers CANNOT approve their own organizations.
 */
export async function reviewOrganizationVerification(
  orgId: string,
  decision: 'verified' | 'rejected',
  notes?: string,
): Promise<Organization> {
  await delay(200)
  const admin = requireAdmin()

  const orgs = readOrganizations()
  const org = orgs.find((o) => o.id === orgId)
  if (!org) {
    throw new Error('Organization not found.')
  }

  // Security constraint: Organization owners cannot approve their own verification
  if (org.ownerId === admin.id) {
    throw new Error('Unauthorized: Organization owners cannot approve their own verification.')
  }

  const nowIso = new Date().toISOString()
  const isApproved = decision === 'verified'

  const updatedOrg: Organization = {
    ...org,
    isVerified: isApproved,
    verificationStatus: isApproved ? 'verified' : 'rejected',
    verifiedAt: isApproved ? nowIso : undefined,
    verifiedBy: admin.id,
    verificationNotes: notes?.trim() || undefined,
    updatedAt: nowIso,
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('organizations')
        .update({
          is_verified: isApproved,
          verification_status: updatedOrg.verificationStatus,
          verified_at: updatedOrg.verifiedAt,
          verified_by: updatedOrg.verifiedBy,
          verification_notes: updatedOrg.verificationNotes,
          updated_at: nowIso,
        })
        .eq('id', orgId)
    } catch {
      // Local fallback
    }
  }

  writeOrganizations(orgs.map((o) => (o.id === orgId ? updatedOrg : o)))

  // Record admin audit log
  const auditLog: AdminAuditLog = {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    adminId: admin.id,
    adminName: admin.name,
    action: isApproved ? 'approve_verification' : 'reject_verification',
    targetType: 'organization',
    targetId: org.id,
    targetName: org.name,
    details: notes || (isApproved ? 'Official campus verification approved.' : 'Verification rejected.'),
    createdAt: nowIso,
  }

  const logs = readAdminAuditLogs()
  writeAdminAuditLogs([auditLog, ...logs])

  // Notify organization owner
  if (org.ownerId) {
    void createNotification({
      userId: org.ownerId,
      type: 'verification_status',
      title: isApproved
        ? `Official Verification Approved: ${org.name}`
        : `Verification Request Update: ${org.name}`,
      message: isApproved
        ? `Congratulations! NearCircle administrators have officially verified ${org.name}. Your verified badge is now active across all events.`
        : `Your verification request for ${org.name} was reviewed: ${notes || 'Verification criteria not met.'}`,
      link: `/organizations/${org.id}`,
      data: { orgId: org.id, decision },
    }).catch(() => {})
  }

  return updatedOrg
}

/**
 * Gets audit log history. Admin only.
 */
export async function getAdminAuditLogs(): Promise<AdminAuditLog[]> {
  await delay(100)
  requireAdmin()
  return readAdminAuditLogs()
}

/**
 * Resolves a reported community post. Admin only.
 */
export async function resolveReportedPost(
  reportId: string,
  action: 'dismiss' | 'remove_post',
  postId: string,
): Promise<void> {
  await delay(150)
  const admin = requireAdmin()

  if (action === 'remove_post') {
    const posts = readCommunityPosts()
    writeCommunityPosts(posts.filter((p) => p.id !== postId))
  }

  const auditLog: AdminAuditLog = {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    adminId: admin.id,
    adminName: admin.name,
    action: action === 'remove_post' ? 'moderate_post' : 'dismiss_report',
    targetType: 'community_post',
    targetId: postId,
    details: `Action: ${action} on report ${reportId}`,
    createdAt: new Date().toISOString(),
  }

  writeAdminAuditLogs([auditLog, ...readAdminAuditLogs()])
}

/**
 * Computes platform-wide aggregated analytics. Admin only.
 */
export async function getPlatformAdminAnalytics(): Promise<PlatformAdminAnalytics> {
  await delay(150)
  requireAdmin()

  const orgs = readOrganizations()
  const events = readEvents()
  const registrations = readRegistrations()
  const submissions = readSubmissions()

  const now = Date.now()
  const activeEvents = events.filter(
    (e) => e.status === 'published' && new Date(e.endsAt).getTime() >= now,
  ).length

  const completedEvents = events.filter(
    (e) => e.status === 'completed' || (e.status === 'published' && new Date(e.endsAt).getTime() < now),
  ).length

  return {
    totalUsers: new Set(registrations.map((r) => r.userId)).size || 1,
    totalOrganizations: orgs.length,
    verifiedOrganizations: orgs.filter((o) => o.isVerified).length,
    pendingVerifications: orgs.filter((o) => o.verificationStatus === 'pending').length,
    totalEvents: events.length,
    activeEvents,
    completedEvents,
    totalRegistrations: registrations.filter((r) => r.status === 'confirmed' || r.status === 'checked_in').length,
    totalSubmissions: submissions.length,
    totalReports: 0,
  }
}
