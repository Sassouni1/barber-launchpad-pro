import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFundingSessionBody, evaluateFundingStatus, isStripeHostedUrl } from "./managedAdFunding.ts";

const base = {
  appUrl: "https://x",
  stripeCustomerId: "cus_A",
  memberId: "member-1",
  transactionId: "tx-1",
  campaign: { id: "camp-1", name: "Camp", currency: "usd" },
  amountCents: 200,
};

Deno.test("funding session is hosted payment with success/cancel to /ads, no embedded return_url", () => {
  const b = buildFundingSessionBody(base);
  assertEquals(b.mode, "payment");
  assertEquals(b.ui_mode, "hosted");
  assertEquals(b.success_url, "https://x/ads?funding_session_id={CHECKOUT_SESSION_ID}");
  assertEquals(b.cancel_url, "https://x/ads?funding_canceled=1");
  assertEquals("return_url" in b, false);
});

Deno.test("funding session is scoped to server member, campaign and transaction", () => {
  const b = buildFundingSessionBody(base);
  assertEquals(b["metadata[customer_id]"], "member-1");
  assertEquals(b["metadata[campaign_id]"], "camp-1");
  assertEquals(b["metadata[transaction_id]"], "tx-1");
  assertEquals(b["line_items[0][price_data][unit_amount]"], "200");
});

Deno.test("funding below $2 is rejected", () => {
  assertThrows(() => buildFundingSessionBody({ ...base, amountCents: 199 }));
});

Deno.test("only checkout.stripe.com URLs are accepted", () => {
  assertEquals(isStripeHostedUrl("https://checkout.stripe.com/c/pay/cs_1"), true);
  assertEquals(isStripeHostedUrl("https://evil.example/checkout.stripe.com/"), false);
  assertEquals(isStripeHostedUrl(null), false);
});

Deno.test("redirect without webhook confirmation is never success", () => {
  const camp = { funded_cents: 0, spent_cents: 0 };
  assertEquals(evaluateFundingStatus({ transaction: { status: "requires_action", amount_cents: 500, campaign_id: "c" }, ledgerFundingExists: false, campaign: camp }).state, "pending");
  assertEquals(evaluateFundingStatus({ transaction: { status: "succeeded", amount_cents: 500, campaign_id: "c" }, ledgerFundingExists: false, campaign: camp }).state, "pending");
  assertEquals(evaluateFundingStatus({ transaction: null, ledgerFundingExists: false, campaign: null }).state, "not_found");
});

Deno.test("confirmed only with succeeded transaction and ledger entry, reporting amount and balance", () => {
  assertEquals(
    evaluateFundingStatus({ transaction: { status: "succeeded", amount_cents: 500, campaign_id: "c" }, ledgerFundingExists: true, campaign: { funded_cents: 700, spent_cents: 100 } }),
    { state: "confirmed", amountCents: 500, campaignId: "c", balanceCents: 600 },
  );
});
