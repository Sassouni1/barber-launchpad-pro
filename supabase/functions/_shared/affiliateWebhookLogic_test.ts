import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeEligibleAmount, refundReduction, withinAttributionWindow } from "./affiliateWebhookLogic.ts";

const APPROVED = ["price_enroll_3000"];

Deno.test("mixed cart earns only on the approved enrollment line", () => {
  const b = computeEligibleAmount(
    [
      { price: { id: "price_enroll_3000" }, amount_subtotal: 300000, amount_discount: 0, amount_tax: 0 },
      { price: { id: "price_clippers" }, amount_subtotal: 20000, amount_discount: 0, amount_tax: 1650 },
    ],
    APPROVED,
  );
  assertEquals(b.eligibleCents, 300000);
  assertEquals(b.cartSubtotalCents, 320000);
  assertEquals(b.mixedCart, true);
  assertEquals(Math.round(b.eligibleCents * 0.2), 60000);
});

Deno.test("discounts reduce the basis, tax and shipping never enter it", () => {
  const b = computeEligibleAmount(
    [{ price: { id: "price_enroll_3000" }, amount_subtotal: 300000, amount_discount: 30000, amount_tax: 24750 }],
    APPROVED,
  );
  assertEquals(b.eligibleCents, 270000);
  assertEquals(Math.round(b.eligibleCents * 0.2), 54000);
});

Deno.test("a cart with no approved price earns nothing", () => {
  const b = computeEligibleAmount(
    [{ price: { id: "price_other" }, amount_subtotal: 300000, amount_discount: 0 }],
    APPROVED,
  );
  assertEquals(b.eligibleCents, 0);
  assertEquals(b.approvedPriceIds.length, 0);
  assertEquals(b.mixedCart, false);
});

Deno.test("paginated line items are all counted", () => {
  const pages = [
    { price: { id: "price_enroll_3000" }, amount_subtotal: 150000, amount_discount: 0 },
    { price: { id: "price_enroll_3000" }, amount_subtotal: 150000, amount_discount: 0 },
  ];
  assertEquals(computeEligibleAmount(pages, APPROVED).eligibleCents, 300000);
});

Deno.test("partial refund reduces proportionally and never below zero", () => {
  const first = refundReduction({
    eligibleCents: 300000,
    grossCents: 300000,
    refundedTotalCents: 150000,
    earnedCents: 60000,
    alreadyReducedCents: 0,
    rate: 0.2,
  });
  assertEquals(first, 30000);

  // Second event carrying the same total must not reduce again.
  assertEquals(
    refundReduction({
      eligibleCents: 300000,
      grossCents: 300000,
      refundedTotalCents: 150000,
      earnedCents: 60000,
      alreadyReducedCents: 30000,
      rate: 0.2,
    }),
    0,
  );
});

Deno.test("full refund can never claw back more than was earned", () => {
  const r = refundReduction({
    eligibleCents: 300000,
    grossCents: 300000,
    refundedTotalCents: 300000,
    earnedCents: 60000,
    alreadyReducedCents: 30000,
    rate: 0.2,
  });
  assertEquals(r, 30000);
  assertEquals(
    refundReduction({
      eligibleCents: 300000,
      grossCents: 300000,
      refundedTotalCents: 400000,
      earnedCents: 60000,
      alreadyReducedCents: 60000,
      rate: 0.2,
    }),
    0,
  );
});

Deno.test("attribution is judged against the payment time, not processing time", () => {
  const firstSeen = "2026-01-01T00:00:00.000Z";
  const paidInside = "2026-01-20T00:00:00.000Z";
  const paidOutside = "2026-03-01T00:00:00.000Z";
  assertEquals(withinAttributionWindow(firstSeen, paidInside, 30), true);
  assertEquals(withinAttributionWindow(firstSeen, paidOutside, 30), false);
  // A late-processed event for a payment inside the window still counts.
  assertEquals(withinAttributionWindow(firstSeen, paidInside, 30), true);
  assertEquals(withinAttributionWindow(firstSeen, paidOutside, null), true);
});
