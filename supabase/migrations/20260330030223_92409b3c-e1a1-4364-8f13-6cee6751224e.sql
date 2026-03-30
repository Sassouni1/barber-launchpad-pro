
-- Add phone column to profiles
ALTER TABLE public.profiles ADD COLUMN phone text;

-- Create sms_reminders tracking table
CREATE TABLE public.sms_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reminder_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  last_list_id uuid,
  last_progress_snapshot integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sms_reminders ENABLE ROW LEVEL SECURITY;

-- Users can read own row
CREATE POLICY "Users can view own sms reminders"
  ON public.sms_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "Admins can view all sms reminders"
  ON public.sms_reminders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role handles inserts/updates (edge function uses service role)
-- No insert/update policies needed for regular users
