REVOKE ALL ON public.member_checkout_claims FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.member_checkout_claims FROM authenticated;