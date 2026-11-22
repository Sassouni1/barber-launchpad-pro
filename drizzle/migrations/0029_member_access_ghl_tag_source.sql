-- Allow one more access source: the exact HighLevel member-access tag
-- (barber-launch-member-access) in the approved Barber Launch location.
-- A tag grant is not a purchase; the server creates/revokes only its own row.
ALTER TABLE public.member_access_grants DROP CONSTRAINT member_access_grants_source_check;
ALTER TABLE public.member_access_grants ADD CONSTRAINT member_access_grants_source_check
  CHECK (source = ANY (ARRAY['stripe_checkout'::text, 'stripe_charge'::text, 'ghl_transaction'::text, 'hair_system_order'::text, 'admin_grant'::text, 'owner_legacy_confirmation'::text, 'ghl_member_tag'::text]));
