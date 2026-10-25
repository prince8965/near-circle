import type { ProjectSubmission, SubmissionStatus } from '../types'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { authAdapter } from './authAdapter'
import { delay } from './bus'
import {
  readEvents,
  readJudgeAssignments,
  readRegistrations,
  readSubmissions,
  readTeamMembers,
  readTeams,
  writeSubmissions,
} from './db'

/**
 * Retrieves a submission by ID.
 * Enforces visibility rules: submitter, team members, event organizer, assigned judges, or public submissions.
 */
export async function getSubmissionById(submissionId: string): Promise<ProjectSubmission | null> {
  await delay(100)
  const sessionUser = authAdapter.getSession()

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single()

      if (!error && data) {
        return {
          id: data.id,
          eventId: data.event_id,
          teamId: data.team_id,
          submitterId: data.submitter_id,
          trackId: data.track_id,
          title: data.title,
          tagline: data.tagline,
          description: data.description,
          demoUrl: data.demo_url,
          repoUrl: data.repo_url,
          videoUrl: data.video_url,
          coverImageUrl: data.cover_image_url,
          technologies: data.technologies || [],
          files: data.file_urls || [],
          status: data.status as SubmissionStatus,
          isPublic: data.is_public,
          submittedAt: data.submitted_at,
          feedbackSummary: data.feedback_summary,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      }
    } catch {
      // Fallback
    }
  }

  const submissions = readSubmissions()
  const sub = submissions.find((s) => s.id === submissionId)
  if (!sub) return null

  // Check authorization
  if (sub.isPublic && sub.status !== 'draft') {
    return sub
  }

  if (!sessionUser) {
    return null
  }

  const events = readEvents()
  const event = events.find((e) => e.id === sub.eventId)
  const isOwner = event?.ownerId === sessionUser.id
  const isSubmitter = sub.submitterId === sessionUser.id

  const teamMembers = readTeamMembers()
  const isTeamMember = sub.teamId
    ? teamMembers.some((m) => m.teamId === sub.teamId && m.userId === sessionUser.id)
    : false

  const judgeAssignments = readJudgeAssignments()
  const isAssignedJudge = judgeAssignments.some(
    (ja) => ja.eventId === sub.eventId && ja.judgeId === sessionUser.id,
  )

  if (isSubmitter || isTeamMember || isOwner || isAssignedJudge || sessionUser.role === 'admin') {
    return sub
  }

  return null
}

/**
 * Retrieves the submission for the current user (or their team) for a specific event.
 */
export async function getSubmissionForEvent(
  eventId: string,
  userId?: string,
): Promise<ProjectSubmission | null> {
  const targetUserId = userId ?? authAdapter.getSession()?.id
  if (!targetUserId) return null

  const teams = readTeams()
  const teamMembers = readTeamMembers()

  // Find if user is in a team for this event
  const teamMembership = teamMembers.find(
    (m) => m.userId === targetUserId && teams.some((t) => t.id === m.teamId && t.eventId === eventId),
  )

  const submissions = readSubmissions()
  const sub = submissions.find((s) => {
    if (s.eventId !== eventId) return false
    if (teamMembership && s.teamId === teamMembership.teamId) return true
    if (!s.teamId && s.submitterId === targetUserId) return true
    return false
  })

  return sub ?? null
}

/**
 * Retrieves all submissions for an event. Accessible by event organizers and assigned judges.
 */
export async function getEventSubmissions(
  eventId: string,
  filter?: { status?: SubmissionStatus; trackId?: string },
): Promise<ProjectSubmission[]> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  const isOwner = event.ownerId === sessionUser.id
  const judgeAssignments = readJudgeAssignments()
  const isAssignedJudge = judgeAssignments.some(
    (ja) => ja.eventId === eventId && ja.judgeId === sessionUser.id,
  )

  if (!isOwner && !isAssignedJudge && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: Only event organizers and assigned judges can view event submissions.')
  }

  let list = readSubmissions().filter((s) => s.eventId === eventId)

  // Non-owners (judges) only view non-drafts (submitted projects)
  if (!isOwner && sessionUser.role !== 'admin') {
    list = list.filter((s) => s.status !== 'draft')
  }

  if (filter?.status) {
    list = list.filter((s) => s.status === filter.status)
  }
  if (filter?.trackId) {
    list = list.filter((s) => s.trackId === filter.trackId)
  }

  return list
}

/**
 * Creates or updates a project submission draft.
 * Verifies registration, team membership, and ownership.
 */
export async function saveDraftSubmission(
  eventId: string,
  data: Partial<ProjectSubmission>,
): Promise<ProjectSubmission> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required to submit a project.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  // Check confirmed registration
  const registrations = readRegistrations()
  const isRegistered = registrations.some(
    (r) => r.eventId === eventId && r.userId === sessionUser.id && (r.status === 'confirmed' || r.status === 'checked_in'),
  )
  if (!isRegistered) {
    throw new Error('You must be registered for this event before creating a project submission.')
  }

  // Resolve team if applicable
  const teams = readTeams()
  const teamMembers = readTeamMembers()
  const membership = teamMembers.find(
    (m) => m.userId === sessionUser.id && teams.some((t) => t.id === m.teamId && t.eventId === eventId),
  )
  const team = membership ? teams.find((t) => t.id === membership.teamId) : undefined

  // Check existing submission
  const submissions = readSubmissions()
  const existing = submissions.find((s) => {
    if (s.eventId !== eventId) return false
    if (team && s.teamId === team.id) return true
    if (!team && s.submitterId === sessionUser.id) return true
    return false
  })

  // Prevent unauthorized modification
  if (existing) {
    const isAuthor =
      existing.submitterId === sessionUser.id ||
      (existing.teamId && teamMembers.some((m) => m.teamId === existing.teamId && m.userId === sessionUser.id))
    if (!isAuthor && event.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
      throw new Error('Unauthorized: You do not have permission to edit this project submission.')
    }

    // If already submitted and deadline passed, prevent edits unless organizer
    if (existing.status === 'submitted') {
      if (event.submissionDeadline && new Date(event.submissionDeadline).getTime() <= Date.now()) {
        if (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
          throw new Error('Submission deadline has passed. Edits are no longer allowed.')
        }
      }
    }
  }

  const nowIso = new Date().toISOString()
  const cleanTitle = (data.title ?? existing?.title ?? 'Untitled Project').trim()

  const submissionRecord: ProjectSubmission = {
    id: existing?.id ?? `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    eventId,
    teamId: team?.id,
    teamName: team?.name,
    submitterId: existing?.submitterId ?? sessionUser.id,
    submitterName: sessionUser.name,
    submitterAvatar: sessionUser.avatarUrl,
    trackId: data.trackId ?? existing?.trackId,
    title: cleanTitle,
    tagline: data.tagline ?? existing?.tagline ?? '',
    description: data.description ?? existing?.description ?? '',
    demoUrl: data.demoUrl ?? existing?.demoUrl,
    repoUrl: data.repoUrl ?? existing?.repoUrl,
    videoUrl: data.videoUrl ?? existing?.videoUrl,
    coverImageUrl: data.coverImageUrl ?? existing?.coverImageUrl,
    technologies: data.technologies ?? existing?.technologies ?? [],
    files: data.files ?? existing?.files ?? [],
    status: existing?.status ?? 'draft',
    isPublic: data.isPublic ?? existing?.isPublic ?? false,
    submittedAt: existing?.submittedAt,
    feedbackSummary: existing?.feedbackSummary,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  }

  const updatedList = existing
    ? submissions.map((s) => (s.id === existing.id ? submissionRecord : s))
    : [...submissions, submissionRecord]

  writeSubmissions(updatedList)
  return submissionRecord
}

/**
 * Performs final submission of the project before the event deadline.
 * Validates required fields and locks final status.
 */
export async function submitProject(submissionId: string): Promise<ProjectSubmission> {
  await delay(200)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const submissions = readSubmissions()
  const submission = submissions.find((s) => s.id === submissionId)
  if (!submission) {
    throw new Error('Submission not found.')
  }

  const events = readEvents()
  const event = events.find((e) => e.id === submission.eventId)
  if (!event) {
    throw new Error('Event not found.')
  }

  // Authorization check
  const teamMembers = readTeamMembers()
  const isAuthor =
    submission.submitterId === sessionUser.id ||
    (submission.teamId && teamMembers.some((m) => m.teamId === submission.teamId && m.userId === sessionUser.id))

  if (!isAuthor && event.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: Only project team members can submit this project.')
  }

  // Deadline enforcement
  if (event.submissionDeadline && new Date(event.submissionDeadline).getTime() <= Date.now()) {
    if (event.ownerId !== sessionUser.id && sessionUser.role !== 'admin') {
      throw new Error('Submission deadline has passed for this event. Submissions are closed.')
    }
  }

  // Completeness check
  if (!submission.title.trim()) {
    throw new Error('Project title is required.')
  }
  if (!submission.description.trim()) {
    throw new Error('Project description is required.')
  }

  const nowIso = new Date().toISOString()
  const submitted: ProjectSubmission = {
    ...submission,
    status: 'submitted',
    isPublic: true,
    submittedAt: nowIso,
    updatedAt: nowIso,
  }

  writeSubmissions(submissions.map((s) => (s.id === submission.id ? submitted : s)))
  return submitted
}

/**
 * Deletes a draft submission.
 */
export async function deleteSubmission(submissionId: string): Promise<void> {
  await delay(150)
  const sessionUser = authAdapter.getSession()
  if (!sessionUser) {
    throw new Error('Unauthorized: Sign-in required.')
  }

  const submissions = readSubmissions()
  const target = submissions.find((s) => s.id === submissionId)
  if (!target) {
    throw new Error('Submission not found.')
  }

  if (target.submitterId !== sessionUser.id && sessionUser.role !== 'admin') {
    throw new Error('Unauthorized: You can only delete your own draft submissions.')
  }

  if (target.status === 'submitted') {
    throw new Error('Finalized submissions cannot be deleted.')
  }

  writeSubmissions(submissions.filter((s) => s.id !== submissionId))
}
