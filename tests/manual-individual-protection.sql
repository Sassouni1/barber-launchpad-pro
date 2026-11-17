-- Run in a disposable local database after migrations 0009 and 0011.
BEGIN;
INSERT INTO public.orders (id, customer_name, customer_email, external_order_id, status, order_details)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic Buyer', '',
  'manual-individual:11111111-1111-4111-8111-111111111111', 'pending',
  '{"manual_source":"admin_entry","manual_individual":true,"supplier_kit":false,"manual_identity_key":"exact-fingerprint","manual_request_key":"11111111-1111-4111-8111-111111111111","full_name":"Synthetic Buyer","phone":"","shipping_address":{"address1":"1 Test St","postal_code":"10001"},"notes":"exact","individual_item":"Skin hair system","individual_variant":"#2 FRO skin unit","quantity":1,"manual_supplier_cost_cents":null,"Lace or Skin":"Skin","Choose Color":"#2 FRO skin unit","order":{"line_items":[{"title":"Skin hair system — #2 FRO skin unit","quantity":1}]},"manual_facts":{"name":"Synthetic Buyer"}}'::jsonb);
INSERT INTO public.hair_system_manual_individual_claims
  (request_key, fingerprint, admin_id, preview_facts, supplier_order_id, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'exact-fingerprint',
  '33333333-3333-4333-8333-333333333333', '{"name":"Synthetic Buyer"}',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sent');
INSERT INTO public.hair_system_kit_deliveries (location_id, entitlement_key, ghl_order_id, order_id, status, message_id)
VALUES ('JVBUuL3dVwZahuGay9T1', 'individual:exact-fingerprint:first', null,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sent', 'synthetic-message');

-- Ordinary tracking and supplier status may advance.
UPDATE public.orders SET status = 'processing', tracking_number = 'TRACK123',
  order_details = order_details || '{"supplier_status":"ordered"}'::jsonb
WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

DO $$
DECLARE attempt text;
BEGIN
  FOREACH attempt IN ARRAY ARRAY['variant','item','cost','designation','source','shipping','delete'] LOOP
    BEGIN
      CASE attempt
        WHEN 'variant' THEN UPDATE public.orders SET order_details = jsonb_set(order_details,'{individual_variant}','"dark black"') WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        WHEN 'item' THEN UPDATE public.orders SET order_details = jsonb_set(order_details,'{individual_item}','"Lace system"') WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        WHEN 'cost' THEN UPDATE public.orders SET order_details = jsonb_set(order_details,'{manual_supplier_cost_cents}','16000') WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        WHEN 'designation' THEN UPDATE public.orders SET order_details = order_details - 'manual_individual' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        WHEN 'source' THEN UPDATE public.orders SET order_details = order_details - 'manual_source' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        WHEN 'shipping' THEN UPDATE public.orders SET order_details = jsonb_set(order_details,'{shipping_address,address1}','"2 Other St"') WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        WHEN 'delete' THEN DELETE FROM public.orders WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      END CASE;
      RAISE EXCEPTION 'Overwrite was allowed: %', attempt;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT IN ('Manual individual order facts are immutable.',
        'Manual individual order cannot be deleted.', 'Manual kit facts are immutable.',
        'Manual kit records cannot be deleted or overwritten.') THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

DO $$
DECLARE first jsonb; repeated jsonb;
BEGIN
  first := public.manual_individual_duplicate_state('exact-fingerprint',
    '22222222-2222-4222-8222-222222222222', null, 'Synthetic Buyer', '1 Test St', '10001', '#2 FRO skin unit');
  IF (first->>'prior_orders')::int <> 1 OR (first->>'matching_claims')::int <> 1 THEN
    RAISE EXCEPTION 'Fresh retry was not blocked'; END IF;
  repeated := public.manual_individual_duplicate_state('exact-fingerprint',
    '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Synthetic Buyer', '1 Test St', '10001', '#2 FRO skin unit');
  IF repeated->>'parent_valid' <> 'true' OR (repeated->>'prior_orders')::int <> 0 OR
    (repeated->>'matching_claims')::int <> 0 THEN RAISE EXCEPTION 'Intentional repeat was blocked'; END IF;
END $$;
INSERT INTO public.hair_system_manual_individual_claims
  (request_key, fingerprint, repeat_of_order_id, admin_id, preview_facts, status)
VALUES ('22222222-2222-4222-8222-222222222222', 'exact-fingerprint',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333',
  '{"name":"Synthetic Buyer","repeat_confirmed":true}', 'reserved');
DO $$ BEGIN
  IF (public.manual_individual_duplicate_state('exact-fingerprint',
    '44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Synthetic Buyer', '1 Test St', '10001', '#2 FRO skin unit')->>'matching_claims')::int <> 1 THEN
    RAISE EXCEPTION 'Repeat retry was not blocked'; END IF;
  BEGIN
    INSERT INTO public.hair_system_manual_individual_claims
      (request_key, fingerprint, repeat_of_order_id, admin_id, preview_facts)
    VALUES ('55555555-5555-4555-8555-555555555555', 'exact-fingerprint',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', '{}');
    RAISE EXCEPTION 'Concurrent repeat claim was allowed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
-- A normal checkout row uses the older `shipping.address_1/zip` shape.
INSERT INTO public.orders (customer_name, customer_email, status, order_details)
VALUES ('Synthetic Buyer', 'buyer@example.test', 'pending',
  '{"shipping":{"address_1":"1 Test St","zip":"10001"},"Choose Color":"#2 FRO skin unit","Lace or Skin":"Skin"}'::jsonb);
DO $$ BEGIN
  IF (public.manual_individual_duplicate_state('different-fingerprint',
    '88888888-8888-4888-8888-888888888888', null,
    'Synthetic Buyer', '1 Test St', '10001', '#2 FRO skin unit')->>'external_orders')::int <> 1 THEN
    RAISE EXCEPTION 'Normal checkout duplicate was missed'; END IF;
END $$;
INSERT INTO public.hair_system_manual_individual_claims
  (request_key, fingerprint, admin_id, preview_facts, status)
VALUES ('99999999-9999-4999-8999-999999999999', 'claim-only',
  '33333333-3333-4333-8333-333333333333', '{"name":"Claim Only"}', 'uncertain');
DO $$ BEGIN
  IF (public.manual_individual_duplicate_state('claim-only',
    'abababab-abab-4bab-8bab-abababababab', null, 'Claim Only', '9 Test St', '10001', '#2')->>'matching_claims')::int <> 1 THEN
    RAISE EXCEPTION 'Uncertain claim without order was missed'; END IF;
END $$;
ROLLBACK;
