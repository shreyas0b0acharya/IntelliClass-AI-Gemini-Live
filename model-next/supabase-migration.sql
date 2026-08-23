-- Supabase SQL Migration: Sessions Table Extensions
-- Run this in your Supabase SQL Editor to enable full classroom state persistence

ALTER TABLE public.sessions 
  ADD COLUMN IF NOT EXISTS voice_id TEXT DEFAULT 'am_fenrir',
  ADD COLUMN IF NOT EXISTS meeting_code TEXT,
  ADD COLUMN IF NOT EXISTS stopped_reason TEXT,
  ADD COLUMN IF NOT EXISTS current_item_id TEXT,
  ADD COLUMN IF NOT EXISTS sequence INT DEFAULT 0;

-- Optional index on meeting_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_meeting_code ON public.sessions(meeting_code);
