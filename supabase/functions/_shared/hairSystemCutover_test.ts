import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { automaticFulfillmentAllowed, planReplay } from "./hairSystemFulfillmentLogic.ts";

const cut = { at: "2026-09-30T04:30:00Z", excluded_order_ids: [
  "4809a521-9d4b-43c8-8be5-e6814b2cd113", "c3aef2be-7b37-4575-b4f1-538c869f500d",
  "f2ca7052-7dfd-4db2-bd22-c2347ba4b2a7", "ab36e2e1-33f9-4236-b157-c2e1021b04f2",
  "fa6a29dc-62e3-49ad-9927-e1093ad59fd0", "536c2636-9117-40d7-9e4a-dc88af0fa304"] };
const after = Date.parse("2026-10-01T00:00:00Z") / 1000;

Deno.test("cutover: the four held orders and Nicole never auto-fulfill, even if a session looked new", () => {
  for (const id of cut.excluded_order_ids) {
    assertEquals(automaticFulfillmentAllowed(after, [id], cut), { ok: false, reason: "historical_order_excluded" });
  }
});
Deno.test("cutover: any pre-cutover checkout is refused (Stripe retry / old buyer return)", () => {
  assertEquals(automaticFulfillmentAllowed(Date.parse("2026-09-29T20:00:00Z") / 1000, ["00000000-0000-4000-8000-000000000001"], cut).ok, false);
});
Deno.test("cutover: new paid order after cutover fulfills normally", () => {
  assertEquals(automaticFulfillmentAllowed(after, ["00000000-0000-4000-8000-000000000002"], cut), { ok: true });
});
Deno.test("cutover: missing or broken config fails closed", () => {
  assertEquals(automaticFulfillmentAllowed(after, ["x"], null).ok, false);
  assertEquals(automaticFulfillmentAllowed(after, ["x"], { at: "nope" }).ok, false);
  assertEquals(automaticFulfillmentAllowed(undefined, ["x"], cut).ok, false);
});
Deno.test("duplicates: already-sent channels are never replayed", () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const now = Date.now();
  const rows = ["supplier_email", "crm_sync", "customer_receipt", "customer_sms"].map((channel) => ({ order_id: id, channel, status: "sent", updated_at: new Date(now).toISOString() }));
  const plan = planReplay([id], rows as any, now);
  assertEquals(plan.every((p: any) => p.action === "already_sent"), true);
});
