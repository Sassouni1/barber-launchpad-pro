// Pure rules for Barber Launch member access evidence. No I/O here.
// Access is granted only from verified, completed, live, non-refunded,
// non-disputed purchases; signing up or logging in never grants anything.

export type EvidenceDecision = {
  qualifies: boolean;
  reason: string | null;
  email: string | null;
  amountCents: number;
  refundedCents: number;
  disputed: boolean;
  livemode: boolean;
  paidAt: string | null;
  description: string | null;
};

export function normalizeEmailOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
}

/** A charge read from the platform Stripe account. */
export function classifyStripeCharge(charge: any, adFundingPaymentIntents: Set<string>): EvidenceDecision {
  const amount = Number(charge?.amount ?? 0);
  const refunded = Number(charge?.amount_refunded ?? 0);
  const email = normalizeEmailOrNull(charge?.billing_details?.email) ??
    normalizeEmailOrNull(charge?.receipt_email) ??
    normalizeEmailOrNull(typeof charge?.customer === "object" ? charge?.customer?.email : null);
  const pi = typeof charge?.payment_intent === "string" ? charge.payment_intent : charge?.payment_intent?.id ?? null;
  const base = {
    email,
    amountCents: amount,
    refundedCents: refunded,
    disputed: Boolean(charge?.disputed),
    livemode: charge?.livemode === true,
    paidAt: typeof charge?.created === "number" ? new Date(charge.created * 1000).toISOString() : null,
    description: typeof charge?.description === "string" ? charge.description.slice(0, 200) : null,
  };
  const reason =
    charge?.livemode !== true ? "test_mode" :
    charge?.status !== "succeeded" || charge?.paid !== true ? "not_paid" :
    !(amount > 0) ? "no_amount" :
    charge?.disputed === true ? "disputed" :
    (charge?.refunded === true || refunded >= amount) ? "refunded" :
    charge?.transfer_data?.destination || charge?.on_behalf_of ? "connected_account_sale" :
    pi && adFundingPaymentIntents.has(pi) ? "ad_funding" :
    charge?.metadata?.barber_launch_customer_id && charge?.metadata?.campaign_id ? "ad_funding" :
    !email ? "no_email" :
    null;
  return { qualifies: reason === null, reason, ...base };
}

const GHL_PAID = new Set(["succeeded", "partially_refunded", "paid", "completed"]);

/** A transaction read from the Barber Launch GoHighLevel location. */
export function classifyGhlTransaction(tx: any, emailOverride?: string | null): EvidenceDecision {
  const amountRaw = Number(tx?.amount ?? 0);
  // GHL reports amounts in major units (dollars).
  const amount = Math.round(amountRaw * 100);
  const refundedRaw = Number(tx?.amountRefunded ?? tx?.refundedAmount ?? 0);
  const refunded = Math.round(refundedRaw * 100);
  const status = String(tx?.status ?? "").toLowerCase();
  const email = normalizeEmailOrNull(emailOverride) ?? normalizeEmailOrNull(tx?.contactEmail) ?? normalizeEmailOrNull(tx?.contactSnapshot?.email);
  const live = tx?.liveMode !== false && tx?.livemode !== false;
  const base = {
    email,
    amountCents: amount,
    refundedCents: refunded,
    disputed: status.includes("disput"),
    livemode: live,
    paidAt: typeof tx?.createdAt === "string" ? tx.createdAt : null,
    description: [tx?.entitySourceName, tx?.entitySourceType].filter((v) => typeof v === "string" && v).join(" · ").slice(0, 200) || null,
  };
  const reason =
    !live ? "test_mode" :
    status.includes("disput") ? "disputed" :
    status === "refunded" || (refunded > 0 && refunded >= amount) ? "refunded" :
    !GHL_PAID.has(status) ? `status_${status || "unknown"}` :
    !(amount > 0) ? "no_amount" :
    !email ? "no_email" :
    null;
  return { qualifies: reason === null, reason, ...base };
}

/** Enabling the access switch must name the exact number of accounts it will block. */
export function enforcementGuard(enable: boolean, unentitledCount: number, confirmCount: unknown): string | null {
  if (!enable) return null;
  if (typeof confirmCount !== "number" || !Number.isInteger(confirmCount)) return "confirm_count_required";
  if (confirmCount !== unentitledCount) return "confirm_count_mismatch";
  return null;
}

export function cleanReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/\s+/g, " ");
  return v.length >= 5 && v.length <= 500 ? v : null;
}
