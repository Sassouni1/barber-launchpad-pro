// Legacy receive-order hardening: a GHL form/webhook payload alone can never
// create a purchase row. Only a Stripe payment reference that the server
// independently confirms as succeeded (with the hair-system key) is accepted.

const PI = /^pi_[A-Za-z0-9]+$/;
const CH = /^(ch|py)_[A-Za-z0-9]+$/;

export type PaymentRef = { kind: "payment_intent" | "charge"; id: string };

/** Pull a Stripe payment reference from the known legacy payload shapes. */
export function extractStripePaymentRef(body: Record<string, any>): PaymentRef | null {
  const order = (body?.order ?? {}) as Record<string, any>;
  const meta = (order?.line_items?.[0]?.meta ?? {}) as Record<string, any>;
  const tx = (body?.transaction ?? body?.payment ?? {}) as Record<string, any>;
  const candidates = [
    body?.stripe_payment_intent_id, body?.payment_intent_id, body?.paymentIntentId,
    order?.payment_intent_id, order?.paymentIntentId, meta?.payment_intent_id,
    tx?.payment_intent_id, tx?.paymentIntentId,
    body?.stripe_charge_id, body?.charge_id, body?.chargeId,
    order?.charge_id, order?.chargeId, meta?.charge_id, tx?.charge_id, tx?.chargeId,
  ].map((v) => String(v ?? "").trim()).filter(Boolean);
  for (const c of candidates) {
    if (PI.test(c)) return { kind: "payment_intent", id: c };
    if (CH.test(c)) return { kind: "charge", id: c };
  }
  return null;
}

/** Decides from the Stripe object itself; never from the webhook claim. */
export function stripeObjectIsCompletedPayment(ref: PaymentRef, obj: Record<string, any> | null): boolean {
  if (!obj || obj.id !== ref.id) return false;
  if (ref.kind === "payment_intent") return obj.object === "payment_intent" && obj.status === "succeeded" && Number(obj.amount_received ?? 0) > 0;
  return obj.object === "charge" && obj.paid === true && obj.status === "succeeded" && obj.refunded !== true && obj.disputed !== true;
}

export async function verifyLegacyPayment(body: Record<string, any>, secret: string | null, fetchImpl: typeof fetch = fetch) {
  const ref = extractStripePaymentRef(body);
  if (!ref) return { ok: false as const, reason: "no_payment_reference" };
  if (!secret) return { ok: false as const, reason: "stripe_not_configured" };
  const path = ref.kind === "payment_intent" ? "payment_intents" : "charges";
  try {
    const res = await fetchImpl(`https://api.stripe.com/v1/${path}/${encodeURIComponent(ref.id)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const obj = res.ok ? await res.json() : null;
    if (!stripeObjectIsCompletedPayment(ref, obj)) return { ok: false as const, reason: "payment_not_verified" };
    return { ok: true as const, ref };
  } catch {
    return { ok: false as const, reason: "payment_lookup_failed" };
  }
}
