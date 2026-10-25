# Changelog

All notable changes to the NearCircle project are documented in this file.

---

## [Phase 11] - NearCircle Production Readiness and Security Audit (2026-10-25)

### Added
- `docs/production-readiness.md`:
  - Complete security audit, access control matrix across all 5 user roles, Supabase configuration guide, migration execution order, and production deployment checklist.

### Verified
- Automated testing across all 11 phases with 57 tests passing at 100% success rate (`npm test`).
- Zero TypeScript compiler errors (`npm run typecheck`).
- Production bundle compiled with Vite in ~1.2s (`npm run build`).
- Row-Level Security (RLS) policies, concurrency row-level locking, and zero self-approval verification safeguards.

---

## [Phase 10] - Notifications, Administration, Verification, and Analytics (2026-10-25)

### Added
- `src/services/notificationService.ts`:
  - In-app notification engine supporting `getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`, `createNotification`, and `sendEventDeadlineReminders`.
  - Enforces notification ownership isolation, deduplication within 5-minute window, and server-side email dispatch architecture notes.
- `src/services/adminService.ts`:
  - Dedicated administrative service implementing `getPendingVerifications`, `getAllOrganizationsForAdmin`, `requestOrganizationVerification`, `reviewOrganizationVerification`, `getAdminAuditLogs`, `resolveReportedPost`, and `getPlatformAdminAnalytics`.
  - Enforces role validation (`admin` only), strict self-approval prevention (organization owners cannot approve their own organizations), and immutable audit logging.
- `src/components/notifications/NotificationBell.tsx`:
  - Interactive notification bell in main navigation with real-time unread counter, dropdown notification center, relative timestamps, and one-click mark-as-read.
- `src/pages/AdminDashboardPage.tsx`:
  - Dedicated administrative dashboard accessible at `/admin` for verified badge moderation, audit log inspection, and platform analytics.
- `supabase/migrations/20261025_phase10_notifications_admin_analytics.sql`:
  - Schema migration for `notifications`, `admin_audit_logs`, organization verification tracking columns, and `review_organization_verification` RPC.
- `scripts/test-phase10.ts`:
  - Automated test suite validating notification ownership, workflow notifications (registration, cancellation, team, deadline), admin role enforcement, self-approval prevention, audit log creation, and database-derived analytics (14/14 passed).

### Modified
- `src/types/index.ts`:
  - Added `NotificationType`, `AppNotification`, `AdminAuditLog`, `DetailedEventAnalytics`, `ComprehensiveOrganizerAnalytics`, and `PlatformAdminAnalytics`.
  - Added verification tracking fields on `Organization`.
- `src/services/db.ts`:
  - Added stores and readers/writers for `notifications.v1` and `admin_audit_logs.v1`.
- `src/services/analyticsService.ts`:
  - Upgraded to compute real database-derived metrics, strict completed event counting rules (excluding drafts and cancelled events), attendance rate calculation, and cross-organization isolation.
- `src/services/registrationService.ts` & `src/services/teamService.ts`:
  - Integrated automated notification dispatch on registration, cancellation, and team events.
- `src/pages/OrganizerDashboardPage.tsx`:
  - Added "Request Campus Verification" action and real database analytics rendering.
- `src/components/layout/Navbar.tsx`:
  - Integrated `NotificationBell` and added "Admin Portal" navigation item for administrators.
- `src/routes/AppRoutes.tsx`:
  - Added protected `/admin` route with `RoleGuard allowedRoles={['admin']}`.
- `scripts/run-all-tests.ts`:
  - Updated master test runner to execute Phase 6, Phase 7, Phase 8/9, and Phase 10 sequentially.

---

## [Phase 8 & 9] - Project Submissions, Supabase Storage, and Judging/Scoring (2026-10-25)

### Added
- `src/services/storageService.ts`:
  - Dedicated storage service implementing `validateFile`, `uploadFile`, `createSignedUrl`, and `deleteFile`.
  - Enforces bucket boundaries: `public-assets` (public read, 5MB limit, images only) and `project-submissions` (private, signed URLs, 25MB limit, docs, videos, archives).
  - Implements signed URL token generation and prevents unauthorized overwriting or file deletion.
- `src/services/submissionService.ts`:
  - Dedicated submission workflow service implementing `getSubmissionById`, `getSubmissionForEvent`, `getEventSubmissions`, `saveDraftSubmission`, `submitProject`, and `deleteSubmission`.
  - Enforces registration prerequisite, team vs solo linkage, deadline enforcement, completion validation, and post-deadline lock.
- `src/services/judgingService.ts`:
  - Dedicated judging and scoring service implementing `getJudgingCriteria`, `saveJudgingCriteria`, `assignJudge`, `removeJudgeAssignment`, `getEventJudges`, `getAssignedEventsForJudge`, `getEligibleSubmissionsForJudge`, `submitJudgeScores`, `getSubmissionScores`, `calculateEventRankings`, `publishEventResults`, and `getJudgingProgress`.
  - Implements multi-judge weighted criteria calculations, normalized percentages, deterministic tie-breaking (highest-weight criterion -> earlier submittedAt), and result publication privacy controls.
- `supabase/migrations/20261025_phase8_phase9_submissions_and_judging.sql`:
  - Database schema enhancements: added `results_published` flag to `events`, `file_urls` and `feedback_summary` to `submissions`.
  - Database triggers: `tr_validate_submission_rules` (registration prerequisite and deadline constraint), `tr_validate_submission_score` (bounds check 0 <= score <= max_score).
  - Stored procedures: `calculate_event_rankings` and `set_event_results_published`.
  - Storage bucket definitions and RLS policies on `storage.objects` for `public-assets` and `project-submissions`.
- `src/pages/ProjectSubmissionPage.tsx`:
  - Project submission portal with draft saving, file attachment uploads to private storage, signed URL downloads, technology tagging, and deadline enforcement.
- `src/components/judging/ScoreSubmissionModal.tsx`:
  - Judge evaluation rubric modal with interactive score sliders, live weighted score preview, criteria weights, and private feedback.
- `src/pages/JudgeDashboardPage.tsx`:
  - Judge portal displaying assigned events, evaluation progress metrics, submission review cards, and scoring modal triggers.
- `src/components/judging/OrganizerJudgingTab.tsx` & `OrganizerJudgingModal.tsx`:
  - Organizer judging management interface with criteria setup, weight configuration, judge assignments, live rankings preview, and result publication toggle.
- `src/components/events/EventSubmissionsTab.tsx`:
  - Event details tab featuring the official Winner Podium and Leaderboard when results are published, as well as submission CTA cards for registered participants.
- `scripts/test-phase8-9.ts`:
  - Automated test suite covering storage validation, signed URLs, draft saving, team vs solo submission association, deadline enforcement, judge isolation, score bounds, weighted ranking calculations, tie-breaking, and result publication protection (18/18 passed).
- `docs/project-submissions-and-judging.md`:
  - Comprehensive technical architecture, storage manual configuration guide, ranking formulas, and authorization specifications.

### Modified
- `src/types/index.ts`:
  - Added types: `SubmissionStatus`, `SubmissionFile`, `ProjectSubmission`, `StorageUploadResult`, `JudgingCriterion`, `JudgeAssignment`, `SubmissionScore`, `CriterionScoreBreakdown`, `SubmissionRanking`, `JudgingProgress`, and `resultsPublished?: boolean` on `Event`.
- `src/services/db.ts`:
  - Added persistent table stores for `submissions.v1`, `judging_criteria.v1`, `judge_assignments.v1`, `submission_scores.v1`, and `storage_files.v1`.
- `src/pages/EventDetailsPage.tsx`:
  - Integrated `EventSubmissionsTab` with live submission counts and results status.
- `src/pages/OrganizerDashboardPage.tsx`:
  - Added "Judging" action button and integrated `OrganizerJudgingModal`.
- `src/routes/AppRoutes.tsx`:
  - Added routes for `/events/:id/submit` (`ProjectSubmissionPage`) and `/judge` (`JudgeDashboardPage`).
- `src/components/layout/Navbar.tsx`:
  - Added navigation link for "Judge Portal" accessible to judges and organizers.
- `scripts/run-all-tests.ts`:
  - Updated master test runner to execute Phase 6, Phase 7, and Phase 8/9 sequentially.

---

## [Phase 7] - Event Registrations and Team Management (2026-10-25)

### Added
- `src/services/registrationService.ts`:
  - Dedicated service implementing `registerForEvent`, `cancelRegistration`, `getRegistrationForEvent`, `getMyRegistrations`, `getEventAttendees`, and `updateAttendeeStatus`.
  - Enforces publication status, registration deadlines, capacity checks, duplicate prevention, and attendee roster isolation.
- `src/services/teamService.ts`:
  - Dedicated team management service implementing `createTeam`, `joinTeamByInviteCode`, `getTeamForEvent`, `getTeamById`, `inviteTeamMember`, `respondToInvite`, `removeTeamMember`, `leaveTeam`, and `disbandTeam`.
  - Enforces minimum/maximum team size limits, unique team names, invite code generation, duplicate cross-team event membership prevention, and leader privileges.
- `supabase/migrations/20261025_phase7_registrations_and_teams.sql`:
  - Database trigger `tr_validate_event_team_membership` preventing duplicate memberships across different teams for the same hackathon.
  - Stored procedures: `register_for_event`, `cancel_event_registration`, `create_event_team`, `join_team_by_code`, and `get_event_attendees`.
- `src/components/events/RegistrationModal.tsx`:
  - Interactive registration modal verifying eligibility rules, custom questions, ticket issuance, and deadline enforcement.
- `src/components/teams/TeamSection.tsx`:
  - Embedded team management interface on Event Details page supporting team creation, invite codes, member rosters, and leadership actions.
- `src/components/events/AttendeeListModal.tsx`:
  - Organizer-only attendee roster with participant details, ticket codes, team affiliations, search filtering, and check-in status toggling.
- `scripts/test-phase7.ts`:
  - Automated test suite validating duplicate registration prevention, deadline enforcement, capacity limits, team size limits, duplicate membership prevention, leader authorization, and organizer attendee access isolation (13/13 passed).
- `scripts/run-all-tests.ts`:
  - Master test runner executing all Phase 6 and Phase 7 test suites sequentially in isolated processes.
- `docs/event-registrations-and-team-management.md`:
  - Architectural and security documentation for Phase 7.

### Modified
- `src/types/index.ts`:
  - Added `RegistrationStatus`, `EventRegistration`, `EventRegistrationWithEvent`, `EventRegistrationAttendee`, `TeamRole`, `TeamMember`, `Team`, `TeamWithMembers`, and `TeamInvite`.
- `src/services/db.ts`:
  - Added persistent table stores for `event_registrations.v1`, `teams.v1`, `team_members.v1`, and `team_invites.v1`.
- `src/services/rsvpService.ts`:
  - Seamlessly rewired to delegate to `registrationService.ts` maintaining 100% backward compatibility.
- `src/pages/EventDetailsPage.tsx`:
  - Integrated `TeamSection`, active digital pass ticket badge, and `RegistrationModal`.
- `src/pages/MyEventsPage.tsx`:
  - Upgraded to display real confirmed registrations, digital tickets, QR code passes, and attached team details with cancellation support.
- `src/pages/OrganizerDashboardPage.tsx`:
  - Added "Attendees" roster action button and integrated `AttendeeListModal`.

---

## [Phase 6] - Real Event Discovery and Public Organization Profiles (2026-10-25)

### Added
- `src/pages/OrganizationProfilePage.tsx`:
  - Dedicated public organization profile page accessible without authentication (`/organizations/:id`).
  - Displays organization branding, verified campus credentials, completed/conducted event counts, upcoming published events, and concluded past event history.
- `supabase/migrations/20261025_phase6_discovery_and_organizations.sql`:
  - Migration adding `mode` check constraint, GIN indexes for technology tag filtering, composite indexes for discovery sorting, strict `get_organization_completed_count` function, and RLS policies isolating drafts.
- `scripts/test-phase6.ts`:
  - Comprehensive automated test suite verifying anonymous discovery, draft isolation, completed count calculation, multi-dimensional filters, pagination, and backend RLS enforcement.
- `docs/public-discovery-and-organization-profiles.md`:
  - Architectural, security, and schema documentation for Phase 6.

### Modified
- `src/types/index.ts`:
  - Extended `EventFilters` with `mode`, `technology`, `hasPrizes`, `teamSize`, `openRegistrationOnly`, `page`, and `pageSize`.
  - Added `PaginatedEvents`, `EventModeFilter`, `TeamSizeFilter`, and `POPULAR_TECHNOLOGIES`.
  - Added `completedEventsCount` and `upcomingEventsCount` to `Organization`.
- `src/services/eventService.ts`:
  - Implemented `searchHackathons()` returning paginated event results (`PaginatedEvents`) from real Supabase records.
  - Implemented `getOrganizationCompletedEventsCount()` with strict eligibility criteria (excluding drafts, cancelled, and mock records).
  - Implemented `getOrganizationPublicEvents()` retrieving upcoming published events and concluded past events.
  - Hardened `getEventById()` to forbid anonymous visitors and non-owner participants from accessing draft events.
- `src/components/events/FilterPanel.tsx`:
  - Added filters for Event Mode (`in-person`, `online`, `hybrid`), Technologies & Tags, Team Size Limits (Solo vs Teams), Open Registrations Only, and Cash Prizes.
  - Added sorting by Registration Deadline.
- `src/pages/DiscoverPage.tsx`:
  - Wired `searchHackathons` with real data, active count indicator, responsive layout preservation, and pagination controls.
- `src/pages/EventDetailsPage.tsx`:
  - Enhanced Organizer section with interactive Organization Card displaying logo, verified badge, conducted event count, follower count, and link to inspect organization profile.
- `src/components/events/EventCard.tsx`:
  - Added event mode badge, prize badge, and technology tag indicators.
- `src/routes/AppRoutes.tsx`:
  - Registered `/organizations/:id` as a public route.
- `src/components/community/OrganizationProfileModal.tsx`:
  - Updated to query real public organization events via `getOrganizationPublicEvents`.

---

## [Phase 5] - Organization Profiles and Organizer Event Management (2026-10-24)

### Added
- `src/components/organization/EditOrganizationModal.tsx`:
  - Modal allowing organization owners to edit organization name, description, category, locality, website URL, public contact email, accent color, and logo.
  - Built-in anti-tamper indicator explaining that verification status is granted solely by platform administrators.
- `docs/organizer-event-management.md`: Comprehensive technical and security documentation for Phase 5.
- Support for hackathon and event fields:
  - `mode`: in-person, online, or hybrid.
  - `minTeamSize` and `maxTeamSize`: team capacity constraints with integrity validation.
  - `registrationDeadline` and `submissionDeadline`: deadline constraints.
  - `rules`: rules and code of conduct.
  - `prizesSummary`: prize pool breakdown.
  - `tracks`: domain/theme tracks.
- Public event history:
  - Added "Public Event History" tab in `OrganizationProfileModal.tsx` listing concluded and completed events.
  - Owner-aware header providing an "Edit Profile" action for authorized owners.

### Modified
- `src/types/index.ts`:
  - Extended `EventStatus` to include `'completed'`.
  - Added hackathon and organization fields to `Event`, `Organization`, and `OrganizerAnalytics`.
- `src/components/forms/eventFormModel.ts`:
  - Extended `EventFormValues` with mode, team sizes, deadlines, rules, prizes, and tracks.
  - Enhanced `validateEventForm` with team size checks and deadline ordering checks.
- `src/components/forms/CreateEventForm.tsx`:
  - Added Mode selector (In-Person / Online / Hybrid), Hackathon Configuration section (team limits, deadlines, tracks, prizes, rules).
- `src/services/eventService.ts`:
  - Wired real Supabase CRUD operations (`createEvent`, `updateEvent`, `cancelEvent`, `deleteDraftEvent`, `getOrganizerEvents`, `searchEvents`, `getEventById`).
  - Added authorization check: anonymous visitors and participants cannot create, edit, or publish events.
  - Added draft visibility protection: drafts are excluded from discovery and accessible only to owners and admins.
- `src/services/communityPostService.ts`:
  - Implemented `getOrganizationByOwnerId`, `createOrganization`, and `updateOrganization`.
  - Enforced ownership verification and prohibited self-modification of `is_verified`.
- `src/services/analyticsService.ts`:
  - Connected `getOrganizerAnalytics()` to real database events and records, computing live published, draft, completed, and registration numbers.
- `src/pages/OrganizerDashboardPage.tsx`:
  - Added Organization Profile header card with verification badge, category, follower count, and Edit/View actions.
  - Added filter sub-tabs (All, Published, Drafts, Completed, Cancelled).
  - Added draft quick-publish and delete modals.
- `src/pages/EventDetailsPage.tsx`:
  - Added rendering for event mode, team sizes, deadlines, prizes summary, rules, and tracks.
- `src/pages/CreateEventPage.tsx` and `src/pages/EditEventPage.tsx`:
  - Updated notes to reflect active database persistence.

---

## [Phase 4] - Supabase Authentication & Role-Based Access Control (2026-10-24)

### Added
- `src/pages/UnauthorizedPage.tsx`: Access denied screen.
- `src/routes/ProtectedRoute.tsx`: Authentication session guard.
- `src/routes/RoleGuard.tsx`: Role verification guard for routes.
- `docs/authentication-implementation.md`: Walkthrough of authentication and RBAC.

### Modified
- `src/services/authAdapter.ts`: Full Supabase Auth integration, session management, and role synchronization with `public.profiles`.
- `src/hooks/AuthContext.tsx`: Role flags (`isOrganizer`, `isParticipant`, `isJudge`, `isAdmin`).
- `src/pages/AuthPage.tsx`: Account-type selector (Participant vs Organizer) with organization name onboarding and password recovery.
- `src/routes/AppRoutes.tsx`: Protected organizer and participant routes.
- `src/components/layout/Navbar.tsx`: Role-aware dynamic navigation.

---

## [Phase 3] - NearCircle Core Database Schema (2026-10-24)

### Added
- `supabase/migrations/20261025_nearcircle_core_schema.sql`: Core schema migration for profiles, organizations, events, tracks, prizes, teams, submissions, judging, notifications, and audit logs.
- `docs/database-design.md`: Architecture diagrams and RLS documentation.
