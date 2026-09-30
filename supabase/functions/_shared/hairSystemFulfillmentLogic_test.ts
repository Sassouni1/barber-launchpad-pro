import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { planReplay, verifyPaidSession, webhookCoverage } from "./hairSystemFulfillmentLogic.ts";

const paid = { object: "checkout.session", payment_status: "paid", metadata: { order_ids: "o1,o2", user_id: "u1" } };
const URL_ = "https://x.supabase.co/functions/v1/hair-system-stripe-webhook";

Deno.test("paid verification: paid session with matching order passes", () => {
  assertEquals(verifyPaidSession(paid, { requireOrderId: "o2", expectedUserId: "u1" }), { ok: true, orderIds: ["o1", "o2"] });
});
Deno.test("paid verification: unpaid, wrong order, wrong user, no metadata all rejected", () => {
  assertEquals(verifyPaidSession({ ...paid, payment_status: "unpaid" }).ok, false);
  assertEquals(verifyPaidSession(paid, { requireOrderId: "o9" }).ok, false);
  assertEquals(verifyPaidSession(paid, { expectedUserId: "u2" }).ok, false);
  assertEquals(verifyPaidSession({ ...paid, metadata: {} }).ok, false);
  assertEquals(verifyPaidSession({ ...paid, object: "payment_intent" }).ok, false);
});

Deno.test("duplicate suppression: sent channels never replay; supplier per order, others once", () => {
  const plan = planReplay(["o1", "o2"], [
    { order_id: "o1", channel: "supplier_email", status: "sent" },
    { order_id: "o1", channel: "customer_receipt", status: "sent" },
  ]);
  assertEquals(plan.length, 5);
  assertEquals(plan.filter((p) => p.action === "already_sent").length, 2);
  assertEquals(plan.find((p) => p.orderId === "o2" && p.channel === "customer_receipt"), undefined);
});

Deno.test("retry: failed (e.g. disconnected OAuth) and missing channels replay; fresh sending waits", () => {
  const now = Date.now();
  const plan = planReplay(["o1"], [
    { order_id: "o1", channel: "crm_sync", status: "failed" },
    { order_id: "o1", channel: "customer_sms", status: "sending", updated_at: new Date(now - 60_000).toISOString() },
    { order_id: "o1", channel: "supplier_email", status: "sending", updated_at: new Date(now - 11 * 60_000).toISOString() },
  ], now);
  const by = Object.fromEntries(plan.map((p) => [p.channel, p.action]));
  assertEquals(by, { supplier_email: "replay", crm_sync: "replay", customer_receipt: "replay", customer_sms: "in_progress" });
});

Deno.test("absent webhook endpoint is reported", () => {
  assertEquals(webhookCoverage([], URL_).configured, false);
  assertEquals(webhookCoverage([{ id: "we1", url: "https://other", status: "enabled", enabled_events: ["*"] }], URL_).reason, "no_endpoint_for_url");
  const partial = webhookCoverage([{ id: "we1", url: URL_, status: "enabled", enabled_events: ["checkout.session.completed"] }], URL_);
  assertEquals(partial.missingEvents, ["checkout.session.async_payment_succeeded"]);
  assertEquals(webhookCoverage([{ id: "we1", url: URL_, status: "disabled", enabled_events: ["*"] }], URL_).reason, "endpoint_disabled");
  assertEquals(webhookCoverage([{ id: "we1", url: URL_ + "/", status: "enabled", enabled_events: ["checkout.session.completed", "checkout.session.async_payment_succeeded"] }], URL_).configured, true);
});
