import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fulfillPaidSession } from "./hairSystemFulfillment.ts";
import { __setRelayFetch } from "./barberLaunchGhlRelay.ts";
import { DEFAULT_SUPPLIER_EMAIL } from "./hairSystemNotifications.ts";

const ORDER = "11111111-2222-4333-8444-555555555555";
const USER = "22222222-2222-4333-8444-555555555555";
const paidSession = {
  object: "checkout.session", id: "cs_test_fixture", payment_status: "paid",
  created: Date.parse("2026-10-18T00:00:00Z") / 1000,
  metadata: { order_ids: ORDER, user_id: USER },
  customer_details: { name: "Fixture Buyer", email: "fixture@example.invalid" },
  amount_total: 20000, currency: "usd", line_items: { data: [] },
};

// In-memory claim/audit stand-in only; never connects to the Academy database.
function fixture(opts: { hold?: boolean; holdError?: boolean; supplierClaimError?: boolean; cutover?: string } = {}) {
  const states = new Map<string, string>();
  const claims: string[] = [];
  const logs: Array<{ channel: string; status: string; reason?: string }> = [];
  const db: any = {
    from(table: string) {
      let key = "";
      let channel = "";
      let update: any;
      const chain: any = {
        select() { return chain; },
        eq(field: string, value: string) { if (field === "key") key = value; if (field === "channel") channel = value; return chain; },
        in() { return chain; },
        update(value: any) { update = value; return chain; },
        maybeSingle() { return chain; },
        then(resolve: any, reject: any) {
          let result: any = { data: null, error: null };
          if (table === "app_settings") {
            result = key === "hair_system_fulfillment_hold"
              ? { data: { value: opts.hold ?? false }, error: opts.holdError ? { message: "denied" } : null }
              : { data: { value: { at: opts.cutover ?? "2026-10-01T00:00:00Z" } }, error: null };
          } else if (table === "orders" && !update) {
            result.data = [{ id: ORDER, customer_email: "fixture@example.invalid", customer_name: "Fixture Buyer", order_details: {} }];
          } else if (table === "order_notifications" && update) {
            states.set(channel, update.status);
            logs.push({ channel, status: update.status, reason: update.reason });
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc(_name: string, params: any) {
      const channel = params._channel;
      claims.push(channel);
      if (channel === "supplier_email" && opts.supplierClaimError) return Promise.resolve({ data: null, error: { message: "claim denied" } });
      const previous = states.get(channel);
      if (previous === "sent") return Promise.resolve({ data: "duplicate", error: null });
      if (previous === "sending") return Promise.resolve({ data: "in_progress", error: null });
      states.set(channel, "sending");
      return Promise.resolve({ data: "claimed", error: null });
    },
  };
  return { db, states, claims, logs };
}

const run = (db: any, session: any = paidSession) => fulfillPaidSession(db, session, {
  eventId: "fixture-event", stripeSecret: "fixture-not-a-key", syncSavedCard: false, mode: "automatic", expectedUserId: USER,
});

async function withRelay(test: (calls: any[]) => Promise<void>, supplierFails = false, crmFails = true) {
  const oldKey = Deno.env.get("GHL_API_KEY");
  const calls: any[] = [];
  Deno.env.set("GHL_API_KEY", "fixture-not-a-key");
  __setRelayFetch(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    const failed = body.action === "upsert_order_contact" ? crmFails : supplierFails;
    return new Response(JSON.stringify(failed ? { ok: false, error: "fixture provider failure" } : { ok: true, messageId: "fixture-message", contactId: "fixture-contact" }), { status: failed ? 503 : 200 });
  });
  try { await test(calls); } finally {
    __setRelayFetch(() => { throw new Error("Unmocked network forbidden"); });
    if (oldKey === undefined) Deno.env.delete("GHL_API_KEY"); else Deno.env.set("GHL_API_KEY", oldKey);
  }
}

Deno.test("CRM failure still attempts fixed supplier once; retries do not resend a sent sheet or contact buyers", async () => {
  await withRelay(async (calls) => {
    const f = fixture();
    const first = await run(f.db);
    assertEquals(first.anyFailed, true); // CRM remains failed so event retry is retained.
    await run(f.db);
    const emails = calls.filter((c) => c.action === "send_email");
    assertEquals(emails.length, 1);
    assertEquals(emails[0].role, "supplier");
    assertEquals(emails[0].to, "sales30@newtimeshair.com");
    assertEquals(DEFAULT_SUPPLIER_EMAIL, "sales30@newtimeshair.com");
    assertEquals(f.logs.some((l) => l.channel === "supplier_email" && l.status === "sent"), true);
    assertEquals(f.claims.includes("customer_receipt"), false);
    assertEquals(f.claims.includes("customer_sms"), false);
  });
});

Deno.test("failed supplier audit remains retryable despite CRM failure", async () => {
  await withRelay(async (calls) => {
    const f = fixture();
    await run(f.db);
    await run(f.db);
    assertEquals(calls.filter((c) => c.role === "supplier").length, 2);
    assertEquals(f.logs.filter((l) => l.channel === "supplier_email").map((l) => l.status), ["failed", "failed"]);
  }, true);
});

Deno.test("supplier claim errors and active claims never call supplier relay", async () => {
  await withRelay(async (calls) => {
    const denied = fixture({ supplierClaimError: true });
    assertEquals((await run(denied.db)).anyFailed, true);
    const busy = fixture();
    busy.states.set("supplier_email", "sending");
    await run(busy.db);
    assertEquals(calls.filter((c) => c.role === "supplier").length, 0);
  });
});

Deno.test("unpaid, held, denied hold lookup and historical sessions never claim or send", async () => {
  await withRelay(async (calls) => {
    for (const opts of [{ hold: true }, { holdError: true }]) {
      const f = fixture(opts);
      await assertRejects(() => run(f.db));
      assertEquals(f.claims, []);
    }
    const unpaid = fixture();
    await assertRejects(() => run(unpaid.db, { ...paidSession, payment_status: "unpaid" }));
    assertEquals(unpaid.claims, []);
    const historical = fixture({ cutover: "2026-10-19T00:00:00Z" });
    assertEquals((await run(historical.db)).skipped, "session_before_cutover");
    assertEquals(historical.claims, []);
    assertEquals(calls, []);
  });
});

Deno.test("successful CRM preserves supplier then buyer receipt and SMS behavior", async () => {
  await withRelay(async (calls) => {
    const f = fixture();
    await run(f.db);
    assertEquals(calls.map((c) => c.action === "send_email" ? c.role : c.action), ["upsert_order_contact", "supplier", "buyer"]);
    assertEquals(f.states.get("customer_sms"), "skipped"); // No fixture phone; existing consent behavior.
    assertEquals(f.states.get("customer_receipt"), "sent");
  }, false, false);
});