ALTER TABLE public.affiliate_commissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'affiliate';

ALTER TABLE public.affiliate_commissions
  DROP CONSTRAINT IF EXISTS affiliate_commissions_source_check;
ALTER TABLE public.affiliate_commissions
  ADD CONSTRAINT affiliate_commissions_source_check CHECK (source IN ('affiliate','content'));

CREATE TABLE public.content_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('before_after','install_video','other')),
  title text,
  note text,
  file_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reward_cents integer,
  commission_id uuid UNIQUE REFERENCES public.affiliate_commissions(id) ON DELETE SET NULL,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  consent_use_content boolean NOT NULL DEFAULT false,
  consent_subject_permission boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_submissions_user ON public.content_submissions(user_id, created_at DESC);
CREATE INDEX idx_content_submissions_status ON public.content_submissions(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.content_submissions TO authenticated;
GRANT ALL ON public.content_submissions TO service_role;

ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own submissions, admins read all"
  ON public.content_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Members create own submissions"
  ON public.content_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND consent_use_content = true AND consent_subject_permission = true);

CREATE POLICY "Members edit own pending submissions"
  ON public.content_submissions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid() AND status IN ('pending','withdrawn'));

CREATE POLICY "Admins review submissions"
  ON public.content_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_content_submissions_updated_at
  BEFORE UPDATE ON public.content_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();