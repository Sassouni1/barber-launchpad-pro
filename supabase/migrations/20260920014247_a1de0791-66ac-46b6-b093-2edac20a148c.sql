CREATE TABLE IF NOT EXISTS public.member_billing_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  default_payment_method_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.member_billing_profiles TO authenticated;
GRANT ALL ON public.member_billing_profiles TO service_role;

ALTER TABLE public.member_billing_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own member billing profile" ON public.member_billing_profiles;
CREATE POLICY "Members read own member billing profile"
  ON public.member_billing_profiles
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all member billing profiles" ON public.member_billing_profiles;
CREATE POLICY "Admins read all member billing profiles"
  ON public.member_billing_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_member_billing_profiles_updated_at ON public.member_billing_profiles;
CREATE TRIGGER trg_member_billing_profiles_updated_at
  BEFORE UPDATE ON public.member_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();