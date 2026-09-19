-- Keeps each member's Stripe customer and opted-in default payment method separate
-- from advertising billing, so saved cards are used only for member purchases.
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

CREATE POLICY "Members read own member billing profile"
  ON public.member_billing_profiles
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Admins read all member billing profiles"
  ON public.member_billing_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_member_billing_profiles_updated_at
  BEFORE UPDATE ON public.member_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
