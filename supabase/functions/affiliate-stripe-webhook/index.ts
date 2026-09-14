// Signed Stripe webhook dedicated to affiliate commissions.
// Commission is only ever accrued from a verified, signed, paid event with an
// approved enrollment price. Never from a success URL or a client-supplied amount.
import { adminClient, COMMISSION_RATE, json, loadSettings, normalizeEmail, sha256 } from "../_shared/affiliate.ts";

const encoder = new TextEncoder();

async function verifySignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v];
    }),
  ) as Record<string, string>;
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  // Reject events older than 5 minutes (replay protection).
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

async function stripeGet(path: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return res.ok ? await res.json() : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("AFFILIATE_STRIPE_WEBHOOK_SECRET");
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret || !stripeSecret) {
    console.error("affiliate webhook not configured");
    return json({ error: "Webhook not configured." }, 503);
  }

  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";
  if (!(await verifySignature(payload, sigHeader, secret))) {
    return json({ error: "Invalid signature." }, 400);
  }

  const event = JSON.parse(payload);
  const db = adminClient();
  const settings = await loadSettings(db);

  // Idempotency: duplicate or reordered deliveries are recorded once.
  const { error: dupError } = await db.from("affiliate_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    livemode: Boolean(event.livemode),
    payload_digest: await sha256(payload),
  });
  if (dupError) {
    return json({ received: true, duplicate: true });
  }

  // Test-mode events never enter live balances.
  const livemode = Boolean(event.livemode);

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status !== "paid") break;
        await accrue(db, settings, stripeSecret, session, livemode, event.id);
        break;
      }
      case "charge.refunded":
      case "charge.refund.updated": {
        const charge = event.data.object;
        await adjustRefund(db, charge, event.id, livemode);
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object;
        await adjustDispute(db, dispute, event.id, livemode);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("affiliate webhook processing failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Processing failed." }, 500);
  }

  return json({ received: true });
});

async function accrue(
  db: ReturnType<typeof adminClient>,
  settings: Awaited<ReturnType<typeof loadSettings>>,
  stripeSecret: string,
  session: any,
  livemode: boolean,
  eventId: string,
) {
  const referralId = session.client_reference_id ?? session.metadata?.referral_id;
  const email = session.customer_details?.email ? normalizeEmail(session.customer_details.email) : null;

  let referral: any = null;
  if (referralId) {
    const { data } = await db.from("affiliate_referrals").select("*").eq("id", referralId).maybeSingle();
    referral = data;
  }
  if (!referral && email) {
    const { data } = await db
      .from("affiliate_referrals")
      .select("*")
      .eq("lead_email_normalized", email)
      .neq("status", "void")
      .maybeSingle();
    referral = data;
  }

  // Verify the purchased price is an approved enrollment price.
  const lineItems = await stripeGet(`/checkout/sessions/${session.id}/line_items?limit=10`, stripeSecret);
  const priceIds: string[] = (lineItems?.data ?? []).map((li: any) => li?.price?.id).filter(Boolean);
  const approved = priceIds.filter((p) => settings.enrollment_price_ids.includes(p));

  const currency = String(session.currency ?? "usd").toLowerCase();
  // Exclude shipping and tax; discounts are already reflected in the subtotal.
  const totalDetails = session.total_details ?? {};
  const eligible = Math.max(
    0,
    Number(session.amount_total ?? 0) -
      Number(totalDetails.amount_tax ?? 0) -
      Number(totalDetails.amount_shipping ?? 0),
  );

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  const { data: payment } = await db
    .from("affiliate_payments")
    .upsert(
      {
        referral_id: referral?.id ?? null,
        affiliate_id: referral?.affiliate_id ?? null,
        stripe_object_type: "checkout.session",
        stripe_object_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        customer_email_normalized: email,
        price_id: approved[0] ?? priceIds[0] ?? null,
        currency,
        gross_amount_cents: Number(session.amount_total ?? 0),
        eligible_amount_cents: eligible,
        livemode,
        paid_at: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        matched_by: referralId ? "client_reference_id" : referral ? "customer_email" : null,
      },
      { onConflict: "stripe_object_type,stripe_object_id" },
    )
    .select("id")
    .single();

  // No approved enrollment price, no affiliate, or non-USD: record the payment for
  // admin reconciliation but accrue nothing.
  if (!referral || approved.length === 0 || currency !== "usd" || eligible <= 0) return;

  const { data: affiliate } = await db
    .from("affiliates")
    .select("id, status, commission_rate")
    .eq("id", referral.affiliate_id)
    .maybeSingle();
  if (!affiliate || affiliate.status !== "active") return;

  // Attribution window, when the team has set one.
  if (settings.attribution_window_days) {
    const ageDays = (Date.now() - new Date(referral.first_seen_at).getTime()) / 86_400_000;
    if (ageDays > settings.attribution_window_days) return;
  }

  const rate = Number(affiliate.commission_rate ?? COMMISSION_RATE);
  await db.from("affiliate_commissions").insert({
    affiliate_id: affiliate.id,
    referral_id: referral.id,
    payment_id: payment?.id ?? null,
    entry_type: "earned",
    amount_cents: Math.round(eligible * rate),
    currency,
    basis_amount_cents: eligible,
    rate,
    status: "verified",
    livemode,
    source_event_id: eventId,
  });

  await db.from("affiliate_referrals").update({ status: "converted" }).eq("id", referral.id);
}

async function adjustRefund(db: ReturnType<typeof adminClient>, charge: any, eventId: string, livemode: boolean) {
  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!intentId) return;
  const { data: payment } = await db
    .from("affiliate_payments")
    .select("id, affiliate_id, referral_id, eligible_amount_cents, gross_amount_cents, refunded_amount_cents, currency")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();
  if (!payment?.affiliate_id) return;

  const refundedTotal = Number(charge.amount_refunded ?? 0);
  const newlyRefunded = refundedTotal - Number(payment.refunded_amount_cents ?? 0);
  if (newlyRefunded <= 0) return;

  const { data: earned } = await db
    .from("affiliate_commissions")
    .select("rate")
    .eq("payment_id", payment.id)
    .eq("entry_type", "earned")
    .maybeSingle();
  const rate = Number(earned?.rate ?? COMMISSION_RATE);

  // Refunds reduce the eligible base proportionally; a refund after payout stays
  // on the ledger as a negative adjustment.
  const share = Math.min(1, newlyRefunded / Math.max(1, Number(payment.gross_amount_cents ?? 0)));
  const reduction = Math.round(Number(payment.eligible_amount_cents ?? 0) * share * rate);

  await db.from("affiliate_payments").update({ refunded_amount_cents: refundedTotal }).eq("id", payment.id);
  if (reduction <= 0) return;

  await db.from("affiliate_commissions").insert({
    affiliate_id: payment.affiliate_id,
    referral_id: payment.referral_id,
    payment_id: payment.id,
    entry_type: "refund",
    amount_cents: -reduction,
    currency: payment.currency,
    rate,
    status: "verified",
    livemode,
    source_event_id: eventId,
    note: "Refund adjustment",
  });
}

async function adjustDispute(db: ReturnType<typeof adminClient>, dispute: any, eventId: string, livemode: boolean) {
  const intentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
  if (!intentId) return;
  const { data: payment } = await db
    .from("affiliate_payments")
    .select("id, affiliate_id, referral_id, currency")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();
  if (!payment?.affiliate_id) return;

  const { data: entries } = await db
    .from("affiliate_commissions")
    .select("amount_cents")
    .eq("payment_id", payment.id)
    .neq("entry_type", "payout");
  const net = (entries ?? []).reduce((sum, e) => sum + Number(e.amount_cents ?? 0), 0);
  if (net <= 0) return;

  await db.from("affiliate_payments").update({ disputed: true }).eq("id", payment.id);
  await db.from("affiliate_commissions").insert({
    affiliate_id: payment.affiliate_id,
    referral_id: payment.referral_id,
    payment_id: payment.id,
    entry_type: "dispute",
    amount_cents: -net,
    currency: payment.currency,
    status: "verified",
    livemode,
    source_event_id: eventId,
    note: "Chargeback adjustment",
  });
}
