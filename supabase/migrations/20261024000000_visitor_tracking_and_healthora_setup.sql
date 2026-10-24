-- ============================================================================
-- HEALTHORA 2.0 — SUPABASE DATABASE SETUP & VISITOR TRACKING SCHEMA
-- Project ID: eltheprswohoxxhxxtdl
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eltheprswohoxxhxxtdl/sql/new
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. SITE VISITS & WEBSITE VISITORS DIRECTORY TABLES
-- Stores every person who visited the Healthora website (unique visitors + page views)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.website_visitors (
    visitor_id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT DEFAULT 'Website Visitor',
    last_page_path TEXT DEFAULT '/',
    device_type TEXT,
    browser TEXT,
    os TEXT,
    screen_resolution TEXT,
    language TEXT DEFAULT 'en',
    ip_address TEXT,
    first_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.website_visitors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'website_visitors' AND policyname = 'Anyone can upsert website visitors') THEN
        CREATE POLICY "Anyone can upsert website visitors" ON public.website_visitors FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.site_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id TEXT NOT NULL,
    session_id TEXT,
    page_path TEXT NOT NULL DEFAULT '/',
    page_title TEXT,
    referrer TEXT,
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    screen_resolution TEXT,
    language TEXT DEFAULT 'en',
    ip_address TEXT,
    user_id TEXT,
    user_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    visited_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for analytics and fast querying
CREATE INDEX IF NOT EXISTS idx_site_visits_visitor_id ON public.site_visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_visited_at ON public.site_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visits_page_path ON public.site_visits(page_path);

-- Enable Row Level Security (RLS)
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- Allow anonymous visitors and authenticated users to log website visits
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_visits' AND policyname = 'Anyone can insert website visits') THEN
        CREATE POLICY "Anyone can insert website visits" ON public.site_visits FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_visits' AND policyname = 'Anyone can view website visits') THEN
        CREATE POLICY "Anyone can view website visits" ON public.site_visits FOR SELECT USING (true);
    END IF;
END $$;

-- ============================================================================
-- 3. USER PROFILES & AUTHENTICATION TRIGGER
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferred_name TEXT NOT NULL,
    preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'te')),
    dob DATE,
    gender TEXT,
    blood_group TEXT,
    abha_number TEXT,
    allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
    chronic_conditions TEXT[] DEFAULT ARRAY[]::TEXT[],
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
        CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile') THEN
        CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can delete their own profile') THEN
        CREATE POLICY "Users can delete their own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);
    END IF;
END $$;

-- Automated profile provisioning trigger when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, preferred_name, preferred_language, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Patient'),
        'en',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_settings (user_id, updated_at)
    VALUES (NEW.id, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. USER SETTINGS & NOTIFICATION PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    water_target_ml INT DEFAULT 2500 NOT NULL,
    sleep_target_hours NUMERIC(4,2) DEFAULT 8.0 NOT NULL,
    activity_target_minutes INT DEFAULT 45 NOT NULL,
    time_zone TEXT DEFAULT 'Asia/Kolkata' NOT NULL,
    ai_preferred_language TEXT DEFAULT 'en' CHECK (ai_preferred_language IN ('en', 'hi', 'te')),
    ai_response_detail TEXT DEFAULT 'balanced' CHECK (ai_response_detail IN ('concise', 'balanced', 'detailed')),
    enable_browser_notifications BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'Users can manage their own settings') THEN
        CREATE POLICY "Users can manage their own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================================
-- 5. DAILY TRACKING LOGS (Water, Sleep, Meals, Activity, Mood)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_tracking_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('water', 'sleep', 'meal', 'activity', 'mood', 'vital')),
    date_logged DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_numeric NUMERIC,
    amount_unit TEXT,
    title TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_user_date ON public.daily_tracking_entries(user_id, date_logged DESC);
ALTER TABLE public.daily_tracking_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_tracking_entries' AND policyname = 'Anyone can log tracking') THEN
        CREATE POLICY "Anyone can log tracking" ON public.daily_tracking_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 6. HEALTH JOURNAL & CLINICAL NOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.health_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    symptoms TEXT[] DEFAULT ARRAY[]::TEXT[],
    severity TEXT CHECK (severity IN ('Mild', 'Moderate', 'Severe')),
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.health_journal_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_journal_entries' AND policyname = 'Anyone can manage journal') THEN
        CREATE POLICY "Anyone can manage journal" ON public.health_journal_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 7. MEDICAL DOCUMENTS & LAB RESULTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.medical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    document_type TEXT NOT NULL,
    document_date DATE NOT NULL DEFAULT CURRENT_DATE,
    facility TEXT,
    doctor TEXT,
    upload_status TEXT DEFAULT 'uploaded',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'medical_documents' AND policyname = 'Anyone can manage documents') THEN
        CREATE POLICY "Anyone can manage documents" ON public.medical_documents FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID,
    user_id UUID NOT NULL,
    test_name TEXT NOT NULL,
    category TEXT NOT NULL,
    value_numeric NUMERIC,
    value_text TEXT NOT NULL,
    unit TEXT,
    reference_low NUMERIC,
    reference_high NUMERIC,
    reference_range_text TEXT,
    source_interpretation TEXT,
    observed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    clinical_explanation_en TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lab_results' AND policyname = 'Anyone can manage lab results') THEN
        CREATE POLICY "Anyone can manage lab results" ON public.lab_results FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Verify setup notice
DO $$ BEGIN
    RAISE NOTICE 'Healthora 2.0 Supabase database schema installed successfully with site_visits and health tables!';
END $$;
