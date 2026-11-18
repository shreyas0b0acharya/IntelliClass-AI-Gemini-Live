-- ==============================================================================
-- Supabase SQL Migration: Sessions Table Persona & Audio Configuration Columns
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hdfjiclsjuayuxopgbpf/sql/new
-- ==============================================================================

-- Add avatar_model, speech_speed, and tts_provider columns to public.sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS avatar_model TEXT DEFAULT 'men-avatarsdk',
  ADD COLUMN IF NOT EXISTS speech_speed NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'headtts';

-- Update existing sessions that might have null values
UPDATE public.sessions
SET 
  avatar_model = COALESCE(avatar_model, 'men-avatarsdk'),
  speech_speed = COALESCE(speech_speed, 1.0),
  tts_provider = COALESCE(tts_provider, 'headtts')
WHERE avatar_model IS NULL OR speech_speed IS NULL OR tts_provider IS NULL;
