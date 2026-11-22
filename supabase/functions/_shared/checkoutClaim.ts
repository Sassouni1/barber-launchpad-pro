// Pure rules: does a Stripe Checkout Session (fetched server-side with the
// platform secret) prove a completed, paid, unrefunded, undisputed purchase of
// the Barber Launch enrollment on the expected live account? No network here.
// Tested in checkoutClaim_test.ts.

export const ENROLLMENT = {
  account: "acct_1LMNKMI6LFtj88Bq",
  priceId: "price_1UAWi1I6LFtj88BqhYUGuhnC",
  amount: 299700,
  currency: "usd",
  source: "barber_launch_enrollment",
  product: "hair_system_mastery",
} as const;

export const SESSION_ID_PATTERN = /^cs_live_[A-Za-z0-9]{10,200}$/;

export type SessionProof =
  | { ok: true; paymentIntentId: string; chargeId: string; checkoutEmail: string | null; amountCents: number; currency: string; paidAt: string }
  | { ok: false; reason: string };

const lower = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null);

/** `session` must be retrieved with expand[]=line_items and expand[]=payment_intent.latest_charge. */
export function evaluateCheckoutSession(session: any, sessionId: string): SessionProof {
  const d = session;
  if (!d || d.object !== "checkout.session" || d.id !== sessionId) return { ok: false, reason: "not_found" };
  if (d.livemode !== true) return { ok: false, reason: "test_mode" };
  if (d.mode !== "payment") return { ok: false, reason: "wrong_mode" };
  if (d.status !== "complete") return { ok: false, reason: "incomplete" };
  if (d.payment_status !== "paid") return { ok: false, reason: "unpaid" };
  if (d.metadata?.source !== ENROLLMENT.source || d.metadata?.product !== ENROLLMENT.product) return { ok: false, reason: "wrong_product" };
  if (d.amount_total !== ENROLLMENT.amount || d.currency !== ENROLLMENT.currency) return { ok: false, reason: "wrong_amount" };
  const items = d.line_items?.data;
  if (!Array.isArray(items) || items.length !== 1 || d.line_items?.has_more !== false) return { ok: false, reason: "wrong_items" };
  const item = items[0];
  if (item?.price?.id !== ENROLLMENT.priceId || item?.quantity !== 1 || item?.price?.unit_amount !== ENROLLMENT.amount) {
    return { ok: false, reason: "wrong_price" };
  }

  const pi = d.payment_intent;
  if (!pi || typeof pi !== "object" || typeof pi.id !== "string") return { ok: false, reason: "no_payment" };
  if (pi.livemode !== true) return { ok: false, reason: "test_mode" };
  if (pi.status !== "succeeded" || pi.amount_received !== ENROLLMENT.amount || pi.currency !== ENROLLMENT.currency) {
    return { ok: false, reason: "payment_not_succeeded" };
  }
  const ch = pi.latest_charge;
  if (!ch || typeof ch !== "object" || typeof ch.id !== "string") return { ok: false, reason: "no_charge" };
  if (ch.livemode !== true) return { ok: false, reason: "test_mode" };
  if (ch.paid !== true || ch.status !== "succeeded" || ch.captured === false) return { ok: false, reason: "charge_not_paid" };
  if (ch.refunded === true || Number(ch.amount_refunded ?? 0) > 0) return { ok: false, reason: "refunded" };
  if (ch.disputed === true) return { ok: false, reason: "disputed" };
  if (ch.amount !== ENROLLMENT.amount) return { ok: false, reason: "wrong_amount" };

  const paidAt = typeof ch.created === "number" ? new Date(ch.created * 1000).toISOString() : new Date().toISOString();
  return {
    ok: true,
    paymentIntentId: pi.id,
    chargeId: ch.id,
    checkoutEmail: lower(d.customer_details?.email) ?? lower(d.customer_email) ?? lower(ch.billing_details?.email),
    amountCents: ENROLLMENT.amount,
    currency: ENROLLMENT.currency,
    paidAt,
  };
}
