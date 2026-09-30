INSERT INTO public.app_settings (key, value) VALUES ('hair_system_fulfillment_cutover', jsonb_build_object(
  'at', to_char(now() AT TIME ZONE 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'excluded_order_ids', jsonb_build_array(
    '4809a521-9d4b-43c8-8be5-e6814b2cd113','c3aef2be-7b37-4575-b4f1-538c869f500d',
    'f2ca7052-7dfd-4db2-bd22-c2347ba4b2a7','ab36e2e1-33f9-4236-b157-c2e1021b04f2',
    'fa6a29dc-62e3-49ad-9927-e1093ad59fd0','536c2636-9117-40d7-9e4a-dc88af0fa304')))
ON CONFLICT (key) DO NOTHING;