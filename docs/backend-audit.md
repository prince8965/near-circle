# NearCircle — Backend Audit & Gap Analysis

## 1. Executive Summary
NearCircle is a hackathon and event discovery platform inspired by platforms such as Unstop and Devpost. The current application is a frontend prototype built with React 19, TypeScript, Vite, and Tailwind CSS. The UI contains full screens for event discovery, event details, community feeds, participant pages, organizer dashboards, poster-to-event drafting, and authentication.

However, all backend operations (event storage, RSVPs, follower records, post likes/comments, and auth) are currently simulated locally in `localStorage` through `src/services/db.ts` and `src/services/authAdapter.ts`.

A Supabase migration already exists in the repository: `supabase/migrations/20261024_community_schema.sql`. This migration establishes organizations, follows, community posts, likes, comments, and reports with Row Level Security (RLS) and triggers.

The primary objective is to transform NearCircle into a functional, secure platform backed by Supabase with role-based access control (Visitors, Participants, Organizers, Judges, Admins), real database-derived analytics, public organization profiles, and hackathon workflows without breaking or discarding existing UI and styling.

---

## 2. Existing Schema Audit (`supabase/migrations/20261024_community_schema.sql`)

| Table | Current Definition & Policies | Gaps Identified |
| :--- | :--- | :--- |
| `public.organizations` | `id`, `name`, `slug`, `logo_url`, `accent_color`, `description`, `category`, `locality_id`, `website_url`, `contact_email`, `is_verified`, `follower_count`, timestamps. RLS enabled. Select is public (`true`). Modification is restricted to `auth.jwt() ->> 'role' = 'service_role'`. | No `owner_id` or link to `auth.users`. Organizers cannot modify their own organization profile under current RLS. Missing conducted/completed event statistics. |
| `public.organization_follows` | `(user_id, organization_id)`. RLS allows users to view, follow, and unfollow. | Works as designed. |
| `public.community_posts` | Author info, content, category, image URL, foreign keys to organizations/communities/events, atomic like/comment counters maintained via triggers. | References `auth.users(id)` and `public.organizations(id)`. Works well; needs live foreign key reference to real `events` table once created. |
| `public.post_likes` | `(post_id, user_id)`. Trigger maintains `likes_count`. RLS enabled. | Works as designed. |
| `public.post_comments` | `(id, post_id, author_id, content, parent_id, ...)`. Trigger maintains `comments_count`. RLS enabled. | Works as designed. |
| `public.post_reports` | `(id, post_id, reporter_id, reason, details)`. RLS restricts viewing to moderators/service_role. | Works as designed. |

### Schema Entities to be Implemented in Subsequent Migrations:
1. `public.profiles`: Links to `auth.users(id)`, storing role (`participant`, `organizer`, `judge`, `admin`), name, avatar, bio, and timestamps.
2. `public.events`: Real event table with statuses (`draft`, `published`, `completed`, `cancelled`), track options, capacity, dates, venue, coordinates, and ownership.
3. `public.event_registrations`: Atomic registrations with uniqueness constraints (`user_id`, `event_id`), status (`registered`, `cancelled`, `checked_in`), and custom answers.
4. `public.teams` & `public.team_members`: For hackathon team creation, invites, join requests, and team size limits.
5. `public.submissions`: Hackathon project submissions (title, description, demo link, repo link, media, track, team ID).
6. `public.judging_criteria`, `judging_assignments`, `scores`: For assigned judge scoring and published leaderboard results.
7. `public.notifications`: For participant updates and submission/registration alerts.

---

## 3. Frontend Architecture & Flow Audit

1. **Routing (`src/routes/AppRoutes.tsx`)**:
   - Currently, all routes are open and unguarded.
   - Any visitor can directly enter URL `/organizer`, `/organizer/create`, or `/my-events`.
   - Needs `ProtectedRoute` and `RoleGuard` wrappers to enforce:
     - Public: `/`, `/events/:id`, `/organizations/:id`, `/login`, `/signup`.
     - Participant-protected: `/community`, `/my-events`, registrations, teams, submissions.
     - Organizer-protected: `/organizer`, `/organizer/create`, `/organizer/edit/:id`, `/organizer/poster`.
     - Admin-protected: Verification and moderation.

2. **Navigation (`src/components/layout/Navbar.tsx`)**:
   - Fixed navigation array rendered regardless of user authentication or role.
   - Needs role awareness: hide Organizer Dashboard from Participants; show Organizer options only to verified/organizer accounts.

3. **Authentication Layer (`src/services/authAdapter.ts` & `src/hooks/AuthContext.tsx`)**:
   - Currently stores simulated identity in `localStorage` under `session` key.
   - Always maps user ID to `DEMO_OWNER_ID = 'u-demo'`.
   - `AuthAdapter` interface exists and can be swapped for Supabase Auth without rewriting consumer components.

4. **Data Service Layer (`src/services/`)**:
   - All components interact with data via services (`eventService.ts`, `communityPostService.ts`, `rsvpService.ts`, `analyticsService.ts`).
   - Clean architecture: queries can be progressively migrated from `db.ts` to Supabase client calls.

5. **Public Organization Profiles (`src/components/community/OrganizationProfileModal.tsx`)**:
   - Currently, organization info is displayed inside a modal in the Community feed.
   - Completed/conducted event count is not yet derived from database records.
   - Needs database query counting published past events where `status = 'completed'` or `(status = 'published' AND ends_at < now())`.

---

## 4. Security & Access Control Review

- **Browser Secret Isolation**: Frontend client variables must only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Database Row Level Security (RLS)**:
  - Permissions must be validated in PostgreSQL RLS policies or PostgreSQL functions (`auth.uid() = owner_id`, role checks in JWT / profiles).
  - Client-side navigation guards are for user experience; backend RLS is mandatory for security.
  - Organization verification cannot be self-updated by organizers (only service_role / admins).

---

## 5. Next Steps
- **Phase 2**: Configure Supabase client safely (`src/lib/supabase.ts`), update `.env.example`, Vite env declarations, and setup documentation.
- **Phase 3**: User Profiles, Roles, and Supabase Auth integration.
- **Phase 4**: Database schema for Events, Registrations, Organizations, and Public Profiles.
- **Phase 5**: Route Guards and Role-Aware Navigation.
- **Phase 6**: Teams, Submissions, Judging, and Notifications.
- **Phase 7**: End-to-end verification and testing.
