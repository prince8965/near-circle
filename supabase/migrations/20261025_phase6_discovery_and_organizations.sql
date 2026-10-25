-- NearCircle Phase 6 Migration: Real Event Discovery & Public Organization Profiles
-- File: supabase/migrations/20261025_phase6_discovery_and_organizations.sql

-- 1. Ensure `mode` column exists with validation constraint
alter table public.events
  add column if not exists mode text not null default 'in-person' check (mode in ('in-person', 'online', 'hybrid'));

-- 2. Performance indexes for discovery filters, sorting, and tag searches
create index if not exists idx_events_status_ends_at on public.events(status, ends_at);
create index if not exists idx_events_category on public.events(category);
create index if not exists idx_events_mode on public.events(mode);
create index if not exists idx_events_tags on public.events using gin(tags);
create index if not exists idx_events_organization_id on public.events(organization_id);
create index if not exists idx_events_registration_deadline on public.events(registration_deadline);
create index if not exists idx_events_starts_at on public.events(starts_at);

-- 3. Calculate completed / conducted events count from real database records
-- Strict Criteria:
-- - Belongs to organization
-- - Real event (is_demo = false)
-- - Not draft and not cancelled
-- - Either status = 'completed' OR (status = 'published' AND ends_at < now())
create or replace function public.get_organization_completed_count(org_id uuid)
returns integer as $$
  select count(*)::integer
  from public.events
  where organization_id = org_id
    and is_demo = false
    and status not in ('draft', 'cancelled')
    and (status = 'completed' or (status = 'published' and ends_at < now()));
$$ language sql stable security definer;

-- 4. Get comprehensive public organization event stats
create or replace function public.get_organization_public_stats(org_id uuid)
returns jsonb as $$
declare
  v_completed integer;
  v_upcoming integer;
begin
  select count(*)::integer into v_completed
  from public.events
  where organization_id = org_id
    and is_demo = false
    and status not in ('draft', 'cancelled')
    and (status = 'completed' or (status = 'published' and ends_at < now()));

  select count(*)::integer into v_upcoming
  from public.events
  where organization_id = org_id
    and status = 'published'
    and ends_at >= now();

  return jsonb_build_object(
    'completed_count', v_completed,
    'upcoming_count', v_upcoming
  );
end;
$$ language plpgsql stable security definer;

-- 5. Explicitly reinforce RLS policies for anonymous visitors and participants
-- Ensure public read policy strictly isolates drafts from visitors and participants
drop policy if exists "Published events are viewable by everyone" on public.events;
create policy "Published events are viewable by everyone"
  on public.events for select
  using (
    status in ('published', 'completed')
    or (auth.uid() is not null and auth.uid() = owner_id)
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
