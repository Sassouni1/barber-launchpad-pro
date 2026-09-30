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

const DEFAULT_ORDER_IDS = [
  "4809a521-9d4b-43c8-8be5-e6814b2cd113",
  "c3aef2be-7b37-4575-b4f1-538c869f500d",
  "f2ca7052-7dfd-4db2-bd22-c2347ba4b2a7",
  "ab36e2e1-33f9-4236-b157-c2e1021b04f2",
  "fa6a29dc-62e3-49ad-9927-e1093ad59fd0",
];
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

    const orderIds = (Array.isArray(body.order_ids) && body.order_ids.length ? body.order_ids : DEFAULT_ORDER_IDS)
      .map(String).filter((id) => UUID.test(id)).slice(0, 20);
    if (!orderIds.length) return json({ error: "No valid order IDs." }, 400);

    if (action !== "dry_run" && action !== "execute") return json({ error: "Unknown action." }, 400);
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

    const sessionOrderIds = [...new Set([...sessions.values()].flatMap((s) => String(s.metadata?.order_ids ?? "").split(",").filter(Boolean)))];
    const before = await notificationRows(db, sessionOrderIds.length ? sessionOrderIds : orderIds);
    const plan = [...sessions.values()].flatMap((s) => planReplay(String(s.metadata.order_ids).split(",").filter(Boolean), before));

    if (action === "dry_run") return json({ mode: "dry_run", diagnostics: diag, verified, plan, notifications: before });

    const runs: Array<Record<string, unknown>> = [];
    for (const [sessionId, session] of sessions) {
      try {
        const r = await fulfillPaidSession(db, session, {
          eventId: `reconcile:${u.user.id}:${sessionId}`,
          stripeSecret: key,
          syncSavedCard: false,
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
