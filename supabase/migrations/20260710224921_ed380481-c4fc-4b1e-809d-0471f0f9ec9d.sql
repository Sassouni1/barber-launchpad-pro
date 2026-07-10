CREATE TABLE public.password_reset_requirements (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  required boolean NOT NULL DEFAULT true,
  requested_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_requirements_email_normalized CHECK (email = lower(trim(email)))
);

GRANT SELECT ON public.password_reset_requirements TO authenticated;
GRANT ALL ON public.password_reset_requirements TO service_role;

ALTER TABLE public.password_reset_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own password reset requirement"
ON public.password_reset_requirements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view password reset requirements"
ON public.password_reset_requirements
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage password reset requirements"
ON public.password_reset_requirements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_password_reset_requirements_updated_at
BEFORE UPDATE ON public.password_reset_requirements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.password_reset_required_for_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.password_reset_requirements
    WHERE email = lower(trim(_email))
      AND required = true
      AND completed_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.password_reset_required_for_email(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_requires_password_reset()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.password_reset_requirements
    WHERE user_id = auth.uid()
      AND required = true
      AND completed_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_requires_password_reset() TO authenticated;