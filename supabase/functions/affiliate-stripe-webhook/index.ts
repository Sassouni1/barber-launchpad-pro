// Signed Stripe webhook dedicated to affiliate commissions.
//
// Commission is only ever accrued from a verified, signed, paid event carrying an
// approved enrollment price. Never from a success URL or a client-supplied amount.
//
// Delivery handling: every event is CLAIMED first, then marked completed or failed.
// A delivery that fails is retried by Stripe and picked up again — it is never
// silently swallowed as a "duplicate". Only an event already recorded as completed
// is a duplicate.
//
// Ledger writes go through database functions so each event's changes commit
// atomically, and so concurrent refunds cannot over- or under-reduce a commission.
import { adminClient, COMMISSION_RATE, json, loadSettings, normalizeEmail, sha256 } from "../_shared/affiliate.ts";
import { computeEligibleAmount, withinAttributionWindow } from "../_shared/affiliateWebhookLogic.ts";
import { readAffiliateWebhookSecret } from "../_shared/affiliateVault.ts";

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

/** Throws on failure: a Stripe read we cannot complete must fail the event so it is retried. */
async function stripeGet(path: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`Stripe GET ${path} failed with ${res.status}`);
  return await res.json();
}

async function allLineItems(sessionId: string, secret: string) {
  const items: Array<Record<string, unknown>> = [];
  let startingAfter: string | null = null;
  // Paginate: a cart is not assumed to fit in one page.
  for (let page = 0; page < 20; page++) {
    const query = `limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`;
    const res = await stripeGet(`/checkout/sessions/${sessionId}/line_items?${query}`, secret);
    const data = (res?.data ?? []) as Array<Record<string, unknown>>;
    items.push(...data);
    if (!res?.has_more || data.length === 0) break;
    startingAfter = String((data[data.length - 1] as { id?: string }).id ?? "");
    if (!startingAfter) break;
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // The signing secret lives in secure server-side storage; an env override is
  // still honoured so an existing deployment keeps working.
  const secret = Deno.env.get("AFFILIATE_STRIPE_WEBHOOK_SECRET") ??
    (await readAffiliateWebhookSecret().catch((e) => {
      console.error("affiliate webhook secret read failed", e instanceof Error ? e.message : "unknown");
      return null;
    }));
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
  const livemode = Boolean(event.livemode);

  // Durable claim. Database errors are propagated so Stripe retries.
  const { data: claim, error: claimError } = await db.rpc("affiliate_claim_webhook_event", {
    _event_id: event.id,
    _event_type: event.type,
    _livemode: livemode,
    _digest: await sha256(payload),
  });
  if (claimError) {
    console.error("affiliate webhook claim failed", claimError.message);
    return json({ error: "Could not claim event." }, 500);
  }
  if (claim === "duplicate") return json({ received: true, duplicate: true });
  if (claim === "in_progress") return json({ received: false, retry: true }, 409);

  try {
    const settings = await loadSettings(db);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status === "paid") {
          await accrue(db, settings, stripeSecret, session, livemode, event.id);
        }
        break;
      }

      case "charge.refunded": {
        await handleRefundFromCharge(db, stripeSecret, event.data.object, event.id, livemode);
        break;
      }
      case "refund.created":
      case "refund.updated":
      case "charge.refund.updated": {
        // The object here is a REFUND, not a charge. Only a succeeded refund counts,
        // and the authoritative refunded total comes from the charge itself.
        const refund = event.data.object;
        if (refund?.status !== "succeeded") break;
        const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
        if (!chargeId) break;
        const charge = await stripeGet(`/charges/${chargeId}`, stripeSecret);
        await handleRefundFromCharge(db, stripeSecret, charge, event.id, livemode);
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.funds_withdrawn": {
        const intentId = await intentFromDispute(event.data.object, stripeSecret);
        const { error } = await db.rpc("affiliate_apply_dispute", {
          _payment_intent_id: intentId,
          _event_id: event.id,
          _livemode: livemode,
        });
        if (error) throw new Error(error.message);
        break;
      }
      case "charge.dispute.closed":
      case "charge.dispute.funds_reinstated": {
        const dispute = event.data.object;
        const intentId = await intentFromDispute(dispute, stripeSecret);
        const won = event.type === "charge.dispute.funds_reinstated" ||
          ["won", "warning_closed"].includes(String(dispute?.status ?? ""));
        const { error } = await db.rpc("affiliate_resolve_dispute", {
          _payment_intent_id: intentId,
          _event_id: event.id,
          _livemode: livemode,
          _won: won,
        });
        if (error) throw new Error(error.message);
        break;
      }

      // Payout-side reconciliation.
      case "transfer.created":
      case "transfer.updated":
      case "transfer.reversed":
      case "payout.paid":
      case "payout.failed": {
        await recordPayoutEvent(db, event, livemode);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("affiliate webhook processing failed", message);
    await db.rpc("affiliate_complete_webhook_event", {
      _event_id: event.id,
      _status: "failed",
      _error: message.slice(0, 500),
    });
    // 500 so Stripe redelivers; the claim allows the retry through.
    return json({ error: "Processing failed." }, 500);
  }

  const { error: completeError } = await db.rpc("affiliate_complete_webhook_event", {
    _event_id: event.id,
    _status: "completed",
    _error: null,
  });
  if (completeError) {
    console.error("affiliate webhook completion failed", completeError.message);
    return json({ error: "Could not finalise event." }, 500);
  }

  return json({ received: true });
});

async function intentFromDispute(dispute: any, stripeSecret: string): Promise<string | null> {
  if (typeof dispute?.payment_intent === "string") return dispute.payment_intent;
  if (dispute?.payment_intent?.id) return String(dispute.payment_intent.id);
  const chargeId = typeof dispute?.charge === "string" ? dispute.charge : dispute?.charge?.id;
  if (!chargeId) return null;
  const charge = await stripeGet(`/charges/${chargeId}`, stripeSecret);
  return typeof charge?.payment_intent === "string" ? charge.payment_intent : charge?.payment_intent?.id ?? null;
}

async function handleRefundFromCharge(
  db: ReturnType<typeof adminClient>,
  stripeSecret: string,
  charge: any,
  eventId: string,
  livemode: boolean,
) {
  const intentId = typeof charge?.payment_intent === "string"
    ? charge.payment_intent
    : charge?.payment_intent?.id ?? null;
  if (!intentId) return;

  // Always read the authoritative refunded total from the charge object Stripe holds now.
  const fresh = charge?.id ? await stripeGet(`/charges/${charge.id}`, stripeSecret) : charge;
  const refundedTotal = Number(fresh?.amount_refunded ?? charge?.amount_refunded ?? 0);
  if (!Number.isFinite(refundedTotal) || refundedTotal <= 0) return;

  const { error } = await db.rpc("affiliate_apply_refund", {
    _payment_intent_id: intentId,
    _refunded_total_cents: Math.round(refundedTotal),
    _event_id: eventId,
    _livemode: livemode,
  });
  if (error) throw new Error(error.message);
}

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
    const { data, error } = await db.from("affiliate_referrals").select("*").eq("id", referralId).maybeSingle();
    if (error) throw new Error(error.message);
    referral = data;
  }
  if (!referral && email) {
    const { data, error } = await db
      .from("affiliate_referrals")
      .select("*")
      .eq("lead_email_normalized", email)
      .neq("status", "void")
      .maybeSingle();
    if (error) throw new Error(error.message);
    referral = data;
  }

  // Commission basis: approved enrollment line items only, after discounts,
  // excluding tax and shipping. Paginated.
  const lineItems = await allLineItems(session.id, stripeSecret);
  const breakdown = computeEligibleAmount(lineItems as never, settings.enrollment_price_ids ?? []);

  const currency = String(session.currency ?? "usd").toLowerCase();
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  // Authoritative payment time: when the money was actually captured.
  let paidAtSeconds = Number(session.created ?? 0);
  if (paymentIntentId) {
    const intent = await stripeGet(`/payment_intents/${paymentIntentId}`, stripeSecret);
    const chargeId = typeof intent?.latest_charge === "string" ? intent.latest_charge : intent?.latest_charge?.id;
    if (chargeId) {
      const charge = await stripeGet(`/charges/${chargeId}`, stripeSecret);
      if (charge?.created) paidAtSeconds = Number(charge.created);
      if (charge?.status && charge.status !== "succeeded") return; // not captured: nothing to accrue
    } else if (intent?.created) {
      paidAtSeconds = Number(intent.created);
    }
  }
  const paidAtIso = new Date((paidAtSeconds || Math.floor(Date.now() / 1000)) * 1000).toISOString();

  let affiliate: { id: string; status: string; commission_rate: number | null } | null = null;
  if (referral?.affiliate_id) {
    const { data, error } = await db
      .from("affiliates")
      .select("id, status, commission_rate")
      .eq("id", referral.affiliate_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    affiliate = data as typeof affiliate;
  }

  const rejectMixed = Boolean((settings as Record<string, unknown>).reject_mixed_carts);
  const inWindow = referral
    ? withinAttributionWindow(referral.first_seen_at, paidAtIso, settings.attribution_window_days)
    : false;

  const accrueNow = Boolean(
    referral &&
      affiliate &&
      affiliate.status === "active" &&
      breakdown.approvedPriceIds.length > 0 &&
      breakdown.eligibleCents > 0 &&
      currency === "usd" &&
      inWindow &&
      !(rejectMixed && breakdown.mixedCart),
  );

  const rate = Number(affiliate?.commission_rate ?? COMMISSION_RATE);

  // One atomic call: the payment record, the earned commission, any refund or
  // chargeback that arrived first, and the referral status.
  const { error } = await db.rpc("affiliate_record_enrollment_payment", {
    _payload: {
      referral_id: referral?.id ?? null,
      affiliate_id: referral?.affiliate_id ?? null,
      stripe_object_type: "checkout.session",
      stripe_object_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      customer_email_normalized: email,
      price_id: breakdown.approvedPriceIds[0] ?? breakdown.otherPriceIds[0] ?? null,
      currency,
      gross_amount_cents: Number(session.amount_total ?? 0),
      eligible_amount_cents: breakdown.eligibleCents,
      livemode,
      paid_at: paidAtIso,
      matched_by: referralId ? "client_reference_id" : referral ? "customer_email" : null,
      rate,
      accrue: accrueNow,
      source_event_id: eventId,
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Signed transfer/payout reconciliation. We record every event once, and only
 * update a transfer row when the event genuinely identifies it. Bank payout
 * timing belongs to the recipient's own Stripe payout schedule.
 */
async function recordPayoutEvent(db: ReturnType<typeof adminClient>, event: any, livemode: boolean) {
  const obj = event.data?.object ?? {};
  const isTransfer = String(event.type).startsWith("transfer.");
  const { error: insertError } = await db.from("affiliate_payout_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    stripe_account_id: event.account ?? null,
    stripe_transfer_id: isTransfer ? obj.id ?? null : null,
    stripe_payout_id: isTransfer ? null : obj.id ?? null,
    livemode,
    details: {
      amount: obj.amount ?? null,
      currency: obj.currency ?? null,
      reversed: obj.reversed ?? null,
      status: obj.status ?? null,
      arrival_date: obj.arrival_date ?? null,
      failure_message: obj.failure_message ?? null,
    },
  });
  // A repeat of the same event id is fine; anything else must fail the event.
  if (insertError && insertError.code !== "23505") throw new Error(insertError.message);

  if (!isTransfer || !obj.id) return;

  const { data: transfer, error: readError } = await db
    .from("affiliate_transfers")
    .select("id, amount_cents")
    .eq("stripe_transfer_id", obj.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!transfer) return;

  if (event.type === "transfer.reversed") {
    const { error } = await db
      .from("affiliate_transfers")
      .update({
        status: "failed",
        failure_code: "reversed",
        failure_message: "Stripe reversed this transfer.",
      })
      .eq("id", transfer.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await db.from("affiliate_transfers").update({ status: "paid" }).eq("id", transfer.id);
  if (error) throw new Error(error.message);
}
