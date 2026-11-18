-- Supabase SQL Migration: Sessions Table Extensions
-- Run this in your Supabase SQL Editor to enable full classroom state persistence

ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'am_fenrir',
  ADD COLUMN IF NOT EXISTS meeting_code TEXT,
  ADD COLUMN IF NOT EXISTS stopped_reason TEXT,
  ADD COLUMN IF NOT EXISTS current_item_id TEXT,
  ADD COLUMN IF NOT EXISTS sequence INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state_version INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_driver_tab_id TEXT,
  ADD COLUMN IF NOT EXISTS driver_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_lease_version INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_epoch_ms BIGINT,
  ADD COLUMN IF NOT EXISTS duration_ms INT;

-- Optional index on meeting_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_meeting_code ON public.sessions(meeting_code);

-- Course Space extensions: Teaching instructions & full lifecycle status
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS teaching_instructions TEXT;

ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check 
  CHECK (status IN ('created', 'running', 'paused', 'ended', 'scheduled', 'draft', 'ready', 'deleted'));

-- Student Groups & Reusable Cohort Management
CREATE TABLE IF NOT EXISTS public.student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, student_email)
);

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS assigned_group_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS assigned_group_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on student_groups" ON public.student_groups;
CREATE POLICY "Allow all for authenticated on student_groups" ON public.student_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated on student_group_members" ON public.student_group_members;
CREATE POLICY "Allow all for authenticated on student_group_members" ON public.student_group_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

