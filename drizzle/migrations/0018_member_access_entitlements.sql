CREATE TABLE public.member_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email_normalized text,
  source text NOT NULL CHECK (source IN ('stripe_checkout','stripe_charge','ghl_transaction','hair_system_order','admin_grant','owner_legacy_confirmation')),
  evidence_ref text NOT NULL,
  amount_cents integer,
  currency text,
  paid_at timestamptz,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  status_reason text,
  revoked_by_system boolean NOT NULL DEFAULT false,
  granted_by uuid,
  revoked_by uuid,
  revoked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, evidence_ref),
  CHECK (user_id IS NOT NULL OR email_normalized IS NOT NULL)
);
CREATE INDEX member_access_grants_user_idx ON public.member_access_grants (user_id) WHERE status = 'active';
CREATE INDEX member_access_grants_email_idx ON public.member_access_grants (email_normalized) WHERE status = 'active';

GRANT SELECT ON public.member_access_grants TO authenticated;
GRANT ALL ON public.member_access_grants TO service_role;
ALTER TABLE public.member_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view member access grants" ON public.member_access_grants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.member_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid,
  user_id uuid,
  email_normalized text,
  action text NOT NULL,
  actor uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_access_events_grant_idx ON public.member_access_events (grant_id, created_at);
GRANT SELECT ON public.member_access_events TO authenticated;
GRANT ALL ON public.member_access_events TO service_role;
ALTER TABLE public.member_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view member access events" ON public.member_access_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.prevent_member_access_event_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'member_access_events is append-only';
END;
$$;
CREATE TRIGGER member_access_events_append_only
  BEFORE UPDATE OR DELETE ON public.member_access_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_member_access_event_change();

CREATE TABLE public.member_access_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('stripe_charge','ghl_transaction')),
  evidence_ref text NOT NULL,
  email_normalized text,
  amount_cents integer,
  amount_refunded_cents integer NOT NULL DEFAULT 0,
  currency text,
  paid_at timestamptz,
  disputed boolean NOT NULL DEFAULT false,
  livemode boolean NOT NULL DEFAULT true,
  qualifies boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  description text,
  audited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, evidence_ref)
);
GRANT SELECT ON public.member_access_evidence TO authenticated;
GRANT ALL ON public.member_access_evidence TO service_role;
ALTER TABLE public.member_access_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view member access evidence" ON public.member_access_evidence
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_member_access_grant_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _action text;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    _action := CASE WHEN NEW.status = 'active' THEN 'granted' ELSE 'recorded_revoked' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _action := CASE WHEN NEW.status = 'active' THEN 'reinstated' ELSE 'revoked' END;
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    _action := 'linked';
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.member_access_events (grant_id, user_id, email_normalized, action, actor, reason, details)
  VALUES (NEW.id, NEW.user_id, NEW.email_normalized, _action,
          CASE WHEN NEW.status = 'revoked' THEN NEW.revoked_by ELSE NEW.granted_by END,
          NEW.status_reason,
          jsonb_build_object('source', NEW.source, 'evidence_ref', NEW.evidence_ref,
                             'previous_user_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.user_id END,
                             'system', NEW.revoked_by_system));
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_access_grants_audit
  BEFORE INSERT OR UPDATE ON public.member_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.log_member_access_grant_change();

CREATE OR REPLACE FUNCTION public.member_access_enforced()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT (value->>'enabled')::boolean FROM public.app_settings WHERE key = 'member_access_enforcement'), false)
$$;

-- Answers only for the caller (or any user for admins / server).
CREATE OR REPLACE FUNCTION public.has_member_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
    AND (auth.uid() IS NULL OR auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin'))
    AND (
      public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.member_access_grants g
        WHERE g.status = 'active'
          AND (
            g.user_id = _user_id
            OR (g.user_id IS NULL AND g.email_normalized IS NOT NULL
                AND g.email_normalized = (SELECT lower(trim(u.email)) FROM auth.users u WHERE u.id = _user_id))
          )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.member_content_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (NOT public.member_access_enforced() OR public.has_member_access(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.my_member_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'enforced', public.member_access_enforced(),
    'hasAccess', public.has_member_access(auth.uid()),
    'allowed', public.member_content_allowed()
  )
$$;

REVOKE ALL ON FUNCTION public.has_member_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_member_access(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.member_content_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_content_allowed() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_member_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_member_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.member_access_enforced() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.member_access_payment_exclusion(_p public.affiliate_payments)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT _p.livemode THEN 'test_mode'
    WHEN COALESCE(_p.gross_amount_cents, 0) <= 0 THEN 'no_amount'
    WHEN _p.customer_email_normalized IS NULL OR _p.customer_email_normalized = '' THEN 'no_email'
    WHEN EXISTS (SELECT 1 FROM public.ad_payment_transactions t WHERE t.stripe_checkout_session_id = _p.stripe_object_id) THEN 'ad_funding'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_member_access_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _excluded text;
  _revoke text;
BEGIN
  BEGIN
    _excluded := public.member_access_payment_exclusion(NEW);
    IF _excluded IS NOT NULL THEN RETURN NEW; END IF;
    _revoke := CASE
      WHEN NEW.disputed THEN 'disputed'
      WHEN COALESCE(NEW.refunded_amount_cents, 0) >= NEW.gross_amount_cents THEN 'refunded'
      ELSE NULL END;
    INSERT INTO public.member_access_grants AS g
      (email_normalized, source, evidence_ref, amount_cents, currency, paid_at, status, status_reason, revoked_by_system, revoked_at)
    VALUES (NEW.customer_email_normalized, 'stripe_checkout', NEW.stripe_object_id, NEW.gross_amount_cents, NEW.currency, NEW.paid_at,
            CASE WHEN _revoke IS NULL THEN 'active' ELSE 'revoked' END,
            COALESCE(_revoke, 'stripe_paid_checkout'), _revoke IS NOT NULL,
            CASE WHEN _revoke IS NULL THEN NULL ELSE now() END)
    ON CONFLICT (source, evidence_ref) DO UPDATE SET
      status = CASE
        WHEN g.revoked_by IS NOT NULL THEN g.status
        WHEN _revoke IS NULL THEN 'active' ELSE 'revoked' END,
      status_reason = CASE
        WHEN g.revoked_by IS NOT NULL THEN g.status_reason
        ELSE COALESCE(_revoke, 'stripe_paid_checkout') END,
      revoked_by_system = CASE WHEN g.revoked_by IS NOT NULL THEN g.revoked_by_system ELSE _revoke IS NOT NULL END,
      revoked_at = CASE
        WHEN g.revoked_by IS NOT NULL THEN g.revoked_at
        WHEN _revoke IS NULL THEN NULL ELSE COALESCE(g.revoked_at, now()) END;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'member access sync failed for payment %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER affiliate_payments_member_access
  AFTER INSERT OR UPDATE ON public.affiliate_payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_access_from_payment();

CREATE OR REPLACE FUNCTION public.sync_member_access_from_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.user_id IS NOT NULL AND NEW.stripe_checkout_session_id IS NOT NULL
       AND NEW.status IS DISTINCT FROM 'pending_payment' THEN
      INSERT INTO public.member_access_grants (user_id, source, evidence_ref, paid_at, status_reason)
      VALUES (NEW.user_id, 'hair_system_order', NEW.stripe_checkout_session_id || ':' || NEW.user_id::text, NEW.created_at, 'paid_hair_system_order')
      ON CONFLICT (source, evidence_ref) DO NOTHING;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'member access sync failed for order %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_member_access
  AFTER INSERT OR UPDATE OF status, stripe_checkout_session_id, user_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_access_from_order();

REVOKE ALL ON FUNCTION public.sync_member_access_from_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_member_access_from_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_access_payment_exclusion(public.affiliate_payments) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_member_access_grant_change() FROM PUBLIC, anon, authenticated;

INSERT INTO public.member_access_grants
  (email_normalized, source, evidence_ref, amount_cents, currency, paid_at, status, status_reason, revoked_by_system, revoked_at)
SELECT p.customer_email_normalized, 'stripe_checkout', p.stripe_object_id, p.gross_amount_cents, p.currency, p.paid_at,
  CASE WHEN p.disputed OR COALESCE(p.refunded_amount_cents,0) >= p.gross_amount_cents THEN 'revoked' ELSE 'active' END,
  CASE WHEN p.disputed THEN 'disputed' WHEN COALESCE(p.refunded_amount_cents,0) >= p.gross_amount_cents THEN 'refunded' ELSE 'stripe_paid_checkout' END,
  (p.disputed OR COALESCE(p.refunded_amount_cents,0) >= p.gross_amount_cents),
  CASE WHEN p.disputed OR COALESCE(p.refunded_amount_cents,0) >= p.gross_amount_cents THEN now() END
FROM public.affiliate_payments p
WHERE public.member_access_payment_exclusion(p) IS NULL
ON CONFLICT (source, evidence_ref) DO NOTHING;

INSERT INTO public.member_access_grants (user_id, source, evidence_ref, paid_at, status_reason)
SELECT o.user_id, 'hair_system_order', o.stripe_checkout_session_id || ':' || o.user_id::text, min(o.created_at), 'paid_hair_system_order'
FROM public.orders o
WHERE o.user_id IS NOT NULL AND o.stripe_checkout_session_id IS NOT NULL AND o.status IS DISTINCT FROM 'pending_payment'
GROUP BY o.user_id, o.stripe_checkout_session_id
ON CONFLICT (source, evidence_ref) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES ('member_access_enforcement', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view courses" ON public.courses;
CREATE POLICY "Members can view courses" ON public.courses FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view modules" ON public.modules;
CREATE POLICY "Members can view modules" ON public.modules FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view lessons" ON public.lessons;
CREATE POLICY "Members can view lessons" ON public.lessons FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view module files" ON public.module_files;
CREATE POLICY "Members can view module files" ON public.module_files FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view module notes" ON public.module_notes;
CREATE POLICY "Members can view module notes" ON public.module_notes FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view note items" ON public.module_note_items;
CREATE POLICY "Members can view note items" ON public.module_note_items FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Members can view quiz questions" ON public.quiz_questions FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view dynamic todo lists" ON public.dynamic_todo_lists;
CREATE POLICY "Members can view dynamic todo lists" ON public.dynamic_todo_lists FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view dynamic todo items" ON public.dynamic_todo_items;
CREATE POLICY "Members can view dynamic todo items" ON public.dynamic_todo_items FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view group calls" ON public.group_calls;
CREATE POLICY "Members can view group calls" ON public.group_calls FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Members can view products" ON public.products FOR SELECT TO authenticated USING (public.member_content_allowed());
DROP POLICY IF EXISTS "Anyone can view certificate layouts" ON public.certificate_layouts;
CREATE POLICY "Members can view certificate layouts" ON public.certificate_layouts FOR SELECT TO authenticated USING (public.member_content_allowed());