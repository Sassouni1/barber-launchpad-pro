// Dedicated signed Stripe webhook for hair system order checkouts.
//
// Stripe is the sole source of truth. This is the ONLY trigger for the
// supplier production email, branded buyer receipt, and buyer confirmation SMS.
// GoHighLevel is the delivery transport only; it
// never contributes message content (no workflows, merge fields or custom
// fields).
//
// Required secrets:
//   HAIR_SYSTEM_STRIPE_WEBHOOK_SECRET  signing secret of this Stripe endpoint
//   Stripe key: hairSystemStripeKey() — identical resolution to hair-system-checkout
//   Marketplace OAuth connection (ghl_oauth_tokens) for email and SMS delivery
// Optional:
//   HAIR_SYSTEM_SUPPLIER_EMAIL         overrides the default supplier recipient
//   HAIR_SYSTEM_SUPPLIER_FROM          overrides the preferred sender address

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillPaidSession, hairSystemStripeKey, loadExpandedSession } from "../_shared/hairSystemFulfillment.ts";

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Standard Stripe `t=`/`v1=` signature check with 5 minute replay window. */
async function verifySignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v];
    }),
  ) as Record<string, string>;
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function stripeGet(path: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `stripe_http_${res.status}`);
  return body;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const signingSecret = Deno.env.get("HAIR_SYSTEM_STRIPE_WEBHOOK_SECRET");
  if (!signingSecret) {
    console.error("hair-system webhook signing secret missing");
    return json({ error: "Webhook not configured." }, 503);
  }
  const stripeSecret = hairSystemStripeKey();
  if (!stripeSecret) return json({ error: "Stripe not configured." }, 503);

  const payload = await req.text();
  const ok = await verifySignature(payload, req.headers.get("stripe-signature") ?? "", signingSecret);
  if (!ok) return json({ error: "Invalid signature." }, 400);

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "Invalid payload." }, 400);
  }

  const handled = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!handled.includes(event.type)) return json({ received: true, ignored: event.type });

  const session = event.data?.object ?? {};
  const orderIds = String(session.metadata?.order_ids ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
  // Not one of our hair system checkouts (affiliate/enrollment sessions carry other metadata).
  if (!orderIds.length) return json({ received: true, ignored: "no_order_ids" });
  if (session.payment_status !== "paid") return json({ received: true, ignored: "not_paid" });

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Durable, atomic claim — a duplicate delivery never re-sends anything.
  const { data: claim, error: claimError } = await db.rpc("hair_system_claim_webhook_event", {
    _event_id: event.id,
    _event_type: event.type,
    _livemode: Boolean(event.livemode),
    _digest: await sha256(payload),
  });
  if (claimError) {
    console.error("hair-system webhook claim failed", claimError.message);
    return json({ error: "Could not claim event." }, 500);
  }
  if (claim === "duplicate") return json({ received: true, duplicate: true });
  if (claim === "in_progress") return json({ received: false, retry: true }, 409);

  try {
    // Re-fetch from Stripe with the SAME key as checkout; the shared pipeline
    // re-verifies paid status and runs CRM sync + supplier/receipt/SMS once.
    const fullSession = await loadExpandedSession(String(session.id), stripeSecret);
    const result = await fulfillPaidSession(db, fullSession, {
      eventId: String(event.id),
      stripeSecret,
      syncSavedCard: true,
    });
    console.log("hair-system fulfillment", JSON.stringify(result.outcomes));
    if (result.anyFailed) throw new Error("one_or_more_notifications_failed");

    await db
      .from("hair_system_webhook_events")
      .update({ status: "done", processed_at: new Date().toISOString() })
      .eq("event_id", event.id);

    return json({ received: true, orders: result.orderIds.length, outcomes: result.outcomes });
  } catch (e) {
    console.error("hair-system webhook error", e instanceof Error ? e.message : e);
    // Release the claim so Stripe's retry can reprocess; per-channel logs keep
    // already-sent messages from going out twice.
    await db
      .from("hair_system_webhook_events")
      .update({ status: "failed", created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() })
      .eq("event_id", event.id);
    return json({ error: "Processing failed." }, 500);
  }
});
