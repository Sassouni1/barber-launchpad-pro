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
//   STRIPE_SECRET_KEY                  existing Invasion Digital Media live key
//   Existing GHL connection (ghl_oauth_tokens + GHL_ENCRYPTION_KEY +
//   GHL_CLIENT_ID / GHL_CLIENT_SECRET) for email and SMS delivery
// Optional:
//   HAIR_SYSTEM_SUPPLIER_EMAIL         overrides the default supplier recipient
//   HAIR_SYSTEM_SUPPLIER_FROM          overrides the preferred sender address

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buyerFromSession,
  dispatchPaidOrderNotifications,
  type OrderRow,
} from "../_shared/hairSystemNotifications.ts";

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
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
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
    // 1) Mark the orders paid (idempotent: only lifts them out of pending_payment).
    const { error: statusError } = await db
      .from("orders")
      .update({ status: "pending" })
      .in("id", orderIds)
      .eq("status", "pending_payment");
    if (statusError) throw statusError;

    // 2) Preserve saved-card behaviour even if the buyer never returns to the app.
    if (
      session.metadata?.save_card === "true" &&
      typeof session.customer === "string" &&
      typeof session.payment_intent === "string" &&
      session.metadata?.user_id
    ) {
      try {
        const intent = await stripeGet(`/payment_intents/${encodeURIComponent(session.payment_intent)}`, stripeSecret);
        if (typeof intent.payment_method === "string") {
          await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(session.customer)}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${stripeSecret}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ "invoice_settings[default_payment_method]": intent.payment_method }),
          });
          await db.from("member_billing_profiles").upsert(
            {
              customer_id: session.metadata.user_id,
              stripe_customer_id: session.customer,
              default_payment_method_id: intent.payment_method,
            },
            { onConflict: "customer_id" },
          );
        }
      } catch (e) {
        console.error("saved-card sync failed", e instanceof Error ? e.message : e);
      }
    }

    // 3) Load the order specs captured at checkout. No amounts are read or
    //    forwarded — the supplier sheet must never contain prices.
    const { data: orders, error: ordersError } = await db
      .from("orders")
      .select("id, customer_email, customer_name, order_details")
      .in("id", orderIds);
    if (ordersError) throw ordersError;

    const ordered = orderIds
      .map((id) => (orders ?? []).find((o: any) => o.id === id))
      .filter(Boolean) as OrderRow[];

    // Authoritative buyer identity/address straight off the paid session.
    const fullSession = await stripeGet(
      `/checkout/sessions/${encodeURIComponent(String(session.id))}?expand[]=line_items.data.price.product&expand[]=payment_intent.payment_method`,
      stripeSecret,
    ).catch(() => session);

    const lineItems = Array.isArray(fullSession?.line_items?.data)
      ? fullSession.line_items.data.map((item: any) => ({
          name: String(item.description ?? item.price?.product?.name ?? "Hair system order"),
          quantity: Number(item.quantity ?? 1),
          amount: Number(item.amount_total ?? 0),
        }))
      : [];
    const paymentMethod = fullSession?.payment_intent?.payment_method;
    const card = paymentMethod && typeof paymentMethod === "object" ? paymentMethod.card : null;

    const outcomes = await dispatchPaidOrderNotifications(db, {
      orders: ordered,
      buyer: buyerFromSession(fullSession),
      eventId: String(event.id),
      receipt: {
        orderReference: String(fullSession.id ?? session.id ?? ordered[0]?.id ?? ""),
        purchasedAt: new Date(Number(fullSession.created ?? session.created ?? Date.now() / 1000) * 1000),
        currency: String(fullSession.currency ?? "usd"),
        amountPaid: Number(fullSession.amount_total ?? 0),
        lineItems,
        cardBrand: String(card?.brand ?? ""),
        cardLast4: String(card?.last4 ?? ""),
      },
    });
    console.log("hair-system notifications", JSON.stringify(outcomes));

    if (outcomes.some((outcome) => outcome.result === "failed" || outcome.result === "claim_failed")) {
      throw new Error("one_or_more_notifications_failed");
    }

    await db
      .from("hair_system_webhook_events")
      .update({ status: "done", processed_at: new Date().toISOString() })
      .eq("event_id", event.id);

    return json({ received: true, orders: ordered.length, outcomes });
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
