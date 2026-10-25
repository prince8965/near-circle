-- ==========================================================================
-- NearCircle Phase 8 & 9: Project Submissions, Storage & Judging Migration
-- ==========================================================================

-- 1. Add results_published flag to events table if not exists
alter table public.events
  add column if not exists results_published boolean not null default false;

-- 2. Add file_urls and feedback_summary to submissions table
alter table public.submissions
  add column if not exists file_urls jsonb not null default '[]'::jsonb;

alter table public.submissions
  add column if not exists feedback_summary text;

-- 3. Unique Submission Indexes (One submission per team or solo participant per event)
create unique index if not exists idx_unique_team_submission
  on public.submissions (event_id, team_id)
  where team_id is not null;

create unique index if not exists idx_unique_solo_submission
  on public.submissions (event_id, submitter_id)
  where team_id is null;


-- 4. Trigger: Enforce Submission Deadline and Eligibility
create or replace function public.validate_submission_rules()
returns trigger as $$
declare
  target_event public.events%rowtype;
  is_team_member boolean;
  is_registered boolean;
begin
  select * into target_event
  from public.events
  where id = NEW.event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  -- Deadline enforcement: If submitting or updating an already submitted project
  if (NEW.status = 'submitted') then
    if target_event.submission_deadline is not null and target_event.submission_deadline <= now() then
      -- Allow organizers to bypass deadline for emergency edits
      if (auth.uid() is distinct from target_event.owner_id and auth.jwt() ->> 'role' != 'service_role') then
        raise exception 'Submission deadline has passed for this event.';
      end if;
    end if;

    if NEW.submitted_at is null then
      NEW.submitted_at = now();
    end if;
  end if;

  -- Submitter registration verification
  select exists (
    select 1 from public.event_registrations
    where event_id = NEW.event_id
      and user_id = NEW.submitter_id
      and status in ('confirmed', 'checked_in')
  ) into is_registered;

  if not is_registered then
    raise exception 'Participant must have an active confirmed registration to submit projects.';
  end if;

  -- Team membership verification if team_id is provided
  if NEW.team_id is not null then
    select exists (
      select 1 from public.team_members
      where team_id = NEW.team_id and user_id = NEW.submitter_id
    ) into is_team_member;

    if not is_team_member then
      raise exception 'Submitter must be an active member of the designated team.';
    end if;
  end if;

  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_validate_submission_rules on public.submissions;
create trigger tr_validate_submission_rules
  before insert or update on public.submissions
  for each row execute function public.validate_submission_rules();


-- 5. Trigger: Enforce Score Bounds and Judge Assignment
create or replace function public.validate_submission_score()
returns trigger as $$
declare
  criterion_max integer;
  submission_event_id uuid;
  is_assigned_judge boolean;
  event_owner_id uuid;
begin
  -- Resolve criteria max score
  select max_score into criterion_max
  from public.judging_criteria
  where id = NEW.criterion_id;

  if criterion_max is null then
    raise exception 'Invalid judging criterion.';
  end if;

  if NEW.score < 0 or NEW.score > criterion_max then
    raise exception 'Score % is out of bounds (must be between 0 and %).', NEW.score, criterion_max;
  end if;

  -- Resolve event from submission
  select event_id into submission_event_id
  from public.submissions
  where id = NEW.submission_id;

  if submission_event_id is null then
    raise exception 'Submission not found.';
  end if;

  -- Resolve event owner
  select owner_id into event_owner_id
  from public.events
  where id = submission_event_id;

  -- Verify judge is assigned or is organizer/admin
  select exists (
    select 1 from public.judge_assignments
    where event_id = submission_event_id and judge_id = NEW.judge_id
  ) or (event_owner_id = NEW.judge_id) or (auth.jwt() ->> 'role' = 'service_role')
  into is_assigned_judge;

  if not is_assigned_judge then
    raise exception 'Unauthorized: Only judges assigned to this event can submit scores.';
  end if;

  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_validate_submission_score on public.submission_scores;
create trigger tr_validate_submission_score
  before insert or update on public.submission_scores
  for each row execute function public.validate_submission_score();


-- 6. Atomic Stored Procedure: Calculate Event Rankings & Leaderboard
create or replace function public.calculate_event_rankings(p_event_id uuid)
returns table (
  submission_id uuid,
  title text,
  team_id uuid,
  team_name text,
  submitter_id uuid,
  submitter_name text,
  track_id uuid,
  track_title text,
  total_weighted_score numeric,
  normalized_percentage numeric,
  judges_count integer,
  submitted_at timestamptz,
  rank bigint
) as $$
declare
  is_published boolean;
  is_event_owner boolean;
  total_max_weighted numeric;
begin
  -- Check access: Organizers can always preview; public can view only if results_published = true
  select results_published, (owner_id = auth.uid()) into is_published, is_event_owner
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  if not is_published and not coalesce(is_event_owner, false) and (auth.jwt() ->> 'role' != 'service_role') then
    raise exception 'Unauthorized: Event results have not been published yet.';
  end if;

  -- Calculate the maximum possible weighted score for this event
  select coalesce(sum(max_score * weight), 0) into total_max_weighted
  from public.judging_criteria
  where event_id = p_event_id;

  return query
  with criterion_averages as (
    -- Average score per criterion across all judges who evaluated this submission
    select
      ss.submission_id,
      ss.criterion_id,
      jc.weight,
      jc.max_score,
      avg(ss.score)::numeric as avg_criterion_score,
      count(distinct ss.judge_id)::integer as criterion_judges
    from public.submission_scores ss
    join public.judging_criteria jc on jc.id = ss.criterion_id
    where jc.event_id = p_event_id
    group by ss.submission_id, ss.criterion_id, jc.weight, jc.max_score
  ),
  submission_totals as (
    select
      s.id as sub_id,
      s.title as sub_title,
      s.team_id as sub_team_id,
      t.name as sub_team_name,
      s.submitter_id as sub_submitter_id,
      p.full_name as sub_submitter_name,
      s.track_id as sub_track_id,
      et.title as sub_track_title,
      s.submitted_at as sub_submitted_at,
      coalesce(sum(ca.avg_criterion_score * ca.weight), 0)::numeric(10, 2) as calc_weighted_score,
      case
        when total_max_weighted > 0 then
          round((coalesce(sum(ca.avg_criterion_score * ca.weight), 0) / total_max_weighted * 100), 2)
        else 0
      end as calc_percentage,
      coalesce(max(ca.criterion_judges), 0) as calc_judges_count
    from public.submissions s
    left join public.teams t on t.id = s.team_id
    left join public.profiles p on p.id = s.submitter_id
    left join public.event_tracks et on et.id = s.track_id
    left join criterion_averages ca on ca.submission_id = s.id
    where s.event_id = p_event_id
      and s.status in ('submitted', 'under_review', 'winner')
    group by s.id, s.title, s.team_id, t.name, s.submitter_id, p.full_name, s.track_id, et.title, s.submitted_at
  )
  select
    st.sub_id as submission_id,
    st.sub_title as title,
    st.sub_team_id as team_id,
    st.sub_team_name as team_name,
    st.sub_submitter_id as submitter_id,
    st.sub_submitter_name as submitter_name,
    st.sub_track_id as track_id,
    st.sub_track_title as track_title,
    st.calc_weighted_score as total_weighted_score,
    st.calc_percentage as normalized_percentage,
    st.calc_judges_count as judges_count,
    st.sub_submitted_at as submitted_at,
    dense_rank() over (
      order by
        st.calc_weighted_score desc,
        st.sub_submitted_at asc nulls last
    ) as rank
  from submission_totals st
  order by rank asc;
end;
$$ language plpgsql security definer;


-- 7. Stored Procedure: Publish / Unpublish Event Results
create or replace function public.set_event_results_published(
  p_event_id uuid,
  p_published boolean
)
returns boolean as $$
declare
  is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Sign-in required.';
  end if;

  select exists (
    select 1 from public.events
    where id = p_event_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into is_owner;

  if not is_owner then
    raise exception 'Unauthorized: Only event organizers or administrators can publish event results.';
  end if;

  update public.events
  set results_published = p_published,
      updated_at = now()
  where id = p_event_id;

  return true;
end;
$$ language plpgsql security definer;


-- 8. Supabase Storage Buckets & Policies Documentation / Creation SQL
-- (Can be executed in Supabase SQL editor or automated deployment)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-assets', 'public-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('project-submissions', 'project-submissions', false, 26214400, array['application/pdf', 'application/zip', 'application/x-zip-compressed', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'text/plain', 'application/json'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage Policy: Public Assets can be read by anyone
create policy "Public Assets are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'public-assets');

-- Storage Policy: Authenticated users can upload public assets
create policy "Authenticated users can upload public assets"
  on storage.objects for insert
  with check (bucket_id = 'public-assets' and auth.uid() is not null);

-- Storage Policy: Project Submissions private read
-- Submitters, team members, event organizers, and assigned judges can view private files
create policy "Private project files are viewable by authorized parties"
  on storage.objects for select
  using (
    bucket_id = 'project-submissions'
    and (
      auth.uid() is not null
      and (
        -- User uploaded the file
        owner = auth.uid()
        -- Or user is organizer of the event
        or exists (
          select 1 from public.events
          where id::text = (storage.foldername(name))[1] and owner_id = auth.uid()
        )
        -- Or user is an assigned judge
        or exists (
          select 1 from public.judge_assignments
          where event_id::text = (storage.foldername(name))[1] and judge_id = auth.uid()
        )
      )
    )
  );

-- Storage Policy: Registered participants can upload to project-submissions
create policy "Registered participants can upload project files"
  on storage.objects for insert
  with check (
    bucket_id = 'project-submissions'
    and auth.uid() is not null
    and owner = auth.uid()
  );
