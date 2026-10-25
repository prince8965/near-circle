export const CATEGORIES = [
  'Technology',
  'AI/ML',
  'Web Development',
  'Music',
  'Sports',
  'Art',
  'Business',
  'Workshops',
] as const

export type Category = (typeof CATEGORIES)[number]

export type EventStatus = 'published' | 'draft' | 'completed' | 'cancelled'

export type UserRole = 'participant' | 'organizer' | 'judge' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  organizationId?: string
}

export interface Profile {
  id: string
  role: UserRole
  fullName: string
  avatarUrl?: string
  headline?: string
  bio?: string
  websiteUrl?: string
  githubUrl?: string
  linkedinUrl?: string
  skills?: string[]
  createdAt: string
  updatedAt: string
}

export interface Locality {
  id: string
  name: string
  city: string
  lat: number
  lng: number
}

export interface Event {
  id: string
  title: string
  description: string
  category: Category
  /** Data URL or remote URL. Falls back to a generated poster when empty. */
  posterUrl?: string
  /** ISO 8601 strings */
  startsAt: string
  endsAt: string
  venueName: string
  address: string
  localityId: string
  lat: number
  lng: number
  /** 0 = free */
  price: number
  capacity: number
  /** Seats already taken by other people (demo seed). The current user's RSVP is added on top. */
  baseRsvpCount: number
  /** Mock check-in count used by the demo analytics. */
  baseCheckIns: number
  organizerName: string
  ownerId: string
  organizationId?: string
  communityId?: string
  registrationUrl?: string
  status: EventStatus
  tags: string[]
  /** True for seed data shipped with the prototype. */
  isDemo: boolean

  // Extended hackathon / event fields matching core schema
  slug?: string
  mode?: 'in-person' | 'online' | 'hybrid'
  eligibility?: string
  registrationDeadline?: string
  submissionDeadline?: string
  minTeamSize?: number
  maxTeamSize?: number
  rules?: string
  prizesSummary?: string
  tracks?: string[]
  resultsPublished?: boolean
}

export interface EventWithMeta extends Event {
  /** Distance in km from the selected locality, if computable. */
  distanceKm?: number
  seatsLeft: number
  rsvpCount: number
  isRsvped: boolean
  recommendation?: string
  recommendationScore: number
}

export interface Community {
  id: string
  name: string
  description: string
  category: Category
  memberCount: number
  localityId: string
  accent: string
  isDemo: boolean
}

export interface RSVP {
  id: string
  eventId: string
  userId: string
  status: 'going' | 'cancelled'
  createdAt: string
  ticketCode: string
}

export interface OrganizerAnalytics {
  totalEvents: number
  publishedEvents: number
  draftEvents: number
  completedEvents: number
  cancelledEvents: number
  totalRsvps: number
  totalCheckIns: number
  /** 0..1 */
  attendanceRate: number
  totalRegistrations?: number
  confirmedRegistrations?: number
  checkedInRegistrations?: number
  totalSubmissions?: number
  scoredSubmissions?: number
  events?: DetailedEventAnalytics[]
  isMock?: boolean
  isRealData?: boolean
}

export type DateFilter = 'any' | 'today' | 'week' | 'weekend' | 'custom'
export type PriceFilter = 'all' | 'free' | 'paid'
export type SortKey = 'soonest' | 'nearest' | 'recommended' | 'deadline'
export type EventModeFilter = 'all' | 'in-person' | 'online' | 'hybrid'
export type TeamSizeFilter = 'all' | 'solo' | 'team'

export const POPULAR_TECHNOLOGIES = [
  'React',
  'Python',
  'AI/ML',
  'TypeScript',
  'Node.js',
  'Rust',
  'Web3',
  'Flutter',
  'Next.js',
  'Cloud',
] as const

export interface EventFilters {
  query: string
  category: Category | 'all'
  date: DateFilter
  customDate?: string
  price: PriceFilter
  /** km; 0 = any distance */
  radiusKm: number
  sort: SortKey
  localityId: string
  interests: Category[]

  // Phase 6 Hackathon / Event Discovery extensions:
  mode?: EventModeFilter
  technology?: string
  hasPrizes?: boolean
  teamSize?: TeamSizeFilter
  openRegistrationOnly?: boolean

  // Pagination
  page?: number
  pageSize?: number
}

export interface PaginatedEvents {
  events: EventWithMeta[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type EventInput = Omit<
  Event,
  'id' | 'baseRsvpCount' | 'baseCheckIns' | 'isDemo' | 'ownerId' | 'organizerName'
> & { id?: string }

export interface ExtractedField<T = string> {
  value: T
  /** 'ok' = confidently read, 'review' = ambiguous, 'missing' = not found */
  state: 'ok' | 'review' | 'missing'
  note?: string
}

export interface PosterExtraction {
  /** Always true until a real OCR/vision service is wired in. */
  isMock: boolean
  title: ExtractedField
  description: ExtractedField
  category: ExtractedField<Category | ''>
  startDate: ExtractedField
  startTime: ExtractedField
  endTime: ExtractedField
  venueName: ExtractedField
  address: ExtractedField
  price: ExtractedField
  registrationUrl: ExtractedField
}

/* ==========================================================================
   Community Section Types
   ========================================================================== */

export type CommunityTab = 'for-you' | 'following' | 'nearby' | 'organizations' | 'my-posts'
export type PostSortKey = 'newest' | 'popular'
export type AuthorRole = 'student' | 'organizer' | 'community_lead'

export interface CommunityPost {
  id: string
  authorId: string
  authorName: string
  authorAvatar?: string
  authorRole: AuthorRole
  createdAt: string
  updatedAt?: string
  content: string
  category: Category
  imageUrl?: string
  communityId?: string
  communityName?: string
  organizationId?: string
  organizationName?: string
  isOrgVerified?: boolean
  /** Attached NearCircle event */
  eventId?: string
  eventMeta?: {
    id: string
    title: string
    startsAt: string
    endsAt?: string
    venueName: string
    price: number
    posterUrl?: string
  }
  /** Custom event fields if not linking an existing event */
  customEventDate?: string
  customEventLocation?: string
  customEventLink?: string
  localityId?: string
  likesCount: number
  likedByMe?: boolean
  commentsCount: number
  isReported?: boolean
  reportReason?: string
  isDemo?: boolean
}

export interface CommunityPostInput {
  content: string
  category: Category
  imageUrl?: string
  communityId?: string
  organizationId?: string
  eventId?: string
  localityId?: string
  customEventDate?: string
  customEventLocation?: string
  customEventLink?: string
}

export interface PostComment {
  id: string
  postId: string
  authorId: string
  authorName: string
  authorAvatar?: string
  authorRole: AuthorRole
  content: string
  createdAt: string
  parentId?: string
  replyToAuthor?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string
  accentColor: string
  description: string
  category: Category
  localityId: string
  websiteUrl?: string
  contactEmail?: string
  /** Only display verified badge when isVerified is true */
  isVerified: boolean
  followerCount: number
  isFollowing?: boolean
  upcomingEventIds?: string[]
  ownerId?: string
  eventCount?: number
  completedEventsCount?: number
  upcomingEventsCount?: number
  rules?: string
  eligibility?: string
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected'
  verificationRequestedAt?: string
  verifiedAt?: string
  verifiedBy?: string
  verificationNotes?: string
  createdAt?: string
  updatedAt?: string
}

export interface PostReport {
  id: string
  postId: string
  userId: string
  reason: string
  details?: string
  createdAt: string
}

/* ==========================================================================
   Phase 7: Event Registrations & Team Management Types
   ========================================================================== */

export type RegistrationStatus = 'confirmed' | 'cancelled' | 'waitlisted' | 'checked_in'

export interface EventRegistration {
  id: string
  eventId: string
  userId: string
  status: RegistrationStatus
  ticketCode: string
  customAnswers?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface EventRegistrationWithEvent {
  registration: EventRegistration
  event: EventWithMeta
  isPast: boolean
  team?: TeamWithMembers | null
}

export interface EventRegistrationAttendee {
  registrationId: string
  userId: string
  status: RegistrationStatus
  ticketCode: string
  createdAt: string
  userFullName: string
  userEmail: string
  userAvatar?: string
  teamId?: string
  teamName?: string
  teamRole?: 'leader' | 'member'
}

export type TeamRole = 'leader' | 'member'
export type TeamInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  joinedAt: string
  user?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
}

export interface Team {
  id: string
  eventId: string
  name: string
  inviteCode: string
  leaderId: string
  createdAt: string
  updatedAt: string
}

export interface TeamWithMembers extends Team {
  members: TeamMember[]
  isLeader?: boolean
  isMember?: boolean
}

export interface TeamInvite {
  id: string
  teamId: string
  teamName?: string
  eventId?: string
  eventTitle?: string
  invitedEmail: string
  invitedUserId?: string
  status: TeamInviteStatus
  createdAt: string
}

/* ==========================================================================
   Phase 8: Project Submissions & Storage Types
   ========================================================================== */

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'winner'
  | 'disqualified'

export interface SubmissionFile {
  id: string
  name: string
  sizeBytes: number
  mimeType: string
  storagePath: string
  url?: string
  uploadedAt: string
  isPrivate: boolean
}

export interface ProjectSubmission {
  id: string
  eventId: string
  teamId?: string
  teamName?: string
  submitterId: string
  submitterName?: string
  submitterAvatar?: string
  trackId?: string
  trackTitle?: string
  title: string
  tagline?: string
  description: string
  demoUrl?: string
  repoUrl?: string
  videoUrl?: string
  coverImageUrl?: string
  technologies: string[]
  files: SubmissionFile[]
  status: SubmissionStatus
  isPublic: boolean
  submittedAt?: string
  feedbackSummary?: string
  createdAt: string
  updatedAt: string

  // Computed/judging fields
  averageScore?: number
  weightedTotalScore?: number
  rank?: number
}

export interface StorageUploadResult {
  path: string
  publicUrl?: string
  signedUrl?: string
}

/* ==========================================================================
   Phase 9: Judging, Scoring & Leaderboard Types
   ========================================================================== */

export interface JudgingCriterion {
  id: string
  eventId: string
  title: string
  description?: string
  weight: number
  maxScore: number
  displayOrder: number
  createdAt: string
}

export interface JudgeAssignment {
  id: string
  eventId: string
  judgeId: string
  judgeName?: string
  judgeEmail?: string
  judgeAvatar?: string
  trackId?: string
  trackTitle?: string
  createdAt: string
}

export interface SubmissionScore {
  id: string
  submissionId: string
  judgeId: string
  judgeName?: string
  criterionId: string
  criterionTitle?: string
  score: number
  feedback?: string
  createdAt: string
  updatedAt: string
}

export interface CriterionScoreBreakdown {
  criterionId: string
  criterionTitle: string
  weight: number
  maxScore: number
  averageScore: number
}

export interface SubmissionRanking {
  submissionId: string
  title: string
  teamId?: string
  teamName?: string
  submitterId: string
  submitterName?: string
  trackId?: string
  trackTitle?: string
  totalWeightedScore: number
  normalizedPercentage: number
  judgesCount: number
  submittedAt?: string
  rank: number
  criteriaBreakdown?: CriterionScoreBreakdown[]
  isWinner?: boolean
}

export interface JudgingProgress {
  totalSubmissions: number
  scoredSubmissions: number
  totalJudges: number
  isComplete: boolean
  resultsPublished: boolean
}

/* ==========================================================================
   Phase 10: Notifications, Administration & Analytics Types
   ========================================================================== */

export type NotificationType =
  | 'registration_confirmed'
  | 'registration_status_changed'
  | 'team_invitation'
  | 'team_joined'
  | 'submission_created'
  | 'submission_status_changed'
  | 'deadline_reminder'
  | 'judging_assigned'
  | 'results_published'
  | 'verification_status'
  | 'system'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string
  data?: Record<string, any>
  isRead: boolean
  createdAt: string
}

export interface AdminAuditLog {
  id: string
  adminId: string
  adminName: string
  action:
    | 'approve_verification'
    | 'reject_verification'
    | 'moderate_post'
    | 'dismiss_report'
    | 'update_user_role'
  targetType: 'organization' | 'community_post' | 'user'
  targetId: string
  targetName?: string
  details?: string
  createdAt: string
}

export interface DetailedEventAnalytics {
  eventId: string
  eventTitle: string
  status: EventStatus
  isPublished: boolean
  isCompleted: boolean
  totalRegistrations: number
  confirmedRegistrations: number
  checkedInRegistrations: number
  attendanceRate: number
  totalSubmissions: number
  scoredSubmissions: number
  resultsPublished: boolean
}

export interface ComprehensiveOrganizerAnalytics {
  totalEvents: number
  publishedEvents: number
  draftEvents: number
  completedEvents: number
  cancelledEvents: number
  totalRegistrations: number
  confirmedRegistrations: number
  checkedInRegistrations: number
  attendanceRate: number
  totalSubmissions: number
  scoredSubmissions: number
  events: DetailedEventAnalytics[]
  isRealData: boolean
}

export interface PlatformAdminAnalytics {
  totalUsers: number
  totalOrganizations: number
  verifiedOrganizations: number
  pendingVerifications: number
  totalEvents: number
  activeEvents: number
  completedEvents: number
  totalRegistrations: number
  totalSubmissions: number
  totalReports: number
}

