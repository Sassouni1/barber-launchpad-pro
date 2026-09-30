import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { draftIdFromMetadata, paymentReference, planReplay, verifyPaidSession, automaticFulfillmentAllowed } from "./hairSystemFulfillmentLogic.ts";
import { fulfillPaidSession } from "./hairSystemFulfillment.ts";
import { extractStripePaymentRef, stripeObjectIsCompletedPayment, verifyLegacyPayment } from "./legacyOrderPayment.ts";
import { isReceiptEligible, receiptEligibleOrders } from "../../../src/lib/receiptEligibility.ts";

const DRAFT = "11111111-2222-4333-8444-555555555555";
const USER = "b525f762-345e-4f97-b31f-dcba2dcd5faa";
const session = (over: Record<string, any> = {}) => ({
  object: "checkout.session", id: "cs_live_draft1", payment_status: "paid", created: Date.parse("2026-10-02T00:00:00Z") / 1000,
  metadata: { user_id: USER, draft_id: DRAFT }, ...over,
});

// In-memory mirror of hair_system_materialize_paid_draft uniqueness rules.
function materializer(systemCount: number) {
  const orders = new Map<string, string>();
  return (sessionId: string) => Array.from({ length: systemCount }, (_, i) => {
    const ref = paymentReference(sessionId, i);
    if (!orders.has(ref)) orders.set(ref, crypto.randomUUID());
    return orders.get(ref)!;
  }).concat([]) && { ids: Array.from({ length: systemCount }, (_, i) => orders.get(paymentReference(sessionId, i))!), total: orders.size };
}

// Fake db that records every write; any orders write in an unpaid path fails the test.
function fakeDb() {
  const writes: string[] = [];
  const chain: any = new Proxy({}, { get: (_t, p) => (p === "then" ? undefined : (..._a: any[]) => { writes.push(String(p)); return chain; }) });
  return { writes, db: { from: (t: string) => { writes.push(`from:${t}`); return chain; }, rpc: (n: string) => { writes.push(`rpc:${n}`); return Promise.resolve({ data: null, error: null }); } } as any };
}

Deno.test("unpaid/abandoned/expired checkout never creates orders or sends", async () => {
  for (const status of ["unpaid", "no_payment_required", undefined]) {
    const { db, writes } = fakeDb();
    await assertRejects(() => fulfillPaidSession(db, session({ payment_status: status }), { eventId: "e", stripeSecret: "x", syncSavedCard: false, mode: "automatic" }));
    assertEquals(writes, []);
  }
  assertEquals(verifyPaidSession(session({ status: "expired", payment_status: "unpaid" })).ok, false);
});

Deno.test("draft session requires matching user and a valid draft reference", () => {
  assertEquals(verifyPaidSession(session(), { expectedUserId: "someone-else" }), { ok: false, reason: "user_mismatch" });
  assertEquals(draftIdFromMetadata({ draft_id: "not-a-uuid" }), null);
  assertEquals(verifyPaidSession(session({ metadata: { user_id: USER } })), { ok: false, reason: "no_order_ids_metadata" });
  assertEquals(verifyPaidSession(session()), { ok: true, orderIds: [], draftId: DRAFT });
});

Deno.test("paid single system creates exactly one order with durable reference", () => {
  const m = materializer(1);
  const r = m("cs_live_draft1");
  assertEquals(r.ids.length, 1);
  assertEquals(paymentReference("cs_live_draft1", 0), "stripe:cs_live_draft1:0");
});

Deno.test("paid multiple systems create one order per system index", () => {
  const r = materializer(3)("cs_live_multi");
  assertEquals(new Set(r.ids).size, 3);
  assertEquals(r.total, 3);
});

Deno.test("duplicate webhook + buyer return never duplicate orders", () => {
  const m = materializer(2);
  const first = m("cs_live_dup");
  const retry = m("cs_live_dup");
  const ret = m("cs_live_dup");
  assertEquals(first.ids, retry.ids);
  assertEquals(first.ids, ret.ids);
  assertEquals(ret.total, 2);
});

Deno.test("failed delivery retries without touching already-sent channels", () => {
  const id = "00000000-0000-4000-8000-0000000000aa";
  const now = Date.now();
  const rows = [
    { order_id: id, channel: "crm_sync", status: "sent", updated_at: new Date(now).toISOString() },
    { order_id: id, channel: "supplier_email", status: "sent", updated_at: new Date(now).toISOString() },
    { order_id: id, channel: "customer_receipt", status: "failed", updated_at: new Date(now).toISOString() },
  ];
  const plan = Object.fromEntries(planReplay([id], rows, now).map((p) => [p.channel, p.action]));
  assertEquals(plan, { supplier_email: "already_sent", crm_sync: "already_sent", customer_receipt: "replay", customer_sms: "replay" });
});

Deno.test("draft sessions still obey the automatic cutover", () => {
  assertEquals(automaticFulfillmentAllowed(Date.parse("2026-09-01T00:00:00Z") / 1000, [], { at: "2026-09-30T04:24:33Z" }).ok, false);
  assertEquals(automaticFulfillmentAllowed(session().created, [], { at: "2026-09-30T04:24:33Z" }).ok, true);
});

Deno.test("receipts: historical paid rows visible, pending_payment hidden", () => {
  const rows = [
    { id: "paid-legacy", status: "pending" }, { id: "shipped", status: "shipped" },
    { id: "abandoned-1", status: "pending_payment" }, { id: "abandoned-2", status: "pending_payment" },
  ];
  assertEquals(receiptEligibleOrders(rows).map((r) => r.id), ["paid-legacy", "shipped"]);
  assertEquals(isReceiptEligible({ status: "pending_payment" }), false);
});

Deno.test("legacy receive-order: form-only payload fails closed", async () => {
  assertEquals(extractStripePaymentRef({ email: "a@b.c", order: { payment_gateway: "stripe", total_price: 200 } }), null);
  const r = await verifyLegacyPayment({ email: "a@b.c" }, "sk", () => { throw new Error("must not call Stripe"); });
  assertEquals(r, { ok: false, reason: "no_payment_reference" });
});

Deno.test("legacy receive-order: only a Stripe-confirmed succeeded payment passes", async () => {
  const body = { order: { payment_intent_id: "pi_123" } };
  const ok = (obj: any) => (() => Promise.resolve(new Response(JSON.stringify(obj), { status: 200 }))) as any;
  assertEquals((await verifyLegacyPayment(body, "sk", ok({ id: "pi_123", object: "payment_intent", status: "succeeded", amount_received: 20000 }))).ok, true);
  assertEquals((await verifyLegacyPayment(body, "sk", ok({ id: "pi_123", object: "payment_intent", status: "requires_payment_method", amount_received: 0 }))).ok, false);
  assertEquals((await verifyLegacyPayment(body, null)).ok, false);
  assertEquals(stripeObjectIsCompletedPayment({ kind: "charge", id: "ch_1" }, { id: "ch_1", object: "charge", paid: true, status: "succeeded", refunded: true }), false);
});
