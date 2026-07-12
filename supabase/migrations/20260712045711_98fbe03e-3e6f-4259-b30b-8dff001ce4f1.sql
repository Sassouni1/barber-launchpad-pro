ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS certification_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.certifications.certification_version IS
  'Internal-only marker: 1 is the original record; 2 means a legacy record was successfully re-submitted.';