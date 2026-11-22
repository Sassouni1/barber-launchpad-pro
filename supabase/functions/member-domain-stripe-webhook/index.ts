// A signed, paid Stripe event is the only path that may buy a member domain
// with Barber Launch's Cloudflare payment method.
import { serviceClient } from "../_shared/websiteAuth.ts";

const encoder = new TextEncoder();
const SOURCE = "barber_launch_member_domain";
const STRIPE_ACCOUNT = "acct_1LMNKMI6LFtj88Bq";
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function validSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map(part => part.trim().split("=")));
  const timestamp = Number(parts.t);
  const signatures = header.split(",").map(part => part.trim()).filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !signatures.length) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some(signature => {
    if (signature.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  });
}

async function stripe(path: string, key: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2026-03-25.dahlia" } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Stripe read failed: ${data?.error?.code ?? response.status}`);
  return data;
}

async function cloudflare(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && data?.success !== false, status: response.status, data };
}

async function processPaidSession(sessionId: string, stripeKey: string) {
  const db = serviceClient();
  const session = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`, stripeKey);
  const orderId = session?.metadata?.order_id;
  if (session?.metadata?.source !== SOURCE || !/^[0-9a-f-]{36}$/i.test(orderId || "")) return;
  const { data: order, error: loadError } = await db.from("member_domain_orders").select("*").eq("id", orderId).maybeSingle();
  if (loadError || !order) throw new Error("Domain order not found");
  if (order.status === "registered" || order.status === "registration_pending" || order.status === "registering") return;
  if (order.status !== "checkout_open" && order.status !== "checkout_pending") return;
  if (order.stripe_session_id && order.stripe_session_id !== session.id) throw new Error("Domain checkout session mismatch");
  if (session.livemode !== true || session.mode !== "payment" || session.payment_status !== "paid" ||
      session.currency !== "usd" || session.amount_total !== order.member_charge_cents ||
      session.metadata.user_id !== order.user_id || session.metadata.domain !== order.domain)
    throw new Error("Domain payment evidence did not match the reserved order");

  // A conditional update lets only one webhook invocation initiate a billable
  // Cloudflare registration. Ambiguous outcomes stay claimed for reconciliation.
  const { data: claimed, error: claimError } = await db.from("member_domain_orders").update({
    status: "registering", stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent,
    updated_at: new Date().toISOString(),
  }).eq("id", order.id).in("status", ["checkout_open", "checkout_pending"]).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const token = Deno.env.get("CLOUDFLARE_REGISTRAR_API_TOKEN") ?? "";
  if (!accountId || !token) {
    await db.from("member_domain_orders").update({ status: "action_required", last_error: "Registrar credentials unavailable" }).eq("id", order.id);
    return;
  }
  const prefix = `/accounts/${accountId}/registrar`;
  const check = await cloudflare(`${prefix}/domain-check`, token, {
    method: "POST", body: JSON.stringify({ domains: [order.domain] }),
  });
  const candidate = check.data?.result?.domains?.[0];
  const currentCost = Math.round(Number(candidate?.pricing?.registration_cost) * 100);
  if (!check.ok || candidate?.registrable !== true || candidate?.tier === "premium" ||
      candidate?.pricing?.currency !== "USD" || currentCost > order.cloudflare_cost_cents) {
    await db.from("member_domain_orders").update({ status: "action_required", last_error: "Domain availability or price changed after payment; review and refund if needed" }).eq("id", order.id);
    return;
  }
  const registration = await cloudflare(`${prefix}/registrations`, token, {
    method: "POST", body: JSON.stringify({ domain_name: order.domain, auto_renew: false }),
  });
  if (!registration.ok) {
    await db.from("member_domain_orders").update({ status: "action_required", last_error: `Registration needs review (${registration.status})` }).eq("id", order.id);
    return;
  }
  const state = String(registration.data?.result?.state ?? "in_progress");
  const status = state === "succeeded" ? "registered" :
    state === "in_progress" ? "registration_pending" : "action_required";
  const { error: updateError } = await db.from("member_domain_orders").update({
    status, cloudflare_registration_state: state, last_error: status === "action_required" ? "Registration needs review" : null,
    updated_at: new Date().toISOString(),
  }).eq("id", order.id);
  if (updateError) throw updateError;
  const { data: assigned, error: siteError } = await db.from("member_websites").update({
    custom_domain: order.domain, cloudflare_registration_status: state,
    cloudflare_attachment_status: "pending", cloudflare_last_error: null,
  }).eq("user_id", order.user_id).is("custom_domain", null).select("id").maybeSingle();
  if (siteError || !assigned) {
    await db.from("member_domain_orders").update({ status: "action_required", last_error: "Domain purchased but could not be assigned to the website" }).eq("id", order.id);
    throw siteError || new Error("Domain assignment did not update a website");
  }
}

Deno.serve(async request => {
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("MEMBER_DOMAIN_STRIPE_WEBHOOK_SECRET") ?? "";
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!secret || !stripeKey) return reply({ error: "Webhook not configured" }, 503);
  const body = await request.text();
  if (!await validSignature(body, request.headers.get("stripe-signature") ?? "", secret))
    return reply({ error: "Invalid signature" }, 400);
  let event: Record<string, any>;
  try { event = JSON.parse(body); } catch { return reply({ error: "Invalid event" }, 400); }
  if (event.livemode !== true) return reply({ error: "Live payments only" }, 400);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return reply({ ok: true });
  try {
    const account = await stripe("account", stripeKey);
    if (account.id !== STRIPE_ACCOUNT) return reply({ error: "Wrong Stripe account" }, 503);
    const sessionId = event?.data?.object?.id;
    if (!/^cs_live_[A-Za-z0-9]+$/.test(sessionId || "")) return reply({ error: "Invalid session" }, 400);
    await processPaidSession(sessionId, stripeKey);
    return reply({ ok: true });
  } catch (error) {
    console.error("member-domain webhook failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Domain registration needs review" }, 503);
  }
});
