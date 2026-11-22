// Real Stripe / database wiring for memberDomainBilling.ts. Server-only.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { LinkCustomer, LinkStatus, ResolveDeps, StripeGet, StripePost, WebhookDeps, DomainOrder } from "./memberDomainBilling.ts";

const STRIPE_VERSION = "2026-03-25.dahlia";
const REF_RE = /^(cs_live|pi|ch|py)_[A-Za-z0-9]+$/;

export function stripeApi(key: string): { get: StripeGet; post: StripePost } {
  const headers = { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION };
  return {
    async get(path) {
      const response = await fetch(`https://api.stripe.com/v1/${path}`, { headers });
      const data = await response.json().catch(() => ({}));
      if (response.status === 404 || data?.error?.code === "resource_missing") return null;
      if (!response.ok) throw new Error(`Stripe read failed: ${data?.error?.code ?? response.status}`);
      return data;
    },
    async post(path, form, idempotencyKey) {
      const response = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Stripe write failed: ${data?.error?.code ?? response.status}`);
      return data;
    },
  };
}

export function linkCustomerVia(db: SupabaseClient): LinkCustomer {
  return async (userId, customerId, source, paymentMethodId = null) => {
    const { data, error } = await db.rpc("link_member_stripe_customer", {
      _user_id: userId, _stripe_customer_id: customerId, _source: source, _payment_method_id: paymentMethodId,
    });
    if (error) throw new Error("Billing link failed");
    return data as LinkStatus;
  };
}

export function resolveDepsFor(db: SupabaseClient, stripeGet: StripeGet): ResolveDeps {
  return {
    async loadProfile(userId) {
      const { data, error } = await db.from("member_billing_profiles")
        .select("stripe_customer_id, default_payment_method_id").eq("customer_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async listClaims(userId) {
      const { data, error } = await db.from("member_checkout_claims")
        .select("checkout_session_id, payment_intent_id, charge_id").eq("user_id", userId).eq("status", "claimed");
      if (error) throw error;
      return data ?? [];
    },
    async listGrants(userId) {
      const { data, error } = await db.from("member_access_grants")
        .select("source, evidence_ref").eq("user_id", userId).eq("status", "active")
        .in("source", ["stripe_checkout", "stripe_charge", "hair_system_order"])
        .order("paid_at", { ascending: false, nullsFirst: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
    stripeGet,
    async refsOwnedByOthers(userId, refs) {
      const clean = refs.filter(ref => REF_RE.test(ref));
      for (let i = 0; i < clean.length; i += 100) {
        const chunk = clean.slice(i, i + 100);
        const { data: grants, error } = await db.from("member_access_grants").select("user_id")
          .in("evidence_ref", chunk).not("user_id", "is", null).neq("user_id", userId).limit(1);
        if (error) throw error;
        if (grants?.length) return true;
        for (const column of ["checkout_session_id", "payment_intent_id", "charge_id"]) {
          const { data: claims, error: claimError } = await db.from("member_checkout_claims").select("user_id")
            .in(column, chunk).not("user_id", "is", null).neq("user_id", userId).limit(1);
          if (claimError) throw claimError;
          if (claims?.length) return true;
        }
      }
      return false;
    },
    linkCustomer: linkCustomerVia(db),
  };
}

export function webhookDepsFor(db: SupabaseClient, stripe: { get: StripeGet; post: StripePost }): WebhookDeps {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const token = Deno.env.get("CLOUDFLARE_REGISTRAR_API_TOKEN") ?? "";
  return {
    stripeGet: stripe.get,
    stripePost: stripe.post,
    registrar: accountId && token ? { accountId, token } : null,
    async cloudflare(path, init = {}) {
      const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok && data?.success !== false, status: response.status, data };
    },
    async loadOrder(id) {
      const { data, error } = await db.from("member_domain_orders")
        .select("id, user_id, domain, status, member_charge_cents, cloudflare_cost_cents, stripe_session_id").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as DomainOrder | null;
    },
    async claimOrder(id, sessionId, paymentIntentId) {
      const { data, error } = await db.from("member_domain_orders").update({
        status: "registering", stripe_session_id: sessionId, stripe_payment_intent_id: paymentIntentId,
        updated_at: new Date().toISOString(),
      }).eq("id", id).in("status", ["checkout_open", "checkout_pending"]).select("id").maybeSingle();
      if (error) throw error;
      return !!data;
    },
    async updateOrder(id, patch) {
      const { error } = await db.from("member_domain_orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    async assignWebsite(userId, domain, state) {
      const { data, error } = await db.from("member_websites").update({
        custom_domain: domain, cloudflare_registration_status: state,
        cloudflare_attachment_status: "pending", cloudflare_last_error: null,
      }).eq("user_id", userId).is("custom_domain", null).select("id").maybeSingle();
      return !error && !!data;
    },
    linkCustomer: linkCustomerVia(db),
    log: message => console.log(message),
  };
}
