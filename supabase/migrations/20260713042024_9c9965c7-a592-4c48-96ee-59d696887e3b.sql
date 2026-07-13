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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_watch_progress TO authenticated;
GRANT ALL ON public.video_watch_progress TO service_role;

ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own video watch progress" ON public.video_watch_progress;
CREATE POLICY "Members can view own video watch progress"
  ON public.video_watch_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can insert own video watch progress" ON public.video_watch_progress;
CREATE POLICY "Members can insert own video watch progress"
  ON public.video_watch_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update own video watch progress" ON public.video_watch_progress;
CREATE POLICY "Members can update own video watch progress"
  ON public.video_watch_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all video watch progress" ON public.video_watch_progress;
CREATE POLICY "Admins can view all video watch progress"
  ON public.video_watch_progress FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS video_watch_progress_user_course_idx
  ON public.video_watch_progress (user_id, course_id, module_id);

ALTER TABLE public.video_watch_progress
  ADD COLUMN IF NOT EXISTS watched_seconds_map INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.video_watch_progress.watched_seconds_map IS
  'Unique integer seconds watched for this user/video, used for cross-device watch continuity.';

DROP TRIGGER IF EXISTS update_video_watch_progress_updated_at ON public.video_watch_progress;
CREATE TRIGGER update_video_watch_progress_updated_at
  BEFORE UPDATE ON public.video_watch_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();