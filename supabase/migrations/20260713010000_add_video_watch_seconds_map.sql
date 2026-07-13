-- Preserve the exact watched-second map so resume and watch percentage survive
-- across devices instead of only retaining an aggregate count.
ALTER TABLE public.video_watch_progress
  ADD COLUMN IF NOT EXISTS watched_seconds_map INTEGER[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.video_watch_progress.watched_seconds_map IS
  'Unique integer seconds watched for this user/video, used for cross-device watch continuity.';
