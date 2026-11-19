-- Services and prices a member confirms for their website.
-- Stored in service_menu (the older services text[] column holds names only). Each item: { name, price, duration, description }. source = 'booking' | 'manual'.
alter table public.member_onboarding_profiles
  add column if not exists service_menu jsonb not null default '[]'::jsonb,
  add column if not exists services_source text,
  add column if not exists services_confirmed_at timestamptz;

alter table public.member_onboarding_profiles
  drop constraint if exists member_onboarding_profiles_service_menu_is_array;
alter table public.member_onboarding_profiles
  add constraint member_onboarding_profiles_service_menu_is_array
  check (jsonb_typeof(service_menu) = 'array' and jsonb_array_length(service_menu) <= 60);

alter table public.member_onboarding_profiles
  drop constraint if exists member_onboarding_profiles_services_source_check;
alter table public.member_onboarding_profiles
  add constraint member_onboarding_profiles_services_source_check
  check (services_source is null or services_source in ('booking', 'manual'));
