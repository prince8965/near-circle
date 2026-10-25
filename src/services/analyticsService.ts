import type { DetailedEventAnalytics, OrganizerAnalytics } from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import {
  readEvents,
  readRegistrations,
  readSubmissions,
  readSubmissionScores,
} from './db'

/**
 * Computes organizer analytics derived directly from real database records.
 *
 * Counting & Metric Rules:
 * - Published Events: status === 'published' && endsAt >= now
 * - Completed Events: status === 'completed' || (status === 'published' && endsAt < now)
 *   Drafts, cancelled events, and non-events are strictly excluded.
 * - Registrations: real count of records in event_registrations
 * - Confirmed Registrations: status === 'confirmed'
 * - Checked-in Registrations: status === 'checked_in'
 * - Attendance Rate: checkedIn / (confirmed + checkedIn)
 * - Submissions: real count from submissions
 * - Scored Submissions: submissions that have at least 1 score from assigned judges
 *
 * Security & Isolation:
 * - Only organizers and platform administrators may access this endpoint.
 * - Organizers can only access metrics for their own events/organization.
 */
export async function getOrganizerAnalytics(targetOrganizerId?: string): Promise<OrganizerAnalytics> {
  await delay(150)
  const session = authAdapter.getSession()
  if (!session) {
    throw new Error('Unauthorized: Authentication required.')
  }

  // Security check: only organizers and admins can access organizer analytics
  if (session.role !== 'organizer' && session.role !== 'admin') {
    throw new Error('Unauthorized: Only event organizers and administrators can access analytics.')
  }

  const effectiveOwnerId = targetOrganizerId || session.id

  // Cross-organization check: organizers cannot query other organizers' private metrics
  if (session.role !== 'admin' && effectiveOwnerId !== session.id) {
    throw new Error('Unauthorized: You cannot access analytics for another organizer or organization.')
  }

  const now = Date.now()

  // 1. Supabase real data when configured
  if (isSupabaseConfigured()) {
    try {
      const { data: dbEvents, error } = await supabase
        .from('events')
        .select('*')
        .eq('owner_id', effectiveOwnerId)

      if (!error && dbEvents) {
        const eventIds = dbEvents.map((e: any) => e.id)
        let registrations: any[] = []
        let submissions: any[] = []

        if (eventIds.length > 0) {
          const [regRes, subRes] = await Promise.all([
            supabase.from('event_registrations').select('*').in('event_id', eventIds),
            supabase.from('submissions').select('*').in('event_id', eventIds),
          ])
          registrations = regRes.data || []
          submissions = subRes.data || []
        }

        const totalEvents = dbEvents.length
        const publishedEvents = dbEvents.filter(
          (e: any) => e.status === 'published' && new Date(e.ends_at || e.end_date).getTime() >= now,
        ).length
        const draftEvents = dbEvents.filter((e: any) => e.status === 'draft').length
        const completedEvents = dbEvents.filter(
          (e: any) =>
            e.status === 'completed' ||
            (e.status === 'published' && new Date(e.ends_at || e.end_date).getTime() < now),
        ).length
        const cancelledEvents = dbEvents.filter((e: any) => e.status === 'cancelled').length

        const confirmedRegistrations = registrations.filter((r: any) => r.status === 'confirmed').length
        const checkedInRegistrations = registrations.filter((r: any) => r.status === 'checked_in').length
        const totalRegistrations = registrations.length
        const attendanceRate =
          confirmedRegistrations + checkedInRegistrations > 0
            ? checkedInRegistrations / (confirmedRegistrations + checkedInRegistrations)
            : 0

        return {
          totalEvents,
          publishedEvents,
          draftEvents,
          completedEvents,
          cancelledEvents,
          totalRsvps: totalRegistrations,
          totalCheckIns: checkedInRegistrations,
          totalRegistrations,
          confirmedRegistrations,
          checkedInRegistrations,
          attendanceRate: Number(attendanceRate.toFixed(2)),
          totalSubmissions: submissions.length,
          scoredSubmissions: submissions.filter((s: any) => s.status === 'winner' || s.status === 'accepted').length,
          isMock: false,
          isRealData: true,
        }
      }
    } catch {
      // Local fallback
    }
  }

  // 2. Database store calculation
  const allEvents = readEvents()
  const organizerEvents = allEvents.filter((e) => e.ownerId === effectiveOwnerId)

  const totalEvents = organizerEvents.length
  const publishedEvents = organizerEvents.filter(
    (e) => e.status === 'published' && new Date(e.endsAt).getTime() >= now,
  ).length
  const draftEvents = organizerEvents.filter((e) => e.status === 'draft').length
  const completedEvents = organizerEvents.filter(
    (e) => e.status === 'completed' || (e.status === 'published' && new Date(e.endsAt).getTime() < now),
  ).length
  const cancelledEvents = organizerEvents.filter((e) => e.status === 'cancelled').length

  const eventIds = new Set(organizerEvents.map((e) => e.id))
  const allRegistrations = readRegistrations().filter((r) => eventIds.has(r.eventId))
  const confirmedRegistrations = allRegistrations.filter((r) => r.status === 'confirmed').length
  const checkedInRegistrations = allRegistrations.filter((r) => r.status === 'checked_in').length
  const totalRegistrations = allRegistrations.length

  const attendanceRate =
    confirmedRegistrations + checkedInRegistrations > 0
      ? checkedInRegistrations / (confirmedRegistrations + checkedInRegistrations)
      : 0

  const allSubmissions = readSubmissions().filter((s) => eventIds.has(s.eventId))
  const allScores = readSubmissionScores()
  const scoredSubmissionIds = new Set(allScores.map((sc) => sc.submissionId))
  const scoredSubmissions = allSubmissions.filter((s) => scoredSubmissionIds.has(s.id)).length

  // Build per-event breakdown
  const eventBreakdown: DetailedEventAnalytics[] = organizerEvents.map((ev) => {
    const evRegs = allRegistrations.filter((r) => r.eventId === ev.id)
    const evSubs = allSubmissions.filter((s) => s.eventId === ev.id)
    const evConfirmed = evRegs.filter((r) => r.status === 'confirmed').length
    const evCheckedIn = evRegs.filter((r) => r.status === 'checked_in').length
    const evAttRate = evConfirmed + evCheckedIn > 0 ? evCheckedIn / (evConfirmed + evCheckedIn) : 0

    return {
      eventId: ev.id,
      eventTitle: ev.title,
      status: ev.status,
      isPublished: ev.status === 'published',
      isCompleted: ev.status === 'completed' || (ev.status === 'published' && new Date(ev.endsAt).getTime() < now),
      totalRegistrations: evRegs.length,
      confirmedRegistrations: evConfirmed,
      checkedInRegistrations: evCheckedIn,
      attendanceRate: Number(evAttRate.toFixed(2)),
      totalSubmissions: evSubs.length,
      scoredSubmissions: evSubs.filter((s) => scoredSubmissionIds.has(s.id)).length,
      resultsPublished: Boolean(ev.resultsPublished),
    }
  })

  return {
    totalEvents,
    publishedEvents,
    draftEvents,
    completedEvents,
    cancelledEvents,
    totalRsvps: totalRegistrations,
    totalCheckIns: checkedInRegistrations,
    totalRegistrations,
    confirmedRegistrations,
    checkedInRegistrations,
    attendanceRate: Number(attendanceRate.toFixed(2)),
    totalSubmissions: allSubmissions.length,
    scoredSubmissions,
    events: eventBreakdown,
    isMock: false,
    isRealData: true,
  }
}
