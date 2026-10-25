/**
 * Raw localStorage "tables". Services are the only code that should import this file.
 * Replace with real API calls when the backend is ready.
 */
import { SEED_COMMUNITIES as _SEED_COMMUNITIES } from '../data/communities'
import { SEED_COMMENTS } from '../data/communityComments'
import { SEED_POSTS } from '../data/communityPosts'
import { SEED_EVENTS } from '../data/events'
import { SEED_ORGANIZATIONS } from '../data/organizations'
import type {
  AdminAuditLog,
  AppNotification,
  CommunityPost,
  Event,
  EventRegistration,
  JudgeAssignment,
  JudgingCriterion,
  Organization,
  PostComment,
  PostReport,
  ProjectSubmission,
  RSVP,
  SubmissionFile,
  SubmissionScore,
  Team,
  TeamInvite,
  TeamMember,
} from '../types'
import { readStore, writeStore } from '../utils/storage'
import { notifyChange } from './bus'

void _SEED_COMMUNITIES

const EVENTS_KEY = 'events.v1'
const RSVPS_KEY = 'rsvps.v1'
const REGISTRATIONS_KEY = 'event_registrations.v1'
const TEAMS_KEY = 'teams.v1'
const TEAM_MEMBERS_KEY = 'team_members.v1'
const TEAM_INVITES_KEY = 'team_invites.v1'
const SUBMISSIONS_KEY = 'submissions.v1'
const CRITERIA_KEY = 'judging_criteria.v1'
const JUDGE_ASSIGNMENTS_KEY = 'judge_assignments.v1'
const SCORES_KEY = 'submission_scores.v1'
const STORAGE_FILES_KEY = 'storage_files.v1'
const FOLLOWS_KEY = 'follows.v1'
const COMMUNITY_POSTS_KEY = 'community_posts.v1'
const POST_LIKES_KEY = 'post_likes.v1'
const POST_COMMENTS_KEY = 'post_comments.v1'
const ORGANIZATIONS_KEY = 'organizations.v1'
const ORG_FOLLOWS_KEY = 'org_follows.v1'
const POST_REPORTS_KEY = 'post_reports.v1'
const NOTIFICATIONS_KEY = 'notifications.v1'
const ADMIN_AUDIT_LOGS_KEY = 'admin_audit_logs.v1'

export function readEvents(): Event[] {
  const stored = readStore<Event[] | null>(EVENTS_KEY, null)
  if (stored) return stored
  writeStore(EVENTS_KEY, SEED_EVENTS)
  return SEED_EVENTS
}

export function writeEvents(events: Event[]): void {
  writeStore(EVENTS_KEY, events)
  notifyChange()
}

export function readRsvps(): RSVP[] {
  const stored = readStore<RSVP[] | null>(RSVPS_KEY, null)
  if (stored) return stored
  // One demo RSVP to a past event so the "Past" tab is not empty on first run.
  const seeded: RSVP[] = [
    {
      id: 'rsvp-seed-1',
      eventId: 'evt-past-python',
      userId: 'guest',
      status: 'going',
      createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      ticketCode: 'NC-DEMO01',
    },
  ]
  writeStore(RSVPS_KEY, seeded)
  return seeded
}

export function writeRsvps(rsvps: RSVP[]): void {
  writeStore(RSVPS_KEY, rsvps)
  notifyChange()
}

export function readFollowedIds(): string[] {
  return readStore<string[]>(FOLLOWS_KEY, [])
}

export function writeFollowedIds(ids: string[]): void {
  writeStore(FOLLOWS_KEY, ids)
  notifyChange()
}

export function readCommunityPosts(): CommunityPost[] {
  const stored = readStore<CommunityPost[] | null>(COMMUNITY_POSTS_KEY, null)
  if (stored) return stored
  writeStore(COMMUNITY_POSTS_KEY, SEED_POSTS)
  return SEED_POSTS
}

export function writeCommunityPosts(posts: CommunityPost[]): void {
  writeStore(COMMUNITY_POSTS_KEY, posts)
  notifyChange()
}

/** Returns a map of postId -> array of user IDs who liked it */
export function readPostLikes(): Record<string, string[]> {
  const stored = readStore<Record<string, string[]> | null>(POST_LIKES_KEY, null)
  if (stored) return stored
  // Seed with initial demo likes
  const seeded: Record<string, string[]> = {
    'post-1': ['u-demo', 'u-tanvi', 'u-karan'],
    'post-3': ['u-manya', 'u-priya'],
    'post-8': ['u-demo', 'u-rohit'],
  }
  writeStore(POST_LIKES_KEY, seeded)
  return seeded
}

export function writePostLikes(likes: Record<string, string[]>): void {
  writeStore(POST_LIKES_KEY, likes)
  notifyChange()
}

export function readPostComments(): PostComment[] {
  const stored = readStore<PostComment[] | null>(POST_COMMENTS_KEY, null)
  if (stored) return stored
  writeStore(POST_COMMENTS_KEY, SEED_COMMENTS)
  return SEED_COMMENTS
}

export function writePostComments(comments: PostComment[]): void {
  writeStore(POST_COMMENTS_KEY, comments)
  notifyChange()
}

export function readOrganizations(): Organization[] {
  const stored = readStore<Organization[] | null>(ORGANIZATIONS_KEY, null)
  if (stored) return stored
  writeStore(ORGANIZATIONS_KEY, SEED_ORGANIZATIONS)
  return SEED_ORGANIZATIONS
}

export function writeOrganizations(orgs: Organization[]): void {
  writeStore(ORGANIZATIONS_KEY, orgs)
  notifyChange()
}

export function readFollowedOrgIds(): string[] {
  const stored = readStore<string[] | null>(ORG_FOLLOWS_KEY, null)
  if (stored) return stored
  const seeded = ['org-acm', 'org-gdg'] // default followed for demo richness
  writeStore(ORG_FOLLOWS_KEY, seeded)
  return seeded
}

export function writeFollowedOrgIds(ids: string[]): void {
  writeStore(ORG_FOLLOWS_KEY, ids)
  notifyChange()
}

export function readPostReports(): PostReport[] {
  return readStore<PostReport[]>(POST_REPORTS_KEY, [])
}

export function writePostReports(reports: PostReport[]): void {
  writeStore(POST_REPORTS_KEY, reports)
  notifyChange()
}

export function readRegistrations(): EventRegistration[] {
  const stored = readStore<EventRegistration[] | null>(REGISTRATIONS_KEY, null)
  if (stored) return stored
  // Default seed: synchronize with RSVP seed if present
  const rsvps = readRsvps()
  const seeded: EventRegistration[] = rsvps.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    userId: r.userId,
    status: r.status === 'going' ? 'confirmed' : 'cancelled',
    ticketCode: r.ticketCode,
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
  }))
  writeStore(REGISTRATIONS_KEY, seeded)
  return seeded
}

export function writeRegistrations(registrations: EventRegistration[]): void {
  writeStore(REGISTRATIONS_KEY, registrations)
  // Also keep rsvps.v1 in sync for backward compatibility with legacy views
  const legacyRsvps: RSVP[] = registrations.map((reg) => ({
    id: reg.id,
    eventId: reg.eventId,
    userId: reg.userId,
    status: reg.status === 'confirmed' || reg.status === 'checked_in' ? 'going' : 'cancelled',
    createdAt: reg.createdAt,
    ticketCode: reg.ticketCode,
  }))
  writeStore(RSVPS_KEY, legacyRsvps)
  notifyChange()
}

export function readTeams(): Team[] {
  return readStore<Team[]>(TEAMS_KEY, [])
}

export function writeTeams(teams: Team[]): void {
  writeStore(TEAMS_KEY, teams)
  notifyChange()
}

export function readTeamMembers(): TeamMember[] {
  return readStore<TeamMember[]>(TEAM_MEMBERS_KEY, [])
}

export function writeTeamMembers(members: TeamMember[]): void {
  writeStore(TEAM_MEMBERS_KEY, members)
  notifyChange()
}

export function readTeamInvites(): TeamInvite[] {
  return readStore<TeamInvite[]>(TEAM_INVITES_KEY, [])
}

export function writeTeamInvites(invites: TeamInvite[]): void {
  writeStore(TEAM_INVITES_KEY, invites)
  notifyChange()
}

export function readSubmissions(): ProjectSubmission[] {
  return readStore<ProjectSubmission[]>(SUBMISSIONS_KEY, [])
}

export function writeSubmissions(submissions: ProjectSubmission[]): void {
  writeStore(SUBMISSIONS_KEY, submissions)
  notifyChange()
}

export function readJudgingCriteria(): JudgingCriterion[] {
  return readStore<JudgingCriterion[]>(CRITERIA_KEY, [])
}

export function writeJudgingCriteria(criteria: JudgingCriterion[]): void {
  writeStore(CRITERIA_KEY, criteria)
  notifyChange()
}

export function readJudgeAssignments(): JudgeAssignment[] {
  return readStore<JudgeAssignment[]>(JUDGE_ASSIGNMENTS_KEY, [])
}

export function writeJudgeAssignments(assignments: JudgeAssignment[]): void {
  writeStore(JUDGE_ASSIGNMENTS_KEY, assignments)
  notifyChange()
}

export function readSubmissionScores(): SubmissionScore[] {
  return readStore<SubmissionScore[]>(SCORES_KEY, [])
}

export function writeSubmissionScores(scores: SubmissionScore[]): void {
  writeStore(SCORES_KEY, scores)
  notifyChange()
}

export interface StoredFileRecord extends SubmissionFile {
  bucket: string
  contentBase64?: string
  ownerId: string
}

export function readStoredFiles(): StoredFileRecord[] {
  return readStore<StoredFileRecord[]>(STORAGE_FILES_KEY, [])
}

export function writeStoredFiles(files: StoredFileRecord[]): void {
  writeStore(STORAGE_FILES_KEY, files)
  notifyChange()
}

export function readNotifications(): AppNotification[] {
  return readStore<AppNotification[]>(NOTIFICATIONS_KEY, [])
}

export function writeNotifications(notifications: AppNotification[]): void {
  writeStore(NOTIFICATIONS_KEY, notifications)
  notifyChange()
}

export function readAdminAuditLogs(): AdminAuditLog[] {
  return readStore<AdminAuditLog[]>(ADMIN_AUDIT_LOGS_KEY, [])
}

export function writeAdminAuditLogs(logs: AdminAuditLog[]): void {
  writeStore(ADMIN_AUDIT_LOGS_KEY, logs)
  notifyChange()
}


