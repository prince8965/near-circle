/** Public service API. UI code should import only from here. */
export { authAdapter, DEMO_OWNER_ID } from './authAdapter'
export type { AuthAdapter, SignUpOptions } from './authAdapter'
export {
  getEvents,
  getEventById,
  searchEvents,
  searchHackathons,
  getOrganizationCompletedEventsCount,
  getOrganizationPublicEvents,
  getOrganizerEvents,
  createEvent,
  updateEvent,
  cancelEvent,
  deleteDraftEvent,
  defaultFilters,
} from './eventService'
export { createRSVP, cancelRSVP, getMyEvents } from './rsvpService'
export type { MyEventEntry } from './rsvpService'
export { getCommunities, getCommunityById, followCommunity, unfollowCommunity } from './communityService'
export type { CommunityWithState } from './communityService'
export { getOrganizerAnalytics } from './analyticsService'
export { extractEventFromPoster } from './posterExtraction'
export { subscribeChange, getVersion } from './bus'
export {
  getCommunityPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  togglePostLike,
  getPostComments,
  createPostComment,
  deletePostComment,
  reportPost,
  getOrganizations,
  getOrganizationById,
  getOrganizationByOwnerId,
  createOrganization,
  updateOrganization,
  followOrganization,
  unfollowOrganization,
  getCurrentUserId,
} from './communityPostService'
export type { CommunityFeedOptions } from './communityPostService'
export {
  registerForEvent,
  cancelRegistration,
  getRegistrationForEvent,
  getMyRegistrations,
  getEventAttendees,
  updateAttendeeStatus,
} from './registrationService'
export {
  createTeam,
  joinTeamByInviteCode,
  getTeamForEvent,
  getTeamById,
  inviteTeamMember,
  getMyPendingInvites,
  respondToInvite,
  removeTeamMember,
  leaveTeam,
  disbandTeam,
} from './teamService'
export {
  uploadFile,
  validateFile,
  createSignedUrl,
  deleteFile,
  MAX_PUBLIC_FILE_SIZE,
  MAX_PRIVATE_FILE_SIZE,
  ALLOWED_PUBLIC_MIME_TYPES,
  ALLOWED_PRIVATE_MIME_TYPES,
} from './storageService'
export {
  getSubmissionById,
  getSubmissionForEvent,
  getEventSubmissions,
  saveDraftSubmission,
  submitProject,
  deleteSubmission,
} from './submissionService'
export {
  getJudgingCriteria,
  saveJudgingCriteria,
  assignJudge,
  removeJudgeAssignment,
  getEventJudges,
  getAssignedEventsForJudge,
  getEligibleSubmissionsForJudge,
  submitJudgeScores,
  getSubmissionScores,
  calculateEventRankings,
  publishEventResults,
  getJudgingProgress,
} from './judgingService'
export {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
  sendEventDeadlineReminders,
} from './notificationService'
export {
  getPendingVerifications,
  getAllOrganizationsForAdmin,
  requestOrganizationVerification,
  reviewOrganizationVerification,
  getAdminAuditLogs,
  resolveReportedPost,
  getPlatformAdminAnalytics,
} from './adminService'
export { geocodeMumbaiAddress } from './geocodeService'
export type { GeocodeResult } from './geocodeService'
export { supabase, isSupabaseConfigured } from '../lib/supabase'

