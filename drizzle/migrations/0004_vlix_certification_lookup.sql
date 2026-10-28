-- A service-only lookup for the Vlix bridge. Profile email is editable, so
-- only Supabase Auth's confirmed email may identify the certificate holder.
create or replace function public.vlix_has_issued_hair_system_certificate(p_email text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as member
    join public.certifications as certificate on certificate.user_id = member.id
    join public.courses as course on course.id = certificate.course_id
    where lower(member.email) = lower(btrim(p_email))
      and member.email_confirmed_at is not null
      and course.category = 'hair-system'
  );
$$;

revoke all on function public.vlix_has_issued_hair_system_certificate(text) from public, anon, authenticated;
grant execute on function public.vlix_has_issued_hair_system_certificate(text) to service_role;
