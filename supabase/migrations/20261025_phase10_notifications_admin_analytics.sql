-- Phase 10: Notifications, Administration, Verification, and Real Analytics
-- Migration: 20261025_phase10_notifications_admin_analytics.sql

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can update read status on their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service and admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- 2. Organizations Verification Columns
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 3. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Only admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 4. RPC: Review Organization Verification (Prevents Self-Approval)
CREATE OR REPLACE FUNCTION public.review_organization_verification(
  p_org_id TEXT,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_name TEXT;
  v_org_owner_id UUID;
  v_org_name TEXT;
  v_is_approved BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Sign-in required.';
  END IF;

  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required.';
  END IF;

  SELECT owner_id, name INTO v_org_owner_id, v_org_name
  FROM public.organizations
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found.';
  END IF;

  -- CRITICAL SECURITY: Organizations cannot approve themselves
  IF v_org_owner_id = v_admin_id THEN
    RAISE EXCEPTION 'Unauthorized: Organization owners cannot approve their own verification.';
  END IF;

  v_is_approved := (p_decision = 'verified');

  -- Update Organization
  UPDATE public.organizations
  SET
    is_verified = v_is_approved,
    verification_status = CASE WHEN v_is_approved THEN 'verified' ELSE 'rejected' END,
    verified_at = CASE WHEN v_is_approved THEN now() ELSE NULL END,
    verified_by = v_admin_id,
    verification_notes = p_notes,
    updated_at = now()
  WHERE id = p_org_id;

  -- Insert Audit Log
  SELECT COALESCE(full_name, 'Admin') INTO v_admin_name
  FROM public.profiles WHERE id = v_admin_id;

  INSERT INTO public.admin_audit_logs (
    id, admin_id, admin_name, action, target_type, target_id, target_name, details, created_at
  ) VALUES (
    'log-' || substr(md5(random()::text), 1, 12),
    v_admin_id,
    COALESCE(v_admin_name, 'Admin'),
    CASE WHEN v_is_approved THEN 'approve_verification' ELSE 'reject_verification' END,
    'organization',
    p_org_id,
    v_org_name,
    COALESCE(p_notes, CASE WHEN v_is_approved THEN 'Approved campus credentials.' ELSE 'Verification rejected.' END),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'is_verified', v_is_approved,
    'status', CASE WHEN v_is_approved THEN 'verified' ELSE 'rejected' END
  );
END;
$$;
