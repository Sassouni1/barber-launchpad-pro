// Prepaid campaign funding (Stripe-hosted Checkout, mode=payment) for Barber Launch managed ads.

export const MIN_FUNDING_CENTS = 200;
export const STRIPE_HOSTED_PREFIX = "https://checkout.stripe.com/";

export function isStripeHostedUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(STRIPE_HOSTED_PREFIX);
}

export function buildFundingSessionBody(input: {
  appUrl: string;
  stripeCustomerId: string;
  memberId: string;
  transactionId: string;
  campaign: { id: string; name: string; currency: string };
  amountCents: number;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents < MIN_FUNDING_CENTS) throw new Error("amount_below_minimum");
  return {
    mode: "payment",
    ui_mode: "hosted",
    customer: input.stripeCustomerId,
    success_url: `${input.appUrl}/ads?funding_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.appUrl}/ads?funding_canceled=1`,
    "line_items[0][price_data][currency]": input.campaign.currency,
    "line_items[0][price_data][product_data][name]": `${input.campaign.name} — prepaid media balance`,
    "line_items[0][price_data][unit_amount]": String(input.amountCents),
    "line_items[0][price_data][product_data][metadata][campaign_id]": input.campaign.id,
    "line_items[0][quantity]": "1",
    "payment_intent_data[setup_future_usage]": "off_session",
    "metadata[transaction_id]": input.transactionId,
    "metadata[campaign_id]": input.campaign.id,
    "metadata[customer_id]": input.memberId,
  } as Record<string, string>;
}

export type FundingStatus =
  | { state: "not_found" }
  | { state: "pending"; amountCents: number; campaignId: string | null }
  | { state: "failed"; amountCents: number; campaignId: string | null }
  | { state: "confirmed"; amountCents: number; campaignId: string; balanceCents: number };

/**
 * Only "confirmed" when the signed webhook marked the transaction succeeded AND wrote its ledger funding entry.
 * A Stripe redirect alone never produces "confirmed".
 */
export function evaluateFundingStatus(input: {
  transaction: { status: string; amount_cents: number; campaign_id: string | null } | null;
  ledgerFundingExists: boolean;
  campaign: { funded_cents: number; spent_cents: number } | null;
}): FundingStatus {
  const t = input.transaction;
  if (!t) return { state: "not_found" };
  if (t.status === "failed" || t.status === "canceled") return { state: "failed", amountCents: t.amount_cents, campaignId: t.campaign_id };
  if (t.status === "succeeded" && input.ledgerFundingExists && t.campaign_id && input.campaign) {
    return { state: "confirmed", amountCents: t.amount_cents, campaignId: t.campaign_id, balanceCents: input.campaign.funded_cents - input.campaign.spent_cents };
  }
  return { state: "pending", amountCents: t.amount_cents, campaignId: t.campaign_id };
}
