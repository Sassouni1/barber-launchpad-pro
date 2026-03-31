ALTER TABLE public.group_calls
  ADD COLUMN call_hour integer NOT NULL DEFAULT 7,
  ADD COLUMN call_minute integer NOT NULL DEFAULT 0,
  ADD COLUMN call_ampm text NOT NULL DEFAULT 'PM',
  ADD COLUMN call_timezone text NOT NULL DEFAULT 'EST';