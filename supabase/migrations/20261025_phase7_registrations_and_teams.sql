-- ==========================================================================
-- NearCircle Phase 7: Event Registrations and Team Management Migration
-- Concurrency, capacity limits, team size enforcement, and access isolation
-- ==========================================================================

-- 1. Enforce No Duplicate Team Membership Across Teams for the Same Event
create or replace function public.validate_event_team_membership()
returns trigger as $$
declare
  target_event_id uuid;
  existing_team_id uuid;
begin
  -- Resolve the target event from the team being joined
  select event_id into target_event_id
  from public.teams
  where id = NEW.team_id;

  if target_event_id is null then
    raise exception 'Invalid team ID: team does not exist.';
  end if;

  -- Check if user is already a member of any team for the same event
  select tm.team_id into existing_team_id
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where t.event_id = target_event_id
    and tm.user_id = NEW.user_id
    and tm.team_id <> NEW.team_id
  limit 1;

  if existing_team_id is not null then
    raise exception 'Participant is already a member of another team for this event.';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_validate_event_team_membership on public.team_members;
create trigger tr_validate_event_team_membership
  before insert on public.team_members
  for each row execute function public.validate_event_team_membership();


-- 2. Atomic Registration Procedure Enforcing Deadlines, Capacity, and Uniqueness
create or replace function public.register_for_event(
  p_event_id uuid,
  p_custom_answers jsonb default '{}'::jsonb
)
returns public.event_registrations as $$
declare
  target_event public.events%rowtype;
  current_confirmed_count integer;
  existing_reg public.event_registrations%rowtype;
  new_ticket_code text;
  result_row public.event_registrations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Sign-in required to register for events.';
  end if;

  -- Row-level lock to prevent concurrent capacity race conditions
  select * into target_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Event not found.';
  end if;

  if target_event.status <> 'published' then
    raise exception 'Registration is only open for published events.';
  end if;

  -- Deadline check
  if target_event.registration_deadline is not null and target_event.registration_deadline <= now() then
    raise exception 'Registration deadline has passed for this event.';
  end if;

  -- Check if user is already registered
  select * into existing_reg
  from public.event_registrations
  where event_id = p_event_id and user_id = auth.uid();

  if found and existing_reg.status = 'confirmed' then
    raise exception 'You are already registered for this event.';
  end if;

  -- Capacity check: count active registrations
  if target_event.capacity > 0 then
    select count(*) into current_confirmed_count
    from public.event_registrations
    where event_id = p_event_id and status in ('confirmed', 'checked_in');

    if current_confirmed_count >= target_event.capacity then
      raise exception 'Event capacity has been reached. No more registrations allowed.';
    end if;
  end if;

  -- Generate ticket code
  new_ticket_code := 'NC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  if found then
    -- Reactivate previously cancelled registration
    update public.event_registrations
    set status = 'confirmed',
        ticket_code = coalesce(existing_reg.ticket_code, new_ticket_code),
        custom_answers = coalesce(p_custom_answers, existing_reg.custom_answers, '{}'::jsonb),
        updated_at = now()
    where id = existing_reg.id
    returning * into result_row;
  else
    -- Insert new registration
    insert into public.event_registrations (
      event_id,
      user_id,
      status,
      ticket_code,
      custom_answers,
      created_at,
      updated_at
    ) values (
      p_event_id,
      auth.uid(),
      'confirmed',
      new_ticket_code,
      coalesce(p_custom_answers, '{}'::jsonb),
      now(),
      now()
    )
    returning * into result_row;
  end if;

  return result_row;
end;
$$ language plpgsql security definer;


-- 3. Atomic Registration Cancellation Procedure
create or replace function public.cancel_event_registration(p_event_id uuid)
returns boolean as $$
declare
  target_reg public.event_registrations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Sign-in required.';
  end if;

  select * into target_reg
  from public.event_registrations
  where event_id = p_event_id and user_id = auth.uid()
  for update;

  if not found or target_reg.status <> 'confirmed' then
    raise exception 'No active confirmed registration found for this event.';
  end if;

  update public.event_registrations
  set status = 'cancelled',
      updated_at = now()
  where id = target_reg.id;

  -- If user is in a team for this event, handle membership removal
  delete from public.team_members
  where user_id = auth.uid()
    and team_id in (select id from public.teams where event_id = p_event_id);

  return true;
end;
$$ language plpgsql security definer;


-- 4. Atomic Team Creation Procedure
create or replace function public.create_event_team(
  p_event_id uuid,
  p_team_name text
)
returns public.teams as $$
declare
  target_event public.events%rowtype;
  cleaned_name text;
  new_invite_code text;
  created_team public.teams%rowtype;
  user_registered boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Sign-in required to create teams.';
  end if;

  cleaned_name := trim(p_team_name);
  if char_length(cleaned_name) = 0 then
    raise exception 'Team name cannot be empty.';
  end if;

  select * into target_event
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event not found.';
  end if;

  if target_event.max_team_size <= 1 then
    raise exception 'This event is configured for solo participation only.';
  end if;

  -- Check if participant has a confirmed registration
  select exists (
    select 1 from public.event_registrations
    where event_id = p_event_id and user_id = auth.uid() and status in ('confirmed', 'checked_in')
  ) into user_registered;

  if not user_registered then
    raise exception 'You must be registered for this event before creating a team.';
  end if;

  -- Check duplicate team membership
  if exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where t.event_id = p_event_id and tm.user_id = auth.uid()
  ) then
    raise exception 'You are already a member of a team for this event.';
  end if;

  -- Generate unique invite code
  new_invite_code := 'TEAM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.teams (
    event_id,
    name,
    invite_code,
    leader_id,
    created_at,
    updated_at
  ) values (
    p_event_id,
    cleaned_name,
    new_invite_code,
    auth.uid(),
    now(),
    now()
  )
  returning * into created_team;

  -- Add creator as leader
  insert into public.team_members (
    team_id,
    user_id,
    role,
    joined_at
  ) values (
    created_team.id,
    auth.uid(),
    'leader',
    now()
  );

  return created_team;
end;
$$ language plpgsql security definer;


-- 5. Atomic Team Joining by Invite Code
create or replace function public.join_team_by_code(p_invite_code text)
returns public.teams as $$
declare
  target_team public.teams%rowtype;
  target_event public.events%rowtype;
  current_team_size integer;
  user_registered boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Sign-in required to join teams.';
  end if;

  select * into target_team
  from public.teams
  where upper(invite_code) = upper(trim(p_invite_code));

  if not found then
    raise exception 'Invalid invite code. No team found.';
  end if;

  select * into target_event
  from public.events
  where id = target_team.event_id;

  -- Check registration
  select exists (
    select 1 from public.event_registrations
    where event_id = target_team.event_id and user_id = auth.uid() and status in ('confirmed', 'checked_in')
  ) into user_registered;

  if not user_registered then
    raise exception 'You must be registered for this event before joining a team.';
  end if;

  -- Check team size limit
  select count(*) into current_team_size
  from public.team_members
  where team_id = target_team.id;

  if current_team_size >= target_event.max_team_size then
    raise exception 'Team is full. Maximum team size of % reached.', target_event.max_team_size;
  end if;

  -- Add member (validation trigger also enforces no duplicate event membership)
  insert into public.team_members (
    team_id,
    user_id,
    role,
    joined_at
  ) values (
    target_team.id,
    auth.uid(),
    'member',
    now()
  );

  return target_team;
end;
$$ language plpgsql security definer;


-- 6. Organizer Attendee Access Function (Restricted to Event Owner)
create or replace function public.get_event_attendees(p_event_id uuid)
returns table (
  registration_id uuid,
  user_id uuid,
  status text,
  ticket_code text,
  created_at timestamptz,
  user_full_name text,
  user_avatar text,
  user_email text,
  team_id uuid,
  team_name text,
  team_role text
) as $$
declare
  is_authorized boolean;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Sign-in required.';
  end if;

  -- Verify caller is the owner/organizer of this event or an admin
  select exists (
    select 1 from public.events
    where id = p_event_id and owner_id = auth.uid()
  ) or exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into is_authorized;

  if not is_authorized then
    raise exception 'Unauthorized: Only the event organizer can access the attendee roster.';
  end if;

  return query
  select
    r.id as registration_id,
    r.user_id,
    r.status,
    r.ticket_code,
    r.created_at,
    p.full_name as user_full_name,
    p.avatar_url as user_avatar,
    u.email as user_email,
    t.id as team_id,
    t.name as team_name,
    tm.role as team_role
  from public.event_registrations r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  left join public.team_members tm on tm.user_id = r.user_id
  left join public.teams t on t.id = tm.team_id and t.event_id = r.event_id
  where r.event_id = p_event_id
  order by r.created_at asc;
end;
$$ language plpgsql security definer;
