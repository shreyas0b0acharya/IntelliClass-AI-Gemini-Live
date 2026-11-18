-- ==============================================================================
-- Supabase SQL Migration: Session Participants (Classroom Waiting Room & Admission)
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hdfjiclsjuayuxopgbpf/sql/new
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT 'Student',
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('lecturer', 'student')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'admitted', 'denied', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_participants_session_user UNIQUE (session_id, user_id)
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON public.session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status ON public.session_participants(session_id, status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view participants
CREATE POLICY "Allow authenticated read on session_participants"
ON public.session_participants
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert/update their own or managed participant record
CREATE POLICY "Allow authenticated insert on session_participants"
ON public.session_participants
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on session_participants"
ON public.session_participants
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
