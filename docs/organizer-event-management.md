# Phase 5: Organization Profiles and Organizer Event Management

## 1. Overview
Phase 5 implements real organization profile management, verified campus credential handling, and comprehensive organizer event management for NearCircle, directly integrated with the Supabase schema and PostgreSQL Row-Level Security (RLS) policies.

---

## 2. Organization Profiles

### 2.1 Schema & Data Model
Organizations are stored in `public.organizations` with the following attributes:
- `id` (UUID, primary key)
- `name` (text, required)
- `slug` (text, unique)
- `description` (text, required)
- `category` (Category domain: Technology, AI/ML, Web Development, etc.)
- `locality_id` (Hub / Campus locality)
- `website_url` (optional public website link)
- `contact_email` (public contact email)
- `logo_url` & `accent_color` (branding visuals)
- `is_verified` (boolean, platform verification badge)
- `follower_count` (integer)
- `owner_id` (UUID references auth.users)

### 2.2 Ownership & Verification Security
1. **Ownership Enforcement**:
   - Only the organization owner (`owner_id = auth.uid()`) or platform administrators can update organization profile details.
   - Unauthorized attempts by non-owners are rejected in both backend RLS (`Owners can update their organization`) and frontend services.
2. **Anti-Self-Verification Protection**:
   - The PostgreSQL trigger `tr_protect_organization_verification` rejects any attempt by an organizer to update `is_verified`.
   - In `updateOrganization`, `is_verified` is strictly filtered out so that only authorized administrative workflows or migrations can grant official verification badges.
   - The UI displays an informative badge: *Verified Organization* for verified campus clubs, and *Pending Verification* with an advisory banner for unverified organizations.

### 2.3 Public Event History
- The `OrganizationProfileModal` provides a **Public Event History** tab.
- Concluded and completed events (`status = 'completed'` or `ends_at < now`) organized by the organization are listed, enabling students to inspect past hackathons, workshops, and attendance track records.

---

## 3. Event Management & Hackathon Features

### 3.1 Event Creation & Draft Workflow
- Organizers can save in-progress events as **drafts** (`status = 'draft'`).
- Draft saving requires only an event title, enabling iterative planning.
- Full validation is strictly enforced before publishing:
  - Title: 1 to 100 characters.
  - Description: minimum 20 characters.
  - Start / End Dates: end must be after start; new events require a future start time.
  - Mode: `in-person`, `online`, or `hybrid`.
  - Venue: venue name and physical address required for in-person or hybrid modes; virtual platform details for online mode.
  - Capacity: positive integer.
  - Price: non-negative (free switch supported).
  - Team Sizes: minimum team size $\ge 1$; maximum team size $\ge$ minimum team size.
  - Deadlines: registration deadline cannot exceed event end; submission deadline must fall between event start and conclusion.

### 3.2 Publication & Discovery Isolation
- Anonymous visitors and participants are barred from creating, editing, or publishing official events (verified by role guards and RLS policy `Organizers can create events`).
- Draft and unpublished events are strictly excluded from public discovery (`searchEvents` filter `status in ('published', 'completed')`).
- Direct access to draft preview (`getEventById`) is restricted exclusively to the event's owner or platform administrators.

### 3.3 Organizer Dashboard
- Connected to real database records via `getOrganizerAnalytics()` and `getOrganizerEvents()`.
- Distinct metrics:
  - Total Events
  - Published & Upcoming Events
  - Draft Events
  - Concluded / Completed Events
  - Total Registrations & RSVPs
- Filter tabs: **All**, **Published**, **Drafts**, **Completed**, and **Cancelled**.
- Status-specific actions:
  - Drafts: *Edit*, *Publish Now* (quick publish modal), and *Delete Draft*.
  - Published: *Edit*, *View Public Page*, and *Cancel Event*.
  - Completed / Cancelled: *View Event*.
