// Pure helpers for the affiliate Stripe webhook. Kept free of network and
// database access so they can be unit tested directly.

export type StripeLineItem = {
  price?: { id?: string | null } | null;
  amount_subtotal?: number | null;
  amount_discount?: number | null;
  amount_tax?: number | null;
  amount_total?: number | null;
  quantity?: number | null;
};

export type EligibleBreakdown = {
  /** Amount commission may be paid on: approved enrollment lines only, after discounts, before tax and shipping. */
  eligibleCents: number;
  /** Sum of every line on the session, after discounts and before tax. */
  cartSubtotalCents: number;
  approvedPriceIds: string[];
  otherPriceIds: string[];
  mixedCart: boolean;
};

/**
 * Commission basis is built up line by line from the approved enrollment items
 * only. A cart that also contains other products never earns commission on
 * those other products.
 *
 * Stripe line items already carry per-line discounts and tax, and shipping is
 * never a line item, so tax and shipping are excluded simply by using
 * amount_subtotal - amount_discount.
 */
export function computeEligibleAmount(
  lineItems: StripeLineItem[],
  approvedPriceIds: string[],
): EligibleBreakdown {
  const approved = new Set(approvedPriceIds.filter(Boolean));
  let eligible = 0;
  let subtotal = 0;
  const approvedSeen: string[] = [];
  const otherSeen: string[] = [];

  for (const li of lineItems) {
    const priceId = li?.price?.id ?? null;
    const net = Math.max(0, Number(li?.amount_subtotal ?? 0) - Number(li?.amount_discount ?? 0));
    subtotal += net;
    if (priceId && approved.has(priceId)) {
      eligible += net;
      if (!approvedSeen.includes(priceId)) approvedSeen.push(priceId);
    } else {
      if (priceId && !otherSeen.includes(priceId)) otherSeen.push(priceId);
    }
  }

  return {
    eligibleCents: eligible,
    cartSubtotalCents: subtotal,
    approvedPriceIds: approvedSeen,
    otherPriceIds: otherSeen,
    mixedCart: approvedSeen.length > 0 && otherSeen.length > 0,
  };
}

/**
 * Mirrors the reduction the database applies, so the maths can be tested
 * without a database round trip.
 */
export function refundReduction(args: {
  eligibleCents: number;
  grossCents: number;
  refundedTotalCents: number;
  earnedCents: number;
  alreadyReducedCents: number;
  rate: number;
}): number {
  const share = Math.min(1, args.refundedTotalCents / Math.max(1, args.grossCents));
  const target = Math.min(Math.round(args.eligibleCents * share * args.rate), args.earnedCents);
  return Math.max(0, target - args.alreadyReducedCents);
}

/**
 * A void referral never earns, no matter how it was matched. Matching by the
 * checkout's referral id must be exactly as strict as matching by email.
 */
export function isAttributableReferral(referral: { status?: string | null } | null | undefined): boolean {
  if (!referral) return false;
  return String(referral.status ?? "") !== "void";
}

export type TransferOutcome = {
  /** 'sent' = money is in the affiliate's Stripe account. Never means their bank. */
  status: "sent" | "failed";
  reversedCents: number;
  fullyReversed: boolean;
  partiallyReversed: boolean;
  /** Partial reversals need a human: the ledger cannot infer the intended split. */
  needsReconciliation: boolean;
  note: string | null;
};

/**
 * Decides a transfer row's state from the AUTHORITATIVE Stripe transfer object,
 * not from which event happened to arrive last. A delayed transfer.created or
 * transfer.updated can therefore never overwrite a reversal.
 *
 * Reaching a connected account is not the same as reaching a bank: bank arrival
 * is only ever proven by a payout event on that connected account.
 */
export function transferOutcome(transfer: {
  amount?: number | null;
  amount_reversed?: number | null;
  reversed?: boolean | null;
} | null | undefined): TransferOutcome {
  const amount = Math.max(0, Number(transfer?.amount ?? 0));
  const reversed = Math.max(0, Number(transfer?.amount_reversed ?? 0));
  const fully = Boolean(transfer?.reversed) || (amount > 0 && reversed >= amount);
  const partially = !fully && reversed > 0;

  return {
    status: fully ? "failed" : "sent",
    reversedCents: reversed,
    fullyReversed: fully,
    partiallyReversed: partially,
    needsReconciliation: partially,
    note: fully
      ? "Stripe reversed this transfer in full."
      : partially
      ? `Stripe reversed ${reversed} of ${amount} on this transfer; the balance needs review.`
      : null,
  };
}

/** Attribution is judged against when the money was actually paid, not when we process the event. */
export function withinAttributionWindow(
  firstSeenAtIso: string,
  paidAtIso: string,
  windowDays: number | null | undefined,
): boolean {
  if (!windowDays) return true;
  const ageDays = (new Date(paidAtIso).getTime() - new Date(firstSeenAtIso).getTime()) / 86_400_000;
  return ageDays <= windowDays;
}

/**
 * A transfer row must be reconciled against Stripe before any resend when ANY
 * persisted trace of an earlier reservation, attempt or parked outcome exists.
 * An unknown Stripe success whose database finalisation failed leaves exactly
 * these traces, so this is what stops a double send.
 */
export function isAmbiguousTransfer(row: {
  attempts?: number | null;
  stripe_transfer_id?: string | null;
  stripe_destination_payment_id?: string | null;
  sent_at?: string | null;
  needs_reconciliation?: boolean | null;
  reconciliation_note?: string | null;
  failure_code?: string | null;
  blocked_kind?: string | null;
}): boolean {
  return Number(row.attempts ?? 0) > 0 ||
    Boolean(row.stripe_transfer_id) ||
    Boolean(row.stripe_destination_payment_id) ||
    Boolean(row.sent_at) ||
    Boolean(row.needs_reconciliation) ||
    Boolean(row.reconciliation_note) ||
    Boolean(row.failure_code) ||
    Boolean(row.blocked_kind);
}
