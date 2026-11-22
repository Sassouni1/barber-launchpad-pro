-- Existing accounts (created before the fixed new-account cutover, by the server's
-- auth.users.created_at) keep member access regardless of the full access switch or
-- the manufacturer role. Only an explicit admin revocation after the cutover ends it;
-- automatic refund/dispute updates (revoked_by_system) never silently exclude them.
CREATE OR REPLACE FUNCTION public.member_legacy_access_allowed(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
    AND (auth.uid() IS NULL OR auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin'))
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND u.created_at < public.member_access_new_account_cutover()
        AND NOT EXISTS (
          SELECT 1 FROM public.member_access_grants g
          WHERE g.status = 'revoked'
            AND g.revoked_by IS NOT NULL
            AND g.revoked_by_system = false
            AND g.revoked_at >= public.member_access_new_account_cutover()
            AND (g.user_id = u.id OR (g.user_id IS NULL AND g.email_normalized IS NOT NULL AND g.email_normalized = lower(trim(u.email))))
        )
    )
$$;

COMMENT ON FUNCTION public.member_legacy_access_allowed(uuid) IS
  'Existing-account member access: accounts created before member_access_new_account_cutover() keep access unless an admin explicitly revoked it after the cutover.';

REVOKE ALL ON FUNCTION public.member_legacy_access_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_legacy_access_allowed(uuid) TO authenticated, service_role;