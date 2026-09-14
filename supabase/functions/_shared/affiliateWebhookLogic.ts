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

/** Test-mode events must never touch live balances, and vice versa. */
export function modeMatches(eventLivemode: boolean, programLiveEnabled: boolean): boolean {
  return Boolean(eventLivemode) === Boolean(programLiveEnabled);
}
