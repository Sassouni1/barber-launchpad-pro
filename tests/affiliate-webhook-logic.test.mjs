// Regression checks for the affiliate webhook's pure decision helpers.
// Run with: bun tests/affiliate-webhook-logic.test.mjs
import assert from "node:assert/strict";
import {
  isAttributableReferral,
  transferOutcome,
} from "../supabase/functions/_shared/affiliateWebhookLogic.ts";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
};

check("a void referral matched by id earns nothing", () => {
  assert.equal(isAttributableReferral({ status: "void" }), false);
});

check("a void referral matched by email earns nothing", () => {
  assert.equal(isAttributableReferral({ status: "void", lead_email_normalized: "a@b.c" }), false);
});

check("a live referral is attributable", () => {
  assert.equal(isAttributableReferral({ status: "call_requested" }), true);
  assert.equal(isAttributableReferral({ status: "converted" }), true);
});

check("a missing referral is not attributable", () => {
  assert.equal(isAttributableReferral(null), false);
  assert.equal(isAttributableReferral(undefined), false);
});

check("a clean transfer is sent, never bank-received", () => {
  const o = transferOutcome({ amount: 60000, amount_reversed: 0, reversed: false });
  assert.equal(o.status, "sent");
  assert.equal(o.reversedCents, 0);
  assert.equal(o.needsReconciliation, false);
});

check("a fully reversed transfer fails", () => {
  const o = transferOutcome({ amount: 60000, amount_reversed: 60000, reversed: true });
  assert.equal(o.status, "failed");
  assert.equal(o.fullyReversed, true);
});

check("a partial reversal stays sent but needs review", () => {
  const o = transferOutcome({ amount: 60000, amount_reversed: 15000, reversed: false });
  assert.equal(o.status, "sent");
  assert.equal(o.partiallyReversed, true);
  assert.equal(o.needsReconciliation, true);
  assert.match(o.note, /15000 of 60000/);
});

check("a late created/updated event cannot undo a reversal", () => {
  // Same authoritative object is read back whichever event arrived last.
  const reversed = { amount: 60000, amount_reversed: 60000, reversed: true };
  assert.equal(transferOutcome(reversed).status, "failed");
  assert.equal(transferOutcome(reversed).status, "failed");
});

console.log(`\n${passed}/8 checks passed`);

// ---- resend guard ----
const { isAmbiguousTransfer } = await import("../supabase/functions/_shared/affiliateWebhookLogic.ts");

check("a brand new job is not ambiguous", () => {
  assert.equal(isAmbiguousTransfer({ attempts: 0 }), false);
});
check("a stale first attempt forces a Stripe lookup", () => {
  assert.equal(isAmbiguousTransfer({ attempts: 1 }), true);
});
check("a parked reconciliation forces a Stripe lookup", () => {
  assert.equal(isAmbiguousTransfer({ attempts: 0, needs_reconciliation: true }), true);
  assert.equal(isAmbiguousTransfer({ attempts: 0, reconciliation_note: "unknown outcome" }), true);
});
check("a recorded Stripe id or send time forces a Stripe lookup", () => {
  assert.equal(isAmbiguousTransfer({ attempts: 0, stripe_transfer_id: "tr_1" }), true);
  assert.equal(isAmbiguousTransfer({ attempts: 0, sent_at: "2026-01-01T00:00:00Z" }), true);
  assert.equal(isAmbiguousTransfer({ attempts: 0, blocked_kind: "balance" }), true);
});
console.log(`${passed} checks passed in total`);
