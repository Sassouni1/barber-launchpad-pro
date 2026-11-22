import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ENROLLMENT, evaluateCheckoutSession, SESSION_ID_PATTERN } from "./checkoutClaim.ts";

const ID = "cs_live_a1B2c3D4e5F6g7H8";
const paid = (): any => ({
  object: "checkout.session", id: ID, livemode: true, mode: "payment", status: "complete", payment_status: "paid",
  metadata: { source: ENROLLMENT.source, product: ENROLLMENT.product }, amount_total: 299700, currency: "usd",
  customer_details: { email: "Buyer@Example.com" },
  line_items: { has_more: false, data: [{ quantity: 1, price: { id: ENROLLMENT.priceId, unit_amount: 299700 } }] },
  payment_intent: {
    id: "pi_1", livemode: true, status: "succeeded", amount_received: 299700, currency: "usd",
    latest_charge: { id: "ch_1", livemode: true, paid: true, status: "succeeded", captured: true, refunded: false, amount_refunded: 0, disputed: false, amount: 299700, created: 1795000000 },
  },
});
const reason = (s: any) => { const r = evaluateCheckoutSession(s, ID); return r.ok ? "ok" : r.reason; };

Deno.test("a complete, paid, live enrollment session is proof", () => {
  const r = evaluateCheckoutSession(paid(), ID);
  assertEquals(r.ok, true);
  if (r.ok) { assertEquals(r.chargeId, "ch_1"); assertEquals(r.checkoutEmail, "buyer@example.com"); }
});

Deno.test("only live session ids are accepted", () => {
  assertEquals(SESSION_ID_PATTERN.test(ID), true);
  assertEquals(SESSION_ID_PATTERN.test("cs_test_a1B2c3D4e5F6g7H8"), false);
  assertEquals(SESSION_ID_PATTERN.test("cs_live_short"), false);
});

Deno.test("a different session id than requested is rejected", () => {
  assertEquals(evaluateCheckoutSession(paid(), "cs_live_zzzzzzzzzzzzzzzz").ok, false);
});

Deno.test("unpaid, incomplete and test-mode sessions are rejected", () => {
  assertEquals(reason({ ...paid(), payment_status: "unpaid" }), "unpaid");
  assertEquals(reason({ ...paid(), status: "open" }), "incomplete");
  assertEquals(reason({ ...paid(), status: "expired" }), "incomplete");
  assertEquals(reason({ ...paid(), livemode: false }), "test_mode");
});

Deno.test("wrong product, price, quantity or amount is rejected", () => {
  assertEquals(reason({ ...paid(), metadata: { source: "ad_funding", product: ENROLLMENT.product } }), "wrong_product");
  const s1 = paid(); s1.line_items.data[0].price.id = "price_other"; assertEquals(reason(s1), "wrong_price");
  const s2 = paid(); s2.line_items.data[0].quantity = 2; assertEquals(reason(s2), "wrong_price");
  assertEquals(reason({ ...paid(), amount_total: 100 }), "wrong_amount");
});

Deno.test("refunded (even partly) or disputed charges are rejected", () => {
  const r1 = paid(); r1.payment_intent.latest_charge.amount_refunded = 100; assertEquals(reason(r1), "refunded");
  const r2 = paid(); r2.payment_intent.latest_charge.refunded = true; assertEquals(reason(r2), "refunded");
  const r3 = paid(); r3.payment_intent.latest_charge.disputed = true; assertEquals(reason(r3), "disputed");
});

Deno.test("payment intent or charge that did not succeed is rejected", () => {
  const p1 = paid(); p1.payment_intent.status = "processing"; assertEquals(reason(p1), "payment_not_succeeded");
  const p2 = paid(); p2.payment_intent.latest_charge.status = "pending"; assertEquals(reason(p2), "charge_not_paid");
  const p3 = paid(); (p3 as any).payment_intent = "pi_1"; assertEquals(reason(p3), "no_payment");
});
