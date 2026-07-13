-- Internal Vimeo watch analytics and durable resume state.
-- This is deliberately separate from user_progress so watch percentage never
-- changes lesson completion or certification eligibility.
CREATE TABLE IF NOT EXISTS public.video_watch_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  video_key TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  watched_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (watched_percent >= 0 AND watched_percent <= 100),
  last_position_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  last_watched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_key)
);

ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own video watch progress"
  ON public.video_watch_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members can insert own video watch progress"
  ON public.video_watch_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update own video watch progress"
  ON public.video_watch_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all video watch progress"
  ON public.video_watch_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS video_watch_progress_user_course_idx
  ON public.video_watch_progress (user_id, course_id, module_id);
