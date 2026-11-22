-- Temporary new-account cutover. The moment is fixed in code (not a user- or
-- admin-editable setting) so it cannot be moved to reopen access.
CREATE OR REPLACE FUNCTION public.member_access_new_account_cutover()
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '2026-11-22 03:10:00+00'::timestamptz
$$;

-- Temporary access for accounts that existed before the cutover, only while the
-- full access check is off. Uses the server's auth.users.created_at, never metadata.
CREATE OR REPLACE FUNCTION public.member_legacy_access_allowed(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
    AND (auth.uid() IS NULL OR auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin'))
    AND NOT public.member_access_enforced()
    AND NOT (public.has_role(_user_id, 'manufacturer') AND NOT public.has_role(_user_id, 'admin'))
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND u.created_at < public.member_access_new_account_cutover()
        AND NOT EXISTS (
          SELECT 1 FROM public.member_access_grants g
          WHERE g.status = 'revoked'
            AND g.revoked_at >= public.member_access_new_account_cutover()
            AND (g.user_id = u.id OR (g.user_id IS NULL AND g.email_normalized IS NOT NULL AND g.email_normalized = lower(trim(u.email))))
        )
    )
$$;

-- Server-side decision for any account (edge functions call this with the service role).
CREATE OR REPLACE FUNCTION public.member_content_allowed_for(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
    AND (public.has_member_access(_user_id) OR public.member_legacy_access_allowed(_user_id))
$$;

CREATE OR REPLACE FUNCTION public.member_content_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.member_content_allowed_for(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.my_member_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'enforced', public.member_access_enforced(),
    'hasAccess', public.has_member_access(auth.uid()),
    'legacy', public.member_legacy_access_allowed(auth.uid()),
    'allowed', public.member_content_allowed()
  )
$$;

REVOKE ALL ON FUNCTION public.member_legacy_access_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_legacy_access_allowed(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.member_content_allowed_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_content_allowed_for(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.member_content_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_content_allowed() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_member_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_member_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.member_access_new_account_cutover() TO authenticated, service_role;

-- Course files: only accounts allowed to see training may read them.
DROP POLICY IF EXISTS "Anyone can view course files" ON storage.objects;
DROP POLICY IF EXISTS "Members can view course files" ON storage.objects;
CREATE POLICY "Members can view course files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'course-files' AND public.member_content_allowed());