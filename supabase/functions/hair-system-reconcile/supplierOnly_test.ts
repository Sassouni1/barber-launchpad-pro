import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { supplierOnlyRecovery } from "./supplierOnly.ts";

const ORDER = "11111111-2222-4333-8444-555555555555";
const USER = "22222222-2222-4333-8444-555555555555";
const SESSION = "cs_live_fixture";
function fixture(overrides: Record<string, any> = {}) {
  const reads: string[] = [];
  const sends: any[] = [];
  let probes = 0;
  const order = { id: ORDER, user_id: USER, stripe_checkout_session_id: SESSION, order_details: {}, ...overrides.order };
  const session = { object: "checkout.session", id: SESSION, livemode: true, payment_status: "paid", metadata: { order_ids: ORDER, user_id: USER }, customer_details: { name: "Paid Buyer", email: "paid@example.invalid" }, amount_total: 21000, currency: "usd", ...overrides.session };
  const db: any = {
    rpc() { throw new Error("Unexpected RPC/write"); },
    from(table: string) {
      reads.push(table);
      const chain: any = {
        select() { return chain; }, eq() { return chain; },
        update() { throw new Error("Unexpected write"); }, insert() { throw new Error("Unexpected write"); },
        maybeSingle: async () => table === "orders" ? { data: overrides.missingOrder ? null : order, error: overrides.orderError ?? null }
          : table === "app_settings" ? { data: { value: overrides.hold ?? false }, error: overrides.holdError ?? null }
          : { data: overrides.notification ?? null, error: overrides.notificationError ?? null },
      };
      return chain;
    },
  };
  const deps: any = {
    stripeGet: async () => ({ id: overrides.account ?? "acct_1LMNKMI6LFtj88Bq" }),
    loadExpandedSession: async () => session,
    attachExistingOrderIds: async (_db: any, s: any) => s,
    relayProbe: async () => { probes++; return overrides.relay ?? { ready: true, locationId: "JVBUuL3dVwZahuGay9T1" }; },
    dispatchSupplierOrderNotifications: async (_db: any, input: any) => { sends.push(input); return [{ channel: "supplier_email", result: "sent" }]; },
  };
  const run = (body: Record<string, unknown> = {}, key = "sk_live_fixture") => supplierOnlyRecovery(db, key, { action: "execute_supplier_only", order_id: ORDER, confirm: "EXECUTE_SUPPLIER_ONLY", ...body }, USER, async () => SESSION, deps);
  return { run, reads, sends, probes: () => probes };
}

Deno.test("supplier-only dry run is read-only and plans only supplier email", async () => {
  const f = fixture({ notification: { status: "failed" } });
  const r = await f.run({ action: "supplier_only_dry_run", confirm: undefined });
  assertEquals(r.status, 200);
  assertEquals((r.body.plan as any).channel, "supplier_email");
  assertEquals((r.body.plan as any).recipient, "sales30@newtimeshair.com");
  assertEquals((r.body.plan as any).action, "send_supplier_email");
  assertEquals(f.sends, []);
  assertEquals(f.probes(), 0);
  assertEquals(f.reads, ["orders", "order_notifications"]);
});

Deno.test("supplier-only recovery requires exactly one UUID and exact confirmation", async () => {
  for (const body of [{ order_id: "" }, { order_id: "invalid" }, { order_id: undefined, order_ids: [ORDER, ORDER] }, { order_ids: [ORDER] }, { confirm: "EXECUTE" }]) {
    const f = fixture();
    assertEquals((await f.run(body)).status, 400);
    assertEquals(f.sends, []);
    assertEquals(f.reads, []);
  }
});

Deno.test("supplier-only rejects test keys and wrong seller", async () => {
  for (const key of ["sk_test_fixture", "rk_test_fixture", "unknown"]) {
    const f = fixture();
    assertEquals((await f.run({}, key)).status, 409);
    assertEquals(f.reads, []);
  }
  const f = fixture({ account: "acct_wrong" });
  assertEquals((await f.run()).status, 409);
  assertEquals(f.sends, []);
});

Deno.test("supplier-only paid, live, owner, order and single-system checks fail closed", async () => {
  const invalid = [
    { session: { payment_status: "unpaid" } }, { session: { livemode: false } },
    { session: { id: "cs_live_wrong" } },
    { session: { metadata: { user_id: ORDER, order_ids: ORDER } } },
    { session: { metadata: { user_id: USER, order_ids: USER } } },
    { session: { metadata: { user_id: USER, order_ids: `${ORDER},${USER}` } } },
    { order: { user_id: null } }, { orderError: { message: "denied" } }, { missingOrder: true },
    { notificationError: { message: "denied" } },
  ];
  for (const opts of invalid) {
    for (const action of ["execute_supplier_only", "supplier_only_dry_run"]) {
      const f = fixture(opts);
      assertEquals((await f.run({ action })).status, 409);
      assertEquals(f.sends, []);
    }
  }
});

Deno.test("supplier-only execution rejects held/unavailable hold and unapproved relay", async () => {
  for (const opts of [{ hold: true }, { hold: "false" }, { holdError: { message: "denied" } }, { relay: { ready: false } }, { relay: { ready: true, locationId: "wrong" } }]) {
    const f = fixture(opts);
    assertEquals((await f.run()).status, 409);
    assertEquals(f.sends, []);
  }
});

Deno.test("supplier-only sent is duplicate and busy/skipped/unknown rows cannot execute", async () => {
  const sent = fixture({ notification: { status: "sent" } });
  assertEquals((await sent.run()).body.outcomes, [{ channel: "supplier_email", result: "duplicate" }]);
  assertEquals(sent.sends, []);
  for (const status of ["sending", "skipped", "unknown"]) {
    const f = fixture({ notification: { status } });
    assertEquals((await f.run()).status, 409);
    assertEquals(f.sends, []);
  }
});

Deno.test("supplier-only missing or failed row dispatches one order with paid-session buyer only", async () => {
  for (const notification of [null, { status: "failed" }]) {
    const f = fixture({ notification });
    assertEquals((await f.run()).status, 200);
    assertEquals(f.sends.length, 1);
    assertEquals(f.sends[0].orders.map((o: any) => o.id), [ORDER]);
    assertEquals(f.sends[0].buyer.email, "paid@example.invalid");
    assertEquals(f.reads, ["orders", "order_notifications", "app_settings"]);
  }
});