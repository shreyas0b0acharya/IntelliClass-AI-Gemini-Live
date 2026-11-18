-- ==============================================================================
-- IntelliClass AI — Complete Initial Database Schema (000_initial_schema.sql)
-- Target: Supabase PostgreSQL (Postgres 15+)
-- Compatible with pgvector, Supabase Auth, Realtime & Storage
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;

-- Ensure public schema search path
SET search_path = public, extensions;

-- ==============================================================================
-- 2. PUBLIC TABLES
-- ==============================================================================

-- 2.1 Profiles (User metadata linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'lecturer', 'student')),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 Courses
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    teaching_instructions TEXT,
    cover_image TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Course Files (Uploaded course PDF/documents)
CREATE TABLE IF NOT EXISTS public.course_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Document Chunks (RAG embeddings for search & grounding)
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding public.vector(768),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 Classroom Sessions (Lectures, conductor leases & topic roadmaps)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    script TEXT,
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'running', 'paused', 'ended', 'scheduled', 'draft', 'ready', 'deleted')),
    current_sentence_index INT DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    voice TEXT DEFAULT 'male' CHECK (voice IN ('male', 'female')),
    voice_id TEXT DEFAULT 'am_fenrir',
    meeting_code TEXT,
    stopped_reason TEXT,
    current_item_id TEXT,
    sequence INT DEFAULT 0,
    state_version INT DEFAULT 0,
    active_driver_tab_id TEXT,
    driver_lease_expires_at TIMESTAMPTZ,
    driver_lease_version INT DEFAULT 0,
    target_epoch_ms BIGINT,
    duration_ms INT,
    avatar_model TEXT DEFAULT 'men-avatarsdk',
    speech_speed NUMERIC DEFAULT 1.0,
    tts_provider TEXT DEFAULT 'headtts',
    -- Gemini Live / Topic Roadmap additions
    roadmap JSONB DEFAULT '{"topics": []}'::jsonb,
    current_topic_id TEXT,
    covered_topic_ids JSONB DEFAULT '[]'::jsonb,
    live_resumption_handle TEXT,
    live_session_stats JSONB DEFAULT '{}'::jsonb
);

-- 2.6 Session Participants (Waiting room & student admission)
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

-- 2.7 Messages (Classroom Q&A chat)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'ai', 'system')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.8 Media Assets (Extracted diagrams, figures & slide images)
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    file_url TEXT NOT NULL,
    label TEXT,
    thumbnail_url TEXT,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'pdf_extracted', 'lecturer_upload')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.9 Engagement Alerts (Real-time student attention/boredom detection)
CREATE TABLE IF NOT EXISTS public.engagement_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('sleepy', 'inattentive', 'class_boredom', 'confused', 'happy')),
    intervention_text TEXT NOT NULL,
    resolved BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2.10 User Settings (Avatar & voice customization preferences)
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    default_gender TEXT DEFAULT 'male' NOT NULL,
    default_male_model_name TEXT DEFAULT 'Prof. Arthur' NOT NULL,
    default_female_model_name TEXT DEFAULT 'Dr. Clara' NOT NULL,
    default_male_voice TEXT DEFAULT 'am_fenrir' NOT NULL,
    default_female_voice TEXT DEFAULT 'af_bella' NOT NULL,
    speech_speed NUMERIC DEFAULT 1.0 NOT NULL,
    speech_pitch NUMERIC DEFAULT 1.0 NOT NULL,
    model_quality TEXT DEFAULT 'high' NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==============================================================================
-- 3. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_sessions_meeting_code ON public.sessions(meeting_code);
CREATE INDEX IF NOT EXISTS idx_sessions_current_topic ON public.sessions(current_topic_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course_id ON public.sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_course_files_course_id ON public.course_files(course_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_course_id ON public.document_chunks(course_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_course_id ON public.media_assets(course_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_session_id ON public.media_assets(session_id);
CREATE INDEX IF NOT EXISTS idx_engagement_alerts_session ON public.engagement_alerts(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON public.session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status ON public.session_participants(session_id, status);

-- HNSW Vector Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- ==============================================================================
-- 4. RPC FUNCTIONS (Vector Match & Utilities)
-- ==============================================================================

-- Match Documents RPC for Gemini RAG
CREATE OR REPLACE FUNCTION public.match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  course_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks
  WHERE (course_id_filter IS NULL OR document_chunks.course_id = course_id_filter)
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Automatically create profile on new user registration in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by all users" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses Policies
CREATE POLICY "Courses are viewable by everyone" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Lecturers can create courses" ON public.courses FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'lecturer')
);
CREATE POLICY "Owner can update course" ON public.courses FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Owner can delete course" ON public.courses FOR DELETE USING (auth.uid() = created_by);

-- Course Files Policies
CREATE POLICY "Anyone can view course files" ON public.course_files FOR SELECT USING (true);
CREATE POLICY "Lecturers can upload files" ON public.course_files FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'lecturer')
);
CREATE POLICY "Delete own files or lecturer" ON public.course_files FOR DELETE USING (
    uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'lecturer')
);

-- Document Chunks Policies
CREATE POLICY "Chunks are viewable by everyone" ON public.document_chunks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert chunks" ON public.document_chunks FOR INSERT TO authenticated WITH CHECK (true);

-- Sessions Policies
CREATE POLICY "Sessions are viewable by everyone" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Lecturers can create sessions" ON public.sessions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'lecturer'))
);
CREATE POLICY "Session owner or creator can update session" ON public.sessions FOR UPDATE USING (
    auth.uid() = created_by OR EXISTS (
        SELECT 1 FROM public.courses WHERE courses.id = sessions.course_id AND courses.created_by = auth.uid()
    )
);

-- Session Participants Policies
CREATE POLICY "Allow authenticated read on session_participants" ON public.session_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on session_participants" ON public.session_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on session_participants" ON public.session_participants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Messages Policies
CREATE POLICY "Messages are viewable by everyone" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Media Assets Policies
CREATE POLICY "Media assets are viewable by everyone" ON public.media_assets FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert media assets" ON public.media_assets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete media assets" ON public.media_assets FOR DELETE USING (auth.role() = 'authenticated');

-- Engagement Alerts Policies
CREATE POLICY "Authenticated can read engagement alerts" ON public.engagement_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert engagement alerts" ON public.engagement_alerts FOR INSERT TO authenticated WITH CHECK (true);

-- User Settings Policies
CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. SUPABASE REALTIME CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.engagement_alerts;

-- ==============================================================================
-- 7. STORAGE BUCKET CONFIGURATION (course-files)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-files', 'course-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage bucket access policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public course-files read access" ON storage.objects;
  CREATE POLICY "Public course-files read access" ON storage.objects FOR SELECT USING (bucket_id = 'course-files');

  DROP POLICY IF EXISTS "Authenticated users can upload course-files" ON storage.objects;
  CREATE POLICY "Authenticated users can upload course-files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'course-files');

  DROP POLICY IF EXISTS "Authenticated users can update course-files" ON storage.objects;
  CREATE POLICY "Authenticated users can update course-files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'course-files');

  DROP POLICY IF EXISTS "Authenticated users can delete course-files" ON storage.objects;
  CREATE POLICY "Authenticated users can delete course-files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'course-files');
END $$;
