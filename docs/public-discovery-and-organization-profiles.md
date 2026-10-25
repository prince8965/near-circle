# Phase 6: Real Event Discovery and Public Organization Profiles

## 1. Executive Overview
Phase 6 connects NearCircle's discovery and organization systems directly to real database records in Supabase. It allows anonymous visitors to freely discover public campus events and inspect public organization profiles without signing in, while strictly protecting unpublished drafts, private organizer details, and ensuring real database-derived analytics.

---

## 2. Public Event Discovery Architecture

### 2.1 Backend Data Connection & Anti-Mock Isolation
- Real Supabase queries target `public.events` directly when environment variables are configured.
- When Supabase is configured, fake demo records are strictly prohibited from polluting real results. Empty search results accurately return empty arrays rather than injecting synthetic mock entries.
- In offline prototype fallback mode, demo events are explicitly marked with `isDemo: true` and excluded from completed event counters.

### 2.2 Discovery Filters & Sorting
The discovery engine supports rich, multi-dimensional filtering tailored to student hackathons and campus meetups:
1. **Category / Domain**:
   - Filter across official domains: Technology, AI/ML, Web Development, Music, Sports, Art, Business, Workshops.
2. **Event Mode**:
   - `all`, `in-person`, `online`, `hybrid`.
   - Online events are recognized as virtually accessible without geographical travel constraints.
3. **Technologies & Tags**:
   - Interactive tag filter with one-tap chips for popular technologies (React, Python, AI/ML, TypeScript, Node.js, Rust, Web3, Next.js, Cloud, Flutter).
   - Backed by PostgreSQL GIN indexing on `public.events.tags`.
4. **Location & Distance Radius**:
   - Configurable radius: Any distance, Within 2 km, 5 km, 10 km, 20 km from the selected campus locality.
5. **Registration Deadline**:
   - "Open Registrations Only" filter hiding events whose registration deadline has already expired.
6. **Cash Prizes & Rewards**:
   - Filter for events featuring cash bounties, tracks, or prize pools.
7. **Team-Size Limits**:
   - `all`, `Solo (1 member)`, `Teams (2+ members)`.
8. **Sorting Options**:
   - `recommended`: Ranks events based on user interest categories, distance proximity, and urgency.
   - `soonest`: Earliest start date ascending.
   - `deadline`: Registration deadline closing soonest.
   - `nearest`: Geographical proximity ascending.

### 2.3 Pagination & UI States
- Page size: 9 events per page.
- Pagination controls: Display active ranges ("Showing 1 to 9 of 18 events"), previous/next pagination buttons, and numbered page navigation.
- Smooth scroll to results on page or category change.
- Filter changes automatically reset pagination to Page 1.
- Complete handling of Loading (skeletons), Error (with retry), and Empty states ("No events match your filters").

---

## 3. Public Organization Profiles

### 3.1 Dedicated Public Route (`/organizations/:id`)
Visitors and participants can view public organization profiles directly without requiring authentication.
- **Visual Branding**: Organization accent color gradient, avatar/logo, category icon.
- **Platform Verification**: Verified campus organization badge with tooltip, strictly protected from unauthorized modification.
- **Locality & Contact**: Campus locality, city, public website link, and public contact email.
- **Interactive Follow**: Real-time follow / unfollow button with notification toast and login prompt for anonymous visitors.

### 3.2 Public Event Tabs
1. **Upcoming Events**: All published future events organized by this club or organization (`status = 'published'`, `ends_at >= now()`).
2. **Past & Concluded Events**: Real concluded hackathons and workshops meeting eligible completed status criteria. Concluded events display an emerald status chip.
3. **Community Posts**: Community posts published by the organization.
4. **About Organization**: Description, participation guidelines, eligibility rules, and official contact information.

### 3.3 Event Details Page Integration
- In `EventDetailsPage.tsx`, the Organizer section displays an interactive Organization Card.
- Displays organization name, verified status badge, follower count, and the real conducted event count.
- Provides a direct link: **"Inspect Organization Profile →"** directing users to `/organizations/:id`.

---

## 4. Completed / Conducted Event Count Criteria

### 4.1 Strict Eligible Status Criteria
An event record is eligible to be counted as a completed or conducted organization event if and only if:
1. **Organization Association**: `organization_id = organization.id`.
2. **Real Database Record**: `is_demo = false` (fictional prototype records are strictly excluded).
3. **Non-Draft**: `status != 'draft'` (unpublished planning drafts are excluded).
4. **Non-Cancelled**: `status != 'cancelled'` (events called off by organizers are excluded).
5. **Concluded**: Either `status = 'completed'` OR (`status = 'published'` AND `ends_at < now()`).

### 4.2 Database Function Implementation
Implemented in `supabase/migrations/20261025_phase6_discovery_and_organizations.sql`:
```sql
create or replace function public.get_organization_completed_count(org_id uuid)
returns integer as $$
  select count(*)::integer
  from public.events
  where organization_id = org_id
    and is_demo = false
    and status not in ('draft', 'cancelled')
    and (status = 'completed' or (status = 'published' and ends_at < now()));
$$ language sql stable security definer;
```

---

## 5. Security & Authorization

### 5.1 Backend Row-Level Security (RLS) Isolation
Direct backend queries by anonymous visitors or unauthorized participants are governed by PostgreSQL Row-Level Security:
```sql
create policy "Published events are viewable by everyone"
  on public.events for select
  using (
    status in ('published', 'completed')
    or (auth.uid() is not null and auth.uid() = owner_id)
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
```
- **Draft Isolation**: Any direct query to `public.events` requesting `status = 'draft'` by an anonymous client or participant returns 0 rows. Drafts are never leaked to unauthenticated users.
- **Service Layer Authorization**: `getEventById` verifies caller identity before returning any draft preview. Anonymous queries for drafts return `null`.

### 5.2 Protection of Private Organizer Information
- Organization profiles expose only public attributes (`name`, `slug`, `description`, `category`, `locality_id`, `website_url`, `contact_email`, `is_verified`, `follower_count`, `accent_color`, `logo_url`).
- Internal user credentials, `owner_id` relationships, internal user emails, and draft event rosters are strictly excluded from public API responses.

---

## 6. Automated Test Suite Results

The automated test suite (`scripts/test-phase6.ts`) executed via `npm test` verified 12 assertions:
1. `Anonymous visitor can search and browse published public events without signing in`: **PASSED**
2. `Anonymous visitor cannot retrieve draft event by direct ID query`: **PASSED**
3. `Unauthorized participant cannot view draft event belonging to another organizer`: **PASSED**
4. `Event owner organizer CAN preview their own draft event`: **PASSED**
5. `Calculates completed event count strictly from real database records (excluding drafts, cancelled, and mock records)`: **PASSED**
6. `Public organization profile displays real upcoming and past events without leaking private data`: **PASSED**
7. `Filters by event mode (in-person vs online)`: **PASSED**
8. `Filters by technology tags`: **PASSED**
9. `Filters by cash prizes & rewards`: **PASSED**
10. `Filters by team-size limits (solo vs teams)`: **PASSED**
11. `Accurately computes pagination and slices records`: **PASSED**
12. `Direct backend query without authentication rejects access to draft/private records (RLS enforcement)`: **PASSED**
