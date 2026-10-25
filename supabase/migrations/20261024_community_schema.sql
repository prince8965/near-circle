-- NearCircle Community Section Schema & Row Level Security (RLS)
-- File: supabase/migrations/20261024_community_schema.sql

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

/* ==========================================================================
   1. Organizations Table
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

-- Read policy: Anyone can browse organizations
create policy "Organizations are viewable by everyone"
  on public.organizations for select
  using (true);

-- Insert/Update/Delete policy: Restricted to service role or organization admins
create policy "Only service role can modify organizations"
  on public.organizations for all
  using (auth.jwt() ->> 'role' = 'service_role');


/* ==========================================================================
   2. Organization Follows Table
   ========================================================================== */
create table if not exists public.organization_follows (
  user_id uuid references auth.users(id) on delete cascade not null,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

alter table public.organization_follows enable row level security;

create policy "Users can view follows"
  on public.organization_follows for select
  using (true);

create policy "Users can follow organizations"
  on public.organization_follows for insert
  with check (auth.uid() = user_id);

create policy "Users can unfollow organizations"
  on public.organization_follows for delete
  using (auth.uid() = user_id);


/* ==========================================================================
   3. Community Posts Table
   ========================================================================== */
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete cascade not null,
  author_name text not null,
  author_avatar text,
  author_role text not null default 'student' check (author_role in ('student', 'organizer', 'community_lead')),
  content text not null check (char_length(trim(content)) > 0),
  category text not null,
  image_url text,
  community_id text,
  organization_id uuid references public.organizations(id) on delete set null,
  event_id text,
  locality_id text,
  custom_event_date text,
  custom_event_location text,
  custom_event_link text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  is_reported boolean not null default false,
  report_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

-- Read policy: Everyone can view community posts
create policy "Posts are viewable by everyone"
  on public.community_posts for select
  using (true);

-- Insert policy: Authenticated users can create posts with their own author_id
create policy "Users can create posts"
  on public.community_posts for insert
  with check (auth.uid() = author_id);

-- Update policy: Only the author can edit their own post
create policy "Users can only edit their own posts"
  on public.community_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Delete policy: Only the author can delete their own post
create policy "Users can only delete their own posts"
  on public.community_posts for delete
  using (auth.uid() = author_id);


/* ==========================================================================
   4. Post Likes Table
   ========================================================================== */
create table if not exists public.post_likes (
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.post_likes for select
  using (true);

create policy "Users can like posts"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike posts"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- Trigger to maintain community_posts.likes_count atomically
create or replace function public.handle_post_like_counter()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.community_posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif (TG_OP = 'DELETE') then
    update public.community_posts set likes_count = greatest(0, likes_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create or replace trigger on_post_like_change
  after insert or delete on public.post_likes
  for each row execute function public.handle_post_like_counter();


/* ==========================================================================
   5. Post Comments Table
   ========================================================================== */
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete cascade not null,
  author_name text not null,
  author_avatar text,
  author_role text not null default 'student',
  content text not null check (char_length(trim(content)) > 0),
  parent_id uuid references public.post_comments(id) on delete cascade,
  reply_to_author text,
  created_at timestamptz not null default now()
);

alter table public.post_comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.post_comments for select
  using (true);

create policy "Users can post comments"
  on public.post_comments for insert
  with check (auth.uid() = author_id);

create policy "Users can delete their own comments"
  on public.post_comments for delete
  using (auth.uid() = author_id);

-- Trigger to maintain community_posts.comments_count atomically
create or replace function public.handle_post_comment_counter()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.community_posts set comments_count = comments_count + 1 where id = NEW.post_id;
  elsif (TG_OP = 'DELETE') then
    update public.community_posts set comments_count = greatest(0, comments_count - 1) where id = OLD.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create or replace trigger on_post_comment_change
  after insert or delete on public.post_comments
  for each row execute function public.handle_post_comment_counter();


/* ==========================================================================
   6. Post Reports Table
   ========================================================================== */
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);

alter table public.post_reports enable row level security;

create policy "Users can submit reports"
  on public.post_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Only moderators can view reports"
  on public.post_reports for select
  using (auth.jwt() ->> 'role' in ('service_role', 'moderator'));


/* ==========================================================================
   7. Performance Indexes
   ========================================================================== */
create index if not exists idx_community_posts_created_at on public.community_posts (created_at desc);
create index if not exists idx_community_posts_category on public.community_posts (category);
create index if not exists idx_community_posts_locality on public.community_posts (locality_id);
create index if not exists idx_community_posts_author on public.community_posts (author_id);
create index if not exists idx_post_comments_post_id on public.post_comments (post_id, created_at asc);
create index if not exists idx_post_likes_post_id on public.post_likes (post_id);
create index if not exists idx_org_follows_user_id on public.organization_follows (user_id);


/* ==========================================================================
   8. Supabase Storage Setup (Run in Storage SQL or Dashboard)
   ========================================================================== */
-- insert into storage.buckets (id, name, public) values ('community-media', 'community-media', true);
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'community-media' );
-- create policy "Authenticated Uploads" on storage.objects for insert with check ( bucket_id = 'community-media' and auth.role() = 'authenticated' );
