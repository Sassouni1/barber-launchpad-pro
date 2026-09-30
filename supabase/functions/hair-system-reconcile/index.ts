// Admin-only reconciliation for paid hair-system orders whose post-payment
// deliveries never ran. Actions:
//   diagnostics — read-only: Stripe account, webhook endpoint coverage, GHL OAuth
//   dry_run     — read-only: per-order Stripe verification + replay plan
//   execute     — requires confirm:"EXECUTE"; replays only unsent/failed channels
// Nothing runs automatically on deploy.

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillPaidSession, hairSystemStripeKey, loadExpandedSession, stripeGet } from "../_shared/hairSystemFulfillment.ts";
import {
  HAIR_SYSTEM_SELLER_ACCOUNT,
  planReplay,
  verifyPaidSession,
  webhookCoverage,
  type NotificationRow,
} from "../_shared/hairSystemFulfillmentLogic.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function diagnostics(db: SupabaseClient, key: string) {
  const out: Record<string, unknown> = { expectedSeller: HAIR_SYSTEM_SELLER_ACCOUNT };
  try {
    const account = await stripeGet("/account", key);
    out.stripeAccount = account.id;
    out.stripeAccountMatches = account.id === HAIR_SYSTEM_SELLER_ACCOUNT;
    out.keyMode = key.startsWith("sk_live") || key.startsWith("rk_live") ? "live" : "test";
  } catch (e) {
    out.stripeAccountError = e instanceof Error ? e.message : "stripe_account_error";
  }
  const expectedUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/hair-system-stripe-webhook`;
  out.expectedWebhookUrl = expectedUrl;
  out.webhookSigningSecretPresent = Boolean(Deno.env.get("HAIR_SYSTEM_STRIPE_WEBHOOK_SECRET"));
  try {
    const list = await stripeGet("/webhook_endpoints?limit=100", key);
    out.webhook = webhookCoverage(list.data ?? [], expectedUrl);
  } catch (e) {
    out.webhook = { configured: false, reason: `cannot_list_endpoints:${e instanceof Error ? e.message : "error"}` };
  }
  try {
    const failed = await stripeGet("/events?type=checkout.session.completed&delivery_success=false&limit=20", key);
    out.recentUndeliveredCheckoutEvents = (failed.data ?? []).map((e: any) => ({
      id: e.id, created: new Date(e.created * 1000).toISOString(), orderIds: e.data?.object?.metadata?.order_ids ?? null,
    }));
  } catch (e) {
    out.recentUndeliveredCheckoutEvents = `unavailable:${e instanceof Error ? e.message : "error"}`;
  }
  const { count } = await db.from("hair_system_webhook_events").select("event_id", { count: "exact", head: true });
  out.webhookEventsReceived = count ?? 0;
  const { data: tok } = await db.from("ghl_oauth_tokens").select("location_id, expires_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  out.ghlOauth = tok ? { connected: true, locationId: tok.location_id, expiresAt: tok.expires_at } : { connected: false, reason: "ghl_marketplace_not_connected" };
  return out;
}

/** Find the paid Checkout Session for an order in the hair-system Stripe account. */
async function findSession(db: SupabaseClient, key: string, orderId: string, userId: string | null) {
  const { data: notes } = await db.from("order_notifications").select("event_id").eq("order_id", orderId);
  for (const n of notes ?? []) {
    const m = String(n.event_id ?? "").match(/cs_(live|test)_[A-Za-z0-9]+/);
    if (m) return m[0];
  }
  try {
    const q = encodeURIComponent(`metadata['order_ids']:'${orderId}'`);
    const pis = await stripeGet(`/payment_intents/search?query=${q}&limit=5`, key);
    for (const pi of pis.data ?? []) {
      const s = await stripeGet(`/checkout/sessions?payment_intent=${encodeURIComponent(pi.id)}&limit=1`, key);
      if (s.data?.[0]?.id) return s.data[0].id as string;
    }
  } catch (_) { /* fall through */ }
  if (userId) {
    const { data: bp } = await db.from("member_billing_profiles").select("stripe_customer_id").eq("customer_id", userId).maybeSingle();
    if (bp?.stripe_customer_id) {
      const s = await stripeGet(`/checkout/sessions?customer=${encodeURIComponent(bp.stripe_customer_id)}&limit=100`, key);
      const hit = (s.data ?? []).find((x: any) => String(x.metadata?.order_ids ?? "").split(",").includes(orderId));
      if (hit) return hit.id as string;
    }
  }
  return null;
}

async function notificationRows(db: SupabaseClient, orderIds: string[]) {
  const { data } = await db
    .from("order_notifications")
    .select("order_id, channel, status, reason, provider_message_id, attempts, updated_at")
    .in("order_id", orderIds);
  return (data ?? []) as Array<NotificationRow & { reason: string | null; provider_message_id: string | null; attempts: number }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!u?.user) return json({ error: "Please sign in." }, 401);
    const { data: admin } = await db.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (admin !== true) return json({ error: "Admins only." }, 403);

    const key = hairSystemStripeKey();
    if (!key) return json({ error: "Hair system Stripe key is not configured." }, 503);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "diagnostics");
    const diag = await diagnostics(db, key);
    if (action === "diagnostics") return json({ diagnostics: diag });

    if (action === "attempts") {
      const { data } = await db.from("hair_system_webhook_attempts").select("*").order("received_at", { ascending: false }).limit(50);
      const { data: hold } = await db.from("app_settings").select("value").eq("key", "hair_system_fulfillment_hold").maybeSingle();
      return json({ hold: hold?.value === true, attempts: data ?? [] });
    }

    const stripePost = async (path: string, params: Record<string, string | string[]>) => {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach((x) => form.append(k, x));
      const r = await fetch(`https://api.stripe.com/v1${path}`, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form,
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b?.error?.message ?? `stripe_http_${r.status}`);
      return b;
    };
    const getRef = async () => (await db.from("app_settings").select("value").eq("key", "hair_system_webhook_secret_ref").maybeSingle()).data?.value as any ?? null;
    const setRef = (value: unknown) => db.from("app_settings").upsert({ key: "hair_system_webhook_secret_ref", value }, { onConflict: "key" });
    const audit = (step: string) => console.log("hair-system webhook repair", step, "by", u.user.id);

    if (action === "repair_webhook") {
      // Creates a replacement endpoint (old one untouched). Its whsec is stored
      // encrypted and never logged or returned.
      if (body.confirm !== "REPAIR") return json({ error: "Type REPAIR to confirm." }, 400);
      const existing = await getRef();
      if (existing?.status === "pending_verification" || existing?.status === "active") {
        return json({ error: "A replacement endpoint already exists.", endpoint: existing.new_endpoint_id, status: existing.status }, 409);
      }
      const oldId = (diag.webhook as any)?.endpointIds?.[0];
      if (!oldId) return json({ error: "No current endpoint found." }, 409);
      const encKey = Deno.env.get("GHL_ENCRYPTION_KEY");
      if (!encKey) return json({ error: "Encryption key not configured." }, 503);
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/hair-system-stripe-webhook?ep=v2`;
      const created = await stripePost("/webhook_endpoints", {
        url,
        "enabled_events[]": ["checkout.session.completed", "checkout.session.async_payment_succeeded"],
        description: "Barber Launch hair-system checkout (API repair)",
        "metadata[purpose]": "hair_system_checkout",
        "metadata[replaces]": oldId,
      });
      const whsec = String(created.secret ?? "");
      if (!whsec.startsWith("whsec_")) {
        await stripePost(`/webhook_endpoints/${created.id}`, { disabled: "true" });
        return json({ error: "Stripe did not return a signing secret; new endpoint disabled." }, 502);
      }
      const { data: secretId, error: encErr } = await db.rpc("store_encrypted_token", { token_value: whsec, encryption_key: encKey });
      if (encErr || !secretId) {
        await stripePost(`/webhook_endpoints/${created.id}`, { disabled: "true" });
        return json({ error: "Could not store signing secret; new endpoint disabled." }, 500);
      }
      await setRef({ status: "pending_verification", secret_id: secretId, new_endpoint_id: created.id, old_endpoint_id: oldId, created_at: new Date().toISOString() });
      audit(`created ${created.id}`);
      return json({ status: "pending_verification", new_endpoint_id: created.id, old_endpoint_id: oldId, url, enabled_events: created.enabled_events });
    }

    if (action === "finalize_webhook") {
      const ref = await getRef();
      if (ref?.status !== "pending_verification") return json({ error: "Nothing pending.", ref: ref ? { status: ref.status } : null }, 409);
      const { data: good } = await db.from("hair_system_webhook_attempts").select("id, event_id, received_at, outcome")
        .eq("signature_valid", true).like("outcome", "%@v2").gte("received_at", ref.created_at).limit(1);
      if (!good?.length) return json({ error: "No verified signed delivery on the new endpoint yet." }, 409);
      const old = await stripePost(`/webhook_endpoints/${ref.old_endpoint_id}`, { disabled: "true" });
      await setRef({ ...ref, status: "active", finalized_at: new Date().toISOString(), proof_attempt_id: good[0].id });
      audit(`disabled old ${ref.old_endpoint_id}`);
      return json({ status: "active", proof: good[0], old_endpoint: { id: old.id, status: old.status } });
    }

    if (action === "rollback_webhook") {
      if (body.confirm !== "ROLLBACK") return json({ error: "Type ROLLBACK to confirm." }, 400);
      const ref = await getRef();
      if (!ref?.new_endpoint_id) return json({ error: "No repair to roll back." }, 409);
      await stripePost(`/webhook_endpoints/${ref.old_endpoint_id}`, { disabled: "false" });
      await stripePost(`/webhook_endpoints/${ref.new_endpoint_id}`, { disabled: "true" });
      await setRef({ ...ref, status: "rolled_back", rolled_back_at: new Date().toISOString() });
      audit("rolled back");
      return json({ status: "rolled_back" });
    }

    if (action === "probe_retry") {
      // Asks Stripe to redeliver one existing event to the configured endpoint.
      // Safe only while the fulfillment hold is on (webhook answers 503 before any claim/send).
      const { data: hold } = await db.from("app_settings").select("value").eq("key", "hair_system_fulfillment_hold").maybeSingle();
      if (hold?.value !== true) return json({ error: "Turn the fulfillment hold on before probing." }, 409);
      const eventId = String(body.event_id ?? "");
      const endpointId = String(body.endpoint_id ?? ((diag.webhook as any)?.endpointIds?.[0] ?? ""));
      if (!/^evt_[A-Za-z0-9]+$/.test(eventId) || !/^we_[A-Za-z0-9]+$/.test(endpointId)) return json({ error: "Bad event or endpoint id." }, 400);
      const res = await fetch(`https://api.stripe.com/v1/events/${eventId}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ webhook_endpoint: endpointId }),
      });
      const text = await res.text();
      let parsed: any = null; try { parsed = JSON.parse(text); } catch { /* keep text */ }
      return json({ stripeStatus: res.status, stripeResponse: parsed ?? text.slice(0, 500) });
    }

    // Manual replay is always one explicit order; there is no default list.
    const rawIds = Array.isArray(body.order_ids) ? body.order_ids.map(String) : body.order_id ? [String(body.order_id)] : [];
    if (rawIds.length !== 1 || !UUID.test(rawIds[0])) return json({ error: "Provide exactly one order ID." }, 400);
    const orderIds = [rawIds[0].toLowerCase()];

    if (action !== "dry_run" && action !== "execute" && action !== "verify") return json({ error: "Unknown action." }, 400);

    if (action === "execute") {
      if (body.confirm !== "EXECUTE") return json({ error: 'Type EXECUTE to confirm.' }, 400);
      if (diag.stripeAccountMatches !== true) return json({ error: "Stripe account does not match the hair-system seller.", diagnostics: diag }, 409);
      if (!(diag.ghlOauth as any)?.connected) return json({ error: "GoHighLevel is not connected — nothing can be delivered yet.", diagnostics: diag }, 409);
    }

    const { data: orderRows } = await db.from("orders").select("id, user_id, status, customer_email").in("id", orderIds);
    const verified: Array<Record<string, unknown>> = [];
    const sessions = new Map<string, Record<string, any>>();

    for (const orderId of orderIds) {
      const order = (orderRows ?? []).find((o: any) => o.id === orderId);
      if (!order) { verified.push({ orderId, ok: false, reason: "order_not_found" }); continue; }
      try {
        const sessionId = await findSession(db, key, orderId, order.user_id);
        if (!sessionId) { verified.push({ orderId, ok: false, reason: "no_stripe_session_found" }); continue; }
        const session = sessions.get(sessionId) ?? (await loadExpandedSession(sessionId, key));
        const check = verifyPaidSession(session, { requireOrderId: orderId, expectedUserId: order.user_id ?? undefined });
        if (!check.ok) { verified.push({ orderId, sessionId, ok: false, reason: check.reason }); continue; }
        sessions.set(sessionId, session);
        verified.push({
          orderId, sessionId, ok: true, orderStatus: order.status, email: order.customer_email,
          amountPaid: session.amount_total, currency: session.currency, livemode: session.livemode,
          sessionOrderIds: check.orderIds,
        });
      } catch (e) {
        verified.push({ orderId, ok: false, reason: e instanceof Error ? e.message.slice(0, 200) : "verify_error" });
      }
    }

    if (action === "verify") return json({ mode: "verify", verified });

    const sessionOrderIds = [...new Set([...sessions.values()].flatMap((s) => String(s.metadata?.order_ids ?? "").split(",").filter(Boolean)))];
    const before = await notificationRows(db, sessionOrderIds.length ? sessionOrderIds : orderIds);
    const plan = [...sessions.values()].flatMap((s) => planReplay(String(s.metadata.order_ids).split(",").filter(Boolean), before));

    if (action === "dry_run") return json({ mode: "dry_run", diagnostics: diag, verified, plan, notifications: before });

    if (sessions.size !== 1) return json({ error: "Order is not verified as paid; nothing executed.", verified }, 409);
    const onlyIds = String([...sessions.values()][0].metadata?.order_ids ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (onlyIds.length !== 1 || onlyIds[0] !== orderIds[0]) {
      return json({ error: "This checkout covers other orders too; single-order execute refused.", sessionOrderIds: onlyIds }, 409);
    }

    const runs: Array<Record<string, unknown>> = [];
    for (const [sessionId, session] of sessions) {
      try {
        const r = await fulfillPaidSession(db, session, {
          eventId: `reconcile:${u.user.id}:${sessionId}`,
          stripeSecret: key,
          syncSavedCard: false,
          mode: "manual",
        });
        runs.push({ sessionId, orderIds: r.orderIds, outcomes: r.outcomes });
      } catch (e) {
        runs.push({ sessionId, error: e instanceof Error ? e.message.slice(0, 200) : "execute_error" });
      }
    }
    const after = await notificationRows(db, sessionOrderIds);
    console.log("hair-system reconcile executed by", u.user.id, JSON.stringify(runs));
    return json({ mode: "execute", diagnostics: diag, verified, runs, notifications: after });
  } catch (e) {
    console.error("hair-system-reconcile error", e instanceof Error ? e.message : e);
    return json({ error: "Reconciliation failed." }, 500);
  }
});
