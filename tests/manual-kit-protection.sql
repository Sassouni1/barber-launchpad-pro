-- Run only against a disposable PostgreSQL database after migration 0009.
BEGIN;
INSERT INTO public.orders (id, customer_name, customer_email, external_order_id, order_details)
VALUES ('11111111-1111-4111-8111-111111111111', 'Jane Exact', 'Jane@Example.com',
  'manual-kit:11111111-1111-4111-8111-111111111111',
  '{"manual_source":"admin_entry","supplier_kit":true,"manual_facts":{"name":"Jane Exact"},"full_name":"Jane Exact","phone":"(555) 111-2222","shipping_address":{"address1":"10 Main St","postal_code":"10001"},"notes":"exact note","order":[{"item":"kit"}]}'::jsonb);

-- Supplier progress remains editable.
UPDATE public.orders SET status = 'shipped', tracking_number = 'TRACK-1',
  order_details = order_details || '{"supplier_status":"shipped"}'::jsonb
WHERE id = '11111111-1111-4111-8111-111111111111';

DO $$
DECLARE attempt text;
BEGIN
  FOREACH attempt IN ARRAY ARRAY['name','address','notes','source','kit','delete'] LOOP
    BEGIN
      CASE attempt
        WHEN 'name' THEN UPDATE public.orders SET customer_name = 'Automated overwrite' WHERE id = '11111111-1111-4111-8111-111111111111';
        WHEN 'address' THEN UPDATE public.orders SET order_details = jsonb_set(order_details, '{shipping_address,address1}', '"Different"') WHERE id = '11111111-1111-4111-8111-111111111111';
        WHEN 'notes' THEN UPDATE public.orders SET order_details = jsonb_set(order_details, '{notes}', '"Different"') WHERE id = '11111111-1111-4111-8111-111111111111';
        WHEN 'source' THEN UPDATE public.orders SET order_details = order_details - 'manual_source' WHERE id = '11111111-1111-4111-8111-111111111111';
        WHEN 'kit' THEN UPDATE public.orders SET order_details = jsonb_set(order_details, '{supplier_kit}', 'false') WHERE id = '11111111-1111-4111-8111-111111111111';
        WHEN 'delete' THEN DELETE FROM public.orders WHERE id = '11111111-1111-4111-8111-111111111111';
      END CASE;
      RAISE EXCEPTION 'Protection did not block %', attempt;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT IN ('Manual kit facts are immutable.', 'Manual kit records cannot be deleted or overwritten.') THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

DO $$ BEGIN
  IF (SELECT status = 'shipped' AND tracking_number = 'TRACK-1' AND order_details->>'notes' = 'exact note'
      FROM public.orders WHERE id = '11111111-1111-4111-8111-111111111111') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Supplier progress or manual facts changed';
  END IF;
  IF (public.manual_kit_duplicate_state('jane@example.com', '5551112222', 'Jane Exact', '10 Main St', '10001', gen_random_uuid())->>'matching_orders')::int <> 1 THEN
    RAISE EXCEPTION 'Duplicate lookup missed manual row';
  END IF;
END $$;

-- A second request UUID cannot duplicate the buyer or phone.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.orders (customer_name, customer_email, order_details)
    VALUES ('Jane Again', ' jane@example.com ', '{"supplier_kit":true}'::jsonb);
    RAISE EXCEPTION 'Email uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.orders (customer_name, customer_email, order_details)
    VALUES ('Jane Again', 'other@example.com', '{"kit_order":true,"phone":"555-111-2222"}'::jsonb);
    RAISE EXCEPTION 'Phone uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- An uncertain claim with no order still blocks a new request key and changed phone.
INSERT INTO public.hair_system_kit_manual_recoveries
  (request_key, identity_key, admin_id, preview_facts, status)
VALUES ('22222222-2222-4222-8222-222222222222', 'first-attempt',
  '33333333-3333-4333-8333-333333333333', '{"email":"claim@example.com","phone":"5553334444"}', 'uncertain');
DO $$ BEGIN
  IF (public.manual_kit_duplicate_state('claim@example.com', '5559990000', 'Other', '1 Other St', '10002',
    '44444444-4444-4444-8444-444444444444')->>'manual_claims')::int <> 1 THEN
    RAISE EXCEPTION 'Prior claim was missed';
  END IF;
  BEGIN
    INSERT INTO public.hair_system_kit_manual_recoveries
      (request_key, identity_key, admin_id, preview_facts)
    VALUES ('55555555-5555-4555-8555-555555555555', 'second-attempt',
      '33333333-3333-4333-8333-333333333333', '{"email":"CLAIM@example.com","phone":"5559990000"}');
    RAISE EXCEPTION 'Claim email uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
