import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyGhlTransaction, classifyStripeCharge, cleanReason, enforcementGuard } from "./memberAccess.ts";

const paid = {
  id: "ch_1", livemode: true, status: "succeeded", paid: true, amount: 299700, amount_refunded: 0,
  refunded: false, disputed: false, billing_details: { email: " Buyer@Example.com " }, payment_intent: "pi_1", created: 1760000000,
};

Deno.test("live paid Stripe charge qualifies with normalized email", () => {
  const d = classifyStripeCharge(paid, new Set());
  assertEquals([d.qualifies, d.email, d.amountCents], [true, "buyer@example.com", 299700]);
});

Deno.test("test, unpaid, refunded, disputed, ad funding and connected sales never qualify", () => {
  const none = new Set<string>();
  assertEquals(classifyStripeCharge({ ...paid, livemode: false }, none).reason, "test_mode");
  assertEquals(classifyStripeCharge({ ...paid, status: "failed", paid: false }, none).reason, "not_paid");
  assertEquals(classifyStripeCharge({ ...paid, refunded: true, amount_refunded: 299700 }, none).reason, "refunded");
  assertEquals(classifyStripeCharge({ ...paid, disputed: true }, none).reason, "disputed");
  assertEquals(classifyStripeCharge(paid, new Set(["pi_1"])).reason, "ad_funding");
  assertEquals(classifyStripeCharge({ ...paid, transfer_data: { destination: "acct_x" } }, none).reason, "connected_account_sale");
  assertEquals(classifyStripeCharge({ ...paid, billing_details: {} }, none).reason, "no_email");
});

Deno.test("partial refund keeps a Stripe purchase qualifying", () => {
  assertEquals(classifyStripeCharge({ ...paid, amount_refunded: 1000 }, new Set()).qualifies, true);
});

Deno.test("GoHighLevel transactions: only succeeded live payments qualify", () => {
  const tx = { _id: "t1", status: "succeeded", amount: 2997, liveMode: true, contactEmail: "a@b.co" };
  assertEquals(classifyGhlTransaction(tx).qualifies, true);
  assertEquals(classifyGhlTransaction(tx).amountCents, 299700);
  assertEquals(classifyGhlTransaction({ ...tx, status: "refunded" }).reason, "refunded");
  assertEquals(classifyGhlTransaction({ ...tx, status: "failed" }).reason, "status_failed");
  assertEquals(classifyGhlTransaction({ ...tx, liveMode: false }).reason, "test_mode");
  assertEquals(classifyGhlTransaction({ ...tx, contactEmail: null }).reason, "no_email");
  assertEquals(classifyGhlTransaction({ ...tx, contactEmail: null }, "c@d.co").qualifies, true);
});

Deno.test("turning access on requires confirming the exact blocked-account count", () => {
  assertEquals(enforcementGuard(false, 91, undefined), null);
  assertEquals(enforcementGuard(true, 91, undefined), "confirm_count_required");
  assertEquals(enforcementGuard(true, 91, 90), "confirm_count_mismatch");
  assertEquals(enforcementGuard(true, 91, 91), null);
});

Deno.test("admin grant/revoke needs a real reason", () => {
  assertEquals(cleanReason("ok"), null);
  assertEquals(cleanReason("  Paid by Zelle on 11/2  "), "Paid by Zelle on 11/2");
});
