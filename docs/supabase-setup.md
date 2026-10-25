# NearCircle — Supabase Setup Guide

This guide explains how to configure and connect Supabase to NearCircle for local development and production deployment.

---

## 1. Prerequisites
- Node.js 18+ and npm installed.
- A [Supabase account](https://supabase.com).
- Access to the NearCircle repository.

---

## 2. Create a Supabase Project

1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project** and select your organization.
3. Configure the project:
   - **Name**: `NearCircle` (or `NearCircle-dev`).
   - **Database Password**: Generate and securely store a strong password. (Never commit or place this password in frontend files).
   - **Region**: Choose the region closest to your target users (e.g., `South Asia (Mumbai)` or `ap-south-1`).
   - **Pricing Plan**: Free tier is sufficient for development.
4. Click **Create new project** and wait ~2 minutes for the database to provision.

---

## 3. Retrieve API Keys & Configure Environment Variables

1. In your Supabase project dashboard, navigate to:
   **Project Settings** (gear icon in sidebar) → **API**.
2. Locate the following values:
   - **Project URL**: e.g. `https://xyzcompany.supabase.co`
   - **Project API Keys**:
     - `anon` `public`: The client-safe key used by the frontend.
     - **DO NOT USE `service_role` `secret`**: The service role key bypasses Row Level Security. It must NEVER be exposed in frontend code, `.env`, client-side Git commits, or browser builds.
3. In your local repository root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Populate your `.env` file with your real Supabase credentials:
   ```env
   # Google Maps API (Optional, for event maps)
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   ```
5. Ensure `.env` is never committed. Verify Git ignores it:
   ```bash
   git status --ignored
   ```
   `.env` must appear under Ignored files.

---

## 4. Run Existing Database Migrations

NearCircle includes migration scripts under `supabase/migrations/`.

### Migration 1: Community & Organizations Schema
File: `supabase/migrations/20261024_community_schema.sql`

To apply this schema:
1. Open the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/_/sql).
2. Click **New query**.
3. Copy and paste the entire contents of `supabase/migrations/20261024_community_schema.sql`.
4. Click **Run**.
5. Verify the following tables were created in the **Table Editor**:
   - `public.organizations`
   - `public.organization_follows`
   - `public.community_posts`
   - `public.post_likes`
   - `public.post_comments`
   - `public.post_reports`

---

## 5. Configure Storage Buckets (Community & Event Media)

The community feed and event features support media uploads (posters, post images).

1. In the Supabase Dashboard, navigate to **Storage**.
2. Click **New bucket**:
   - **Bucket name**: `community-media`
   - **Public bucket**: **Enable** (checked)
   - Save the bucket.
3. Apply Storage Policies (under Storage → Policies → `community-media`):
   - **Public Read Access**:
     ```sql
     create policy "Public Access" on storage.objects
       for select using (bucket_id = 'community-media');
     ```
   - **Authenticated User Uploads**:
     ```sql
     create policy "Authenticated Uploads" on storage.objects
       for insert with check (bucket_id = 'community-media' and auth.role() = 'authenticated');
     ```

---

## 6. How the Frontend Connects to Supabase

The Supabase client is initialized in `src/lib/supabase.ts` and re-exported from `src/services/index.ts`.

- **Safe Initialization**: If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are unset or contain placeholder strings, `isSupabaseConfigured()` returns `false`, and the client falls back to a safe placeholder endpoint without crashing the frontend on startup.
- **Session Persistence**: Sessions are automatically maintained in `localStorage` with auto token refresh and URL session detection enabled.

---

## 7. Running the Application Locally

1. Install dependencies (including `@supabase/supabase-js`):
   ```bash
   npm install
   ```
2. Verify TypeScript types:
   ```bash
   npm run typecheck
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 8. Security Rules Reminder
- **Never expose the `service_role` key** anywhere in client-side code or Git.
- **Row Level Security (RLS)** is enabled on all tables by default. Frontend route protection is purely for UX; database security is enforced by PostgreSQL policies.
- Keep `supabase/migrations/20261024_community_schema.sql` unchanged and add subsequent migrations incrementally.
