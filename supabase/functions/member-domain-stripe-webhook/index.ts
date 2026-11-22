// A signed, paid Stripe event is the only path that may buy a member domain
// with Barber Launch's Cloudflare payment method.
import { serviceClient } from "../_shared/websiteAuth.ts";
import { BARBER_LAUNCH_STRIPE_ACCOUNT, processPaidDomainSession } from "../_shared/memberDomainBilling.ts";
import { stripeApi, webhookDepsFor } from "../_shared/memberDomainBillingRuntime.ts";

const encoder = new TextEncoder();
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
    const stripe = stripeApi(stripeKey);
    const account = await stripe.get("account");
    if (account?.id !== BARBER_LAUNCH_STRIPE_ACCOUNT) return reply({ error: "Wrong Stripe account" }, 503);
    const sessionId = event?.data?.object?.id;
    if (!/^cs_live_[A-Za-z0-9]+$/.test(sessionId || "")) return reply({ error: "Invalid session" }, 400);
    await processPaidDomainSession(webhookDepsFor(serviceClient(), stripe), sessionId);
    return reply({ ok: true });
  } catch (error) {
    console.error("member-domain webhook failed", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Domain registration needs review" }, 503);
  }
});
