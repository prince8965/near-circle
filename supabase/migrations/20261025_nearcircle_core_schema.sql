-- NearCircle Core Schema: Profiles, Events, Registrations, Teams, Submissions, Judging & Audit
-- Migration: supabase/migrations/20261025_nearcircle_core_schema.sql
-- Dependencies: Preserves and builds on 20261024_community_schema.sql

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

/* ==========================================================================
   1. User Profiles & Account Roles
   ========================================================================== */
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('participant', 'organizer', 'judge', 'admin')),
  full_name text not null,
  avatar_url text,
  headline text,
  bio text,
  website_url text,
  github_url text,
  linkedin_url text,
  skills text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Read policy: Anyone authenticated can view public profiles
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Insert policy: Handled automatically by trigger or user inserting their own profile
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Update policy: Users can update their profile information
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent unauthorized role escalation trigger
create or replace function public.protect_profile_role()
returns trigger as $$
begin
  -- Prevent changing role unless caller is service_role or admin
  if (NEW.role is distinct from OLD.role) then
    if (auth.jwt() ->> 'role' != 'service_role' and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )) then
      raise exception 'Unauthorized: Users cannot change their own account role.';
    end if;
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger tr_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Auto-provision profile on auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  desired_role text;
begin
  desired_role := coalesce(new.raw_user_meta_data->>'role', 'participant');
  -- Restrict initial signup to participant or organizer (admin/judge must be granted)
  if desired_role not in ('participant', 'organizer') then
    desired_role := 'participant';
  end if;

  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    desired_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


/* ==========================================================================
   2. Organizations Extension (Preserves existing table & adds owner/security)
   ========================================================================== */
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  accent_color text not null default '#00F2FE',
  description text not null,
  category text not null,
  locality_id text not null,
  website_url text,
  contact_email text,
  is_verified boolean not null default false,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

alter table public.organizations
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists idx_organizations_owner_id on public.organizations(owner_id);

-- Add policy allowing authenticated organizers to register their organization
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'Organizers can create organizations'
  ) then
    create policy "Organizers can create organizations"
      on public.organizations for insert
      with check (
        auth.uid() is not null
        and (owner_id = auth.uid() or owner_id is null)
      );
  end if;
end $$;

-- Add policy allowing owners to edit their own organization
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname = 'Owners can update their organization'
  ) then
    create policy "Owners can update their organization"
      on public.organizations for update
      using (auth.uid() = owner_id or auth.jwt() ->> 'role' = 'service_role')
      with check (auth.uid() = owner_id or auth.jwt() ->> 'role' = 'service_role');
  end if;
end $$;

-- Prevent organizers from self-verifying organizations
create or replace function public.protect_organization_verification()
returns trigger as $$
begin
  if (NEW.is_verified is distinct from OLD.is_verified) then
    if (auth.jwt() ->> 'role' != 'service_role' and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )) then
      raise exception 'Unauthorized: Only platform administrators can modify organization verification status.';
    end if;
  end if;
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger tr_protect_organization_verification
  before update on public.organizations
  for each row execute function public.protect_organization_verification();


/* ==========================================================================
   3. Events / Hackathons Table
   ========================================================================== */
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null check (char_length(trim(title)) > 0),
  description text not null,
  category text not null,
  poster_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null,
  address text not null,
  locality_id text not null,
  lat double precision not null default 0,
  lng double precision not null default 0,
  price numeric(10, 2) not null default 0 check (price >= 0),
  capacity integer not null default 0 check (capacity >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'completed', 'cancelled')),
  owner_id uuid references auth.users(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete set null,
  organizer_name text not null,
  community_id text,
  registration_url text,
  registration_deadline timestamptz,
  submission_deadline timestamptz,
  min_team_size integer not null default 1 check (min_team_size >= 1),
  max_team_size integer not null default 4 check (max_team_size >= min_team_size),
  rules text,
  prizes_summary text,
  tags text[] not null default array[]::text[],
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_event_dates check (ends_at >= starts_at)
);

alter table public.events enable row level security;

-- Read policy: Public can read published/completed events; owners can read their drafts
create policy "Published events are viewable by everyone"
  on public.events for select
  using (
    status in ('published', 'completed')
    or auth.uid() = owner_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Insert policy: Authenticated users can create events as owner
create policy "Organizers can create events"
  on public.events for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('organizer', 'admin')
    )
  );

-- Update policy: Event owners can update their events
create policy "Event owners can update their own events"
  on public.events for update
  using (auth.uid() = owner_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (auth.uid() = owner_id or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Delete policy: Event owners or admins can delete drafts
create policy "Event owners can delete their own draft events"
  on public.events for delete
  using (
    (auth.uid() = owner_id and status = 'draft')
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


/* ==========================================================================
   4. Organization Completed/Conducted Events Counter Function
   ========================================================================== */
-- Database-derived count of conducted/completed events based on real records
create or replace function public.get_organization_completed_count(org_id uuid)
returns integer as $$
  select count(*)::integer
  from public.events
  where organization_id = org_id
    and (status = 'completed' or (status = 'published' and ends_at < now()));
$$ language sql stable security definer;


/* ==========================================================================
   5. Event Tracks & Prizes
   ========================================================================== */
create table if not exists public.event_tracks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  prize_pool text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_tracks enable row level security;

create policy "Event tracks are viewable by everyone"
  on public.event_tracks for select
  using (true);

create policy "Event owners can manage event tracks"
  on public.event_tracks for all
  using (
    exists (
      select 1 from public.events
      where events.id = event_tracks.event_id and events.owner_id = auth.uid()
    )
  );

create table if not exists public.event_prizes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  track_id uuid references public.event_tracks(id) on delete set null,
  title text not null,
  reward_amount numeric(10, 2) default 0,
  reward_currency text not null default 'INR',
  description text,
  created_at timestamptz not null default now()
);

alter table public.event_prizes enable row level security;

create policy "Prizes are viewable by everyone"
  on public.event_prizes for select
  using (true);

create policy "Event owners can manage prizes"
  on public.event_prizes for all
  using (
    exists (
      select 1 from public.events
      where events.id = event_prizes.event_id and events.owner_id = auth.uid()
    )
  );


/* ==========================================================================
   6. Registration Questions & Participant Registrations
   ========================================================================== */
create table if not exists public.registration_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  prompt text not null check (char_length(trim(prompt)) > 0),
  question_type text not null default 'text' check (question_type in ('text', 'textarea', 'choice', 'checkbox', 'file')),
  options jsonb,
  is_required boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.registration_questions enable row level security;

create policy "Questions are viewable by everyone"
  on public.registration_questions for select
  using (true);

create policy "Event owners can manage questions"
  on public.registration_questions for all
  using (
    exists (
      select 1 from public.events
      where events.id = registration_questions.event_id and events.owner_id = auth.uid()
    )
  );

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'waitlisted', 'checked_in')),
  ticket_code text unique not null,
  custom_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

alter table public.event_registrations enable row level security;

-- Read policy: Participants can view their own registrations; Organizers can view registrations for their own events
create policy "Participants can view their own registrations"
  on public.event_registrations for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.events
      where events.id = event_registrations.event_id and events.owner_id = auth.uid()
    )
  );

-- Insert policy: Authenticated participants can register for open published events
create policy "Participants can register for events"
  on public.event_registrations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.events
      where events.id = event_registrations.event_id
        and events.status = 'published'
        and (events.registration_deadline is null or events.registration_deadline > now())
    )
  );

-- Update policy: Users can cancel their registration; Organizers can update check-in status
create policy "Users or organizers can update registration status"
  on public.event_registrations for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.events
      where events.id = event_registrations.event_id and events.owner_id = auth.uid()
    )
  );

-- Atomic capacity validation trigger
create or replace function public.validate_event_registration_capacity()
returns trigger as $$
declare
  target_capacity integer;
  current_count integer;
begin
  -- Get event capacity
  select capacity into target_capacity
  from public.events
  where id = NEW.event_id;

  if (target_capacity > 0) then
    select count(*) into current_count
    from public.event_registrations
    where event_id = NEW.event_id and status in ('confirmed', 'checked_in');

    if (current_count >= target_capacity) then
      raise exception 'Event capacity has been reached. No more registrations allowed.';
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger tr_validate_event_registration_capacity
  before insert on public.event_registrations
  for each row execute function public.validate_event_registration_capacity();


/* ==========================================================================
   7. Teams, Invitations, and Team Memberships
   ========================================================================== */
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  name text not null check (char_length(trim(name)) > 0),
  invite_code text unique not null,
  leader_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, name)
);

alter table public.teams enable row level security;

create policy "Teams are viewable by event participants"
  on public.teams for select
  using (
    auth.uid() is not null
    and (
      leader_id = auth.uid()
      or exists (select 1 from public.events where events.id = teams.event_id and events.status = 'published')
    )
  );

create policy "Leaders can create teams"
  on public.teams for insert
  with check (auth.uid() = leader_id);

create policy "Team leaders can update team details"
  on public.teams for update
  using (auth.uid() = leader_id)
  with check (auth.uid() = leader_id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.team_members enable row level security;

create policy "Team members are viewable by authenticated users"
  on public.team_members for select
  using (auth.uid() is not null);

create policy "Team leaders can add team members"
  on public.team_members for insert
  with check (
    exists (
      select 1 from public.teams
      where teams.id = team_members.team_id and teams.leader_id = auth.uid()
    )
    or auth.uid() = user_id
  );

create policy "Members or leaders can leave or remove members"
  on public.team_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.teams
      where teams.id = team_members.team_id and teams.leader_id = auth.uid()
    )
  );

-- Enforce team size limit trigger
create or replace function public.validate_team_size_limit()
returns trigger as $$
declare
  target_event_id uuid;
  max_size integer;
  current_size integer;
begin
  select event_id into target_event_id from public.teams where id = NEW.team_id;
  select max_team_size into max_size from public.events where id = target_event_id;

  select count(*) into current_size from public.team_members where team_id = NEW.team_id;

  if (current_size >= max_size) then
    raise exception 'Team size limit of % members reached.', max_size;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create or replace trigger tr_validate_team_size_limit
  before insert on public.team_members
  for each row execute function public.validate_team_size_limit();

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade not null,
  invited_email text not null,
  invited_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.team_invites enable row level security;

create policy "Invited users and leaders can view invites"
  on public.team_invites for select
  using (
    auth.uid() = invited_user_id
    or exists (select 1 from public.teams where teams.id = team_invites.team_id and teams.leader_id = auth.uid())
  );

create policy "Team leaders can create invites"
  on public.team_invites for insert
  with check (
    exists (select 1 from public.teams where teams.id = team_invites.team_id and teams.leader_id = auth.uid())
  );

create policy "Invited users can update invite status"
  on public.team_invites for update
  using (auth.uid() = invited_user_id);


/* ==========================================================================
   8. Projects & Submissions
   ========================================================================== */
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete set null,
  submitter_id uuid references auth.users(id) on delete cascade not null,
  track_id uuid references public.event_tracks(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  tagline text,
  description text not null,
  demo_url text,
  repo_url text,
  video_url text,
  cover_image_url text,
  technologies text[] not null default array[]::text[],
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'winner', 'disqualified')),
  is_public boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.submissions enable row level security;

-- Read policy: Public can view published submissions; submitters and event organizers can view draft submissions
create policy "Submissions visibility"
  on public.submissions for select
  using (
    (is_public = true and status != 'draft')
    or auth.uid() = submitter_id
    or exists (
      select 1 from public.team_members
      where team_members.team_id = submissions.team_id and team_members.user_id = auth.uid()
    )
    or exists (
      select 1 from public.events
      where events.id = submissions.event_id and events.owner_id = auth.uid()
    )
  );

-- Insert policy: Registered participants can create submissions
create policy "Registered participants can create submissions"
  on public.submissions for insert
  with check (
    auth.uid() = submitter_id
    and exists (
      select 1 from public.event_registrations
      where event_registrations.event_id = submissions.event_id
        and event_registrations.user_id = auth.uid()
        and event_registrations.status in ('confirmed', 'checked_in')
    )
  );

-- Update policy: Submitters or team members can update their submissions
create policy "Submitters can update their submissions"
  on public.submissions for update
  using (
    auth.uid() = submitter_id
    or exists (
      select 1 from public.team_members
      where team_members.team_id = submissions.team_id and team_members.user_id = auth.uid()
    )
    or exists (
      select 1 from public.events
      where events.id = submissions.event_id and events.owner_id = auth.uid()
    )
  );


/* ==========================================================================
   9. Judging Criteria, Assignments, Scores, and Results
   ========================================================================== */
create table if not exists public.judging_criteria (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  weight numeric(4, 2) not null default 1.0 check (weight > 0),
  max_score integer not null default 10 check (max_score > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.judging_criteria enable row level security;

create policy "Judging criteria viewable by everyone"
  on public.judging_criteria for select
  using (true);

create policy "Event owners can manage criteria"
  on public.judging_criteria for all
  using (
    exists (select 1 from public.events where events.id = judging_criteria.event_id and events.owner_id = auth.uid())
  );

create table if not exists public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  judge_id uuid references auth.users(id) on delete cascade not null,
  track_id uuid references public.event_tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, judge_id, track_id)
);

alter table public.judge_assignments enable row level security;

create policy "Judges can view their assignments"
  on public.judge_assignments for select
  using (
    auth.uid() = judge_id
    or exists (select 1 from public.events where events.id = judge_assignments.event_id and events.owner_id = auth.uid())
  );

create policy "Event owners can manage judge assignments"
  on public.judge_assignments for all
  using (
    exists (select 1 from public.events where events.id = judge_assignments.event_id and events.owner_id = auth.uid())
  );

create table if not exists public.submission_scores (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade not null,
  judge_id uuid references auth.users(id) on delete cascade not null,
  criterion_id uuid references public.judging_criteria(id) on delete cascade not null,
  score numeric(4, 2) not null check (score >= 0),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, judge_id, criterion_id)
);

alter table public.submission_scores enable row level security;

create policy "Judges and event organizers can view scores"
  on public.submission_scores for select
  using (
    auth.uid() = judge_id
    or exists (
      select 1 from public.submissions
      join public.events on events.id = submissions.event_id
      where submissions.id = submission_scores.submission_id and events.owner_id = auth.uid()
    )
  );

create policy "Assigned judges can submit scores"
  on public.submission_scores for insert
  with check (
    auth.uid() = judge_id
    and exists (
      select 1 from public.submissions
      join public.judge_assignments on judge_assignments.event_id = submissions.event_id
      where submissions.id = submission_scores.submission_id and judge_assignments.judge_id = auth.uid()
    )
  );

create policy "Judges can update their own scores"
  on public.submission_scores for update
  using (auth.uid() = judge_id)
  with check (auth.uid() = judge_id);


/* ==========================================================================
   10. Notifications & Audit Logs
   ========================================================================== */
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info', 'event_update', 'team_invite', 'submission', 'result', 'system')),
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view and manage their own notifications"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "Only administrators can view audit logs"
  on public.audit_logs for select
  using (
    auth.jwt() ->> 'role' = 'service_role'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "System and authenticated users can append audit entries"
  on public.audit_logs for insert
  with check (auth.uid() is not null or auth.jwt() ->> 'role' = 'service_role');


/* ==========================================================================
   11. Performance Indexes
   ========================================================================== */
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_events_status on public.events(status);
create index if not exists idx_events_owner on public.events(owner_id);
create index if not exists idx_events_org on public.events(organization_id);
create index if not exists idx_events_locality on public.events(locality_id);
create index if not exists idx_events_category on public.events(category);
create index if not exists idx_events_starts_at on public.events(starts_at asc);
create index if not exists idx_event_registrations_event_user on public.event_registrations(event_id, user_id);
create index if not exists idx_event_registrations_ticket on public.event_registrations(ticket_code);
create index if not exists idx_teams_event_id on public.teams(event_id);
create index if not exists idx_team_members_team_user on public.team_members(team_id, user_id);
create index if not exists idx_submissions_event on public.submissions(event_id);
create index if not exists idx_submissions_team on public.submissions(team_id);
create index if not exists idx_submission_scores_submission on public.submission_scores(submission_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs(action, created_at desc);
