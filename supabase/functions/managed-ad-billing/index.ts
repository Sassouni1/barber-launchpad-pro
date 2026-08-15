import { createClient } from "npm:@supabase/supabase-js@2";
import {
  readManagedAdsWebhookSecret,
  writeManagedAdsWebhookSecret,
  VaultUnavailableError,
} from "../_shared/managedAdVault.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STRIPE_API = "https://api.stripe.com/v1";
const WEBHOOK_EVENT = "checkout.session.completed";
const MANAGED_ADS_ENDPOINT_TAG = "barber_launch_managed_ads";


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formEncode(values: Record<string, string | number | boolean | undefined>) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

async function stripeFetch(path: string, secret: string, options: { method?: string; body?: Record<string, string | number | boolean | undefined>; idempotencyKey?: string } = {}) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: options.method ?? "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body ? formEncode(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe error ${response.status}`);
  return data;
}

/**
 * Idempotently ensures exactly one enabled Stripe webhook endpoint for the managed-ads webhook URL
 * listening to checkout.session.completed, with its signing secret stored in Supabase Vault.
 * Never returns or logs the signing secret.
 */
async function ensureManagedAdsWebhookEndpoint(stripeSecret: string) {
  const webhookUrl = `${Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "")}/functions/v1/managed-ad-stripe-webhook`;
  const storedSecret = await readManagedAdsWebhookSecret();

  const list = await stripeFetch("/webhook_endpoints?limit=100", stripeSecret, { method: "GET" });
  const endpoints: Array<Record<string, any>> = Array.isArray(list?.data) ? list.data : [];
  const sameUrl = endpoints.filter((endpoint) => endpoint?.url === webhookUrl);
  const usable = sameUrl.find(
    (endpoint) => endpoint?.status === "enabled" && Array.isArray(endpoint?.enabled_events) &&
      (endpoint.enabled_events.includes(WEBHOOK_EVENT) || endpoint.enabled_events.includes("*")),
  );
  if (usable && storedSecret) return;

  const created = await stripeFetch("/webhook_endpoints", stripeSecret, {
    body: {
      url: webhookUrl,
      "enabled_events[0]": WEBHOOK_EVENT,
      description: "Barber Launch managed ads funding",
      [`metadata[${MANAGED_ADS_ENDPOINT_TAG}]`]: "true",
    },
  });
  if (typeof created?.secret !== "string" || created.secret.length === 0) {
    throw new Error("Stripe did not return a webhook signing secret.");
  }
  await writeManagedAdsWebhookSecret(created.secret);

  for (const endpoint of sameUrl) {
    if (!endpoint?.id || endpoint.id === created.id || endpoint.status === "disabled") continue;
    try {
      await stripeFetch(`/webhook_endpoints/${endpoint.id}`, stripeSecret, { body: { disabled: true } });
    } catch (error) {
      console.error("managed-ad-billing: failed to disable stale webhook endpoint", endpoint.id, error);
    }
  }
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const appUrl = Deno.env.get("MANAGED_AD_APP_URL");
    if (!stripeSecret || !appUrl) return json({ error: "Managed ad billing is not configured." }, 503);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice("Bearer ".length));
    const userId = claims?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === "createCheckout") {
      if (!isUuid(body?.campaignId) || !isUuid(body?.idempotencyKey)) return json({ error: "Invalid campaign or idempotency key." }, 400);
      const requestedAmountCents = Number(body?.amountCents);
      if (!Number.isInteger(requestedAmountCents) || requestedAmountCents < 200) return json({ error: "Choose a prepaid amount of at least $2." }, 400);
      const [{ data: campaign, error: campaignError }, { data: profile, error: profileError }] = await Promise.all([
        admin.from("ad_campaigns").select("id,name,daily_budget_cents,currency").eq("id", body.campaignId).eq("customer_id", userId).maybeSingle(),
        admin.from("profiles").select("email,full_name").eq("id", userId).maybeSingle(),
      ]);
      if (campaignError || profileError) throw campaignError || profileError;
      if (!campaign || !profile?.email) return json({ error: "Campaign or billing profile not found." }, 404);

      let { data: billing, error: billingError } = await admin.from("ad_billing_profiles")
        .select("*").eq("customer_id", userId).maybeSingle();
      if (billingError) throw billingError;
      if (!billing) {
        const { data, error } = await admin.from("ad_billing_profiles").insert({ customer_id: userId }).select("*").single();
        if (error) throw error;
        billing = data;
      }

      const { data: existing, error: existingError } = await admin.from("ad_payment_transactions")
        .select("stripe_checkout_session_id,status").eq("idempotency_key", body.idempotencyKey).eq("customer_id", userId).maybeSingle();
      if (existingError) throw existingError;
      if (existing?.stripe_checkout_session_id && existing.status !== "failed") {
        const session = await stripeFetch(`/checkout/sessions/${existing.stripe_checkout_session_id}`, stripeSecret, { method: "GET" });
        return json({ checkoutUrl: session.url, reused: true });
      }

      let stripeCustomerId = billing.stripe_customer_id as string | null;
      if (!stripeCustomerId) {
        const customer = await stripeFetch("/customers", stripeSecret, {
          idempotencyKey: `ad-customer-${userId}`,
          body: { email: profile.email, name: profile.full_name || undefined, "metadata[barber_launch_customer_id]": userId },
        });
        stripeCustomerId = customer.id;
        const { error } = await admin.from("ad_billing_profiles").update({ stripe_customer_id: stripeCustomerId }).eq("customer_id", userId);
        if (error) throw error;
      }

      try {
        await ensureManagedAdsWebhookEndpoint(stripeSecret);
      } catch (error) {
        if (error instanceof VaultUnavailableError) {
          console.error("managed-ad-billing: vault unavailable", error.message);
          return json({ error: "Managed ad billing is not configured: secure secret storage is unavailable." }, 503);
        }
        console.error("managed-ad-billing: webhook endpoint registration failed", error);
        return json({ error: "Managed ad billing is not configured: Stripe webhook registration failed." }, 503);
      }

      const amountCents = requestedAmountCents;

      const { data: transaction, error: transactionError } = await admin.from("ad_payment_transactions").insert({
        customer_id: userId,
        campaign_id: campaign.id,
        amount_cents: amountCents,
        currency: campaign.currency,
        idempotency_key: body.idempotencyKey,
        purpose: "initial_funding",
      }).select("id").single();
      if (transactionError) throw transactionError;

      const session = await stripeFetch("/checkout/sessions", stripeSecret, {
        idempotencyKey: `ad-checkout-${body.idempotencyKey}`,
        body: {
          mode: "payment",
          customer: stripeCustomerId,
          success_url: `${appUrl}/ads?funded=1`,
          cancel_url: `${appUrl}/ads?funding=cancelled`,
          "line_items[0][price_data][currency]": campaign.currency,
          "line_items[0][price_data][product_data][name]": `${campaign.name} — prepaid media balance`,
          "line_items[0][price_data][unit_amount]": amountCents,
          "line_items[0][price_data][product_data][metadata][campaign_id]": campaign.id,
          "line_items[0][quantity]": 1,
          "payment_intent_data[setup_future_usage]": "off_session",
          "metadata[transaction_id]": transaction.id,
          "metadata[campaign_id]": campaign.id,
          "metadata[customer_id]": userId,
        },
      });
      const { error: updateError } = await admin.from("ad_payment_transactions")
        .update({ stripe_checkout_session_id: session.id, status: "requires_action" })
        .eq("id", transaction.id);
      if (updateError) throw updateError;
      return json({ checkoutUrl: session.url, transactionId: transaction.id });
    }

    if (action === "setAutopay") {
      const enabled = body?.enabled === true;
      if (!enabled) {
        const { error } = await admin.from("ad_billing_profiles").upsert({ customer_id: userId, autopay_enabled: false }, { onConflict: "customer_id" });
        if (error) throw error;
        return json({ ok: true, enabled: false });
      }
      if (body?.consent !== true) return json({ error: "Explicit automatic-recharge consent is required." }, 400);
      const { data: billing, error: billingError } = await admin.from("ad_billing_profiles")
        .select("default_payment_method_id").eq("customer_id", userId).maybeSingle();
      if (billingError) throw billingError;
      if (!billing?.default_payment_method_id) return json({ error: "Fund a campaign with a card before enabling automatic recharge." }, 409);
      const { error } = await admin.from("ad_billing_profiles").update({
        autopay_enabled: true,
        autopay_consent_at: new Date().toISOString(),
      }).eq("customer_id", userId);
      if (error) throw error;
      return json({ ok: true, enabled: true });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("managed-ad-billing", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
