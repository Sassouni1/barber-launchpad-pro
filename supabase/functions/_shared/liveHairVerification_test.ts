import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { liveVerificationCheckout, cancelLiveVerification, verificationDraft, verificationSessionForm, verificationReservationId, LIVE_VERIFICATION_CONFIRM } from "./liveHairVerification.ts";
import { buildSupplierEmailHtml, buildCustomerReceiptHtml, buildCustomerSmsBody, supplierSubject, SUPPLIER_SUBJECT } from "./hairSystemNotifications.ts";
const user = { id: "11111111-2222-4333-8444-555555555555", email: "chris@invasiondigitalmedia.com", email_confirmed_at: "2026-01-01" };
const origin = "https://member.thebarberlaunch.com";

function fixture(opts: Record<string, any> = {}) {
  const writes: any[] = []; let requests = 0;
  const db: any = {
    rpc: async () => ({ data: opts.admin ?? true, error: null }),
    from(table: string) {
      let key = ""; let write: any = null;
      const c: any = {
        select() { return c; }, eq(k: string, v: string) { if (k === "key") key = v; return c; }, contains() { return c; },
        insert(v: any) { write = v; writes.push([table, "insert", v]); return c; },
        update(v: any) { write = v; writes.push([table, "update", v]); return c; },
        maybeSingle() { return c; },
        then(resolve: any, reject: any) {
          return Promise.resolve(write ? { data: null, error: opts.reserveError && writes.length === 1 ? { message: "conflict" } : null }
            : table === "hair_system_checkout_drafts" ? { data: opts.drafts ?? [], error: opts.draftError ?? null }
            : table === "orders" ? { data: opts.orders ?? [], error: null }
            : { data: { value: key === "hair_system_fulfillment_hold" ? opts.hold ?? false : { at: "2026-01-01T00:00:00Z" } }, error: null }).then(resolve, reject);
        },
      }; return c;
    },
  };
  const deps: any = {
    stripeGet: async () => ({ id: opts.account ?? "acct_1LMNKMI6LFtj88Bq" }), loadExpandedSession: async () => { throw new Error("Not expected"); },
    fetch: async (_url: string, init: any) => {
      requests++;
      const form = new URLSearchParams(init.body);
      assertEquals(form.get("line_items[0][price_data][unit_amount]"), "100");
      assertEquals(form.get("metadata[save_card]"), "false");
      return new Response(JSON.stringify({ id: "cs_live_fixture", client_secret: "fixture-only", livemode: true, amount_total: 100, currency: "usd" }));
    },
  };
  const run = (body = {}, u = user, key = "sk_live_fixture") => liveVerificationCheckout(db, u, { confirm: LIVE_VERIFICATION_CONFIRM, ...body }, key, origin, deps);
  return { run, db, deps, writes, requests: () => requests };
}

Deno.test("live verification fixed identity/specifications ignore caller overrides; exactly 100 minor USD with no extras or saved card", () => {
  const d = verificationDraft(user);
  assertEquals(d.base_details.phone, "7276374672");
  assertEquals(d.base_details.shipping, { method: "TEST ONLY — DO NOT SHIP", address_1: "2259 St. Charles Dr.", address_2: "", city: "Clearwater", state: "FL", zip: "33764" });
  assertEquals(d.systems[0]["Choose Color"], "1B"); assertEquals(d.systems[0]["Lace or Skin"], "Lace");
  assertEquals(d.systems[0]["Choose Density"], "100% Standard"); assertEquals(d.save_card, false);
  const f = verificationSessionForm(user, "fixture-draft", origin);
  assertEquals(f.get("line_items[0][price_data][unit_amount]"), "100"); assertEquals(f.get("line_items[0][price_data][currency]"), "usd");
  assertEquals(f.has("line_items[1][quantity]"), false); assertEquals(f.has("payment_intent_data[setup_future_usage]"), false);
  assertEquals(f.get("automatic_tax[enabled]"), "false"); assertEquals(f.get("allow_promotion_codes"), "false");
});
Deno.test("live verification rejects all other identities, unverified email, nonadmin, wrong confirmation, test key and wrong seller", async () => {
  const cases: any[] = [ [{}, { ...user, email: "other@example.invalid" }], [{}, { ...user, email_confirmed_at: undefined }], [{ confirm: "wrong" }], [{}, user, "sk_test_fixture"] ];
  for (const [body, u, key] of cases) { const f = fixture(); await assertRejects(() => f.run(body, u, key)); assertEquals(f.requests(), 0); assertEquals(f.writes, []); }
  for (const opts of [{ admin: false }, { account: "wrong" }]) { const f = fixture(opts); await assertRejects(() => f.run()); assertEquals(f.writes, []); }
});
Deno.test("live verification paid, reserved, unknown prior state, active hold and atomic reservation conflicts fail closed", async () => {
  for (const opts of [{ drafts: [{ status: "paid" }] }, { drafts: [{ status: "open" }] }, { orders: [{ id: "already-paid" }] }, { draftError: { message: "denied" } }, { hold: true }, { hold: "false" }, { reserveError: true }]) {
    const f = fixture(opts); await assertRejects(() => f.run()); assertEquals(f.requests(), 0);
  }
  assertEquals(await verificationReservationId(user.id), await verificationReservationId(user.id));
});
Deno.test("live verification creates only one isolated marked production draft/session using fixed details and per-reservation idempotency", async () => {
  const f = fixture();
  const result = await f.run({ amount: 999999, phone: "bad", saveCardForFutureOrders: true, systems: [] });
  assertEquals(result.total_minor, 100); assertEquals(f.requests(), 1);
  assertEquals(f.writes[0][0], "hair_system_checkout_drafts");
  assertEquals(f.writes[0][2].base_details.live_verification_test, true);
  assertEquals(f.writes[0][2].base_details.phone, "7276374672");
  assertEquals(f.writes[0][2].save_card, false);
  assertEquals(f.writes.map((w) => w[0]), ["hair_system_checkout_drafts", "hair_system_checkout_drafts"]);
});
Deno.test("verification notifications warn no production/shipping; supplier has no payment data, customer uses actual paid amount, normal messages unchanged", () => {
  const d = verificationDraft(user);
  const order = { id: "fixture-order", customer_email: user.email, customer_name: "Chris Sassouni", order_details: { ...d.base_details, ...d.systems[0] } };
  const buyer = { name: "Chris Sassouni", email: user.email, phone: "", address: [] };
  const supplier = buildSupplierEmailHtml(order, buyer);
  assertEquals(supplier.includes("TEST ONLY — DO NOT PRODUCE OR SHIP"), true);
  assertEquals(/\$1|Total paid|fixture-card|cs_live/.test(supplier), false);
  assertEquals(supplierSubject(order).startsWith("TEST ONLY — DO NOT PRODUCE OR SHIP"), true);
  const receipt = buildCustomerReceiptHtml([order], buyer, { orderReference: "fixture", purchasedAt: new Date(), currency: "usd", amountPaid: 100, lineItems: [{ name: "Verification", quantity: 1, amount: 100 }], cardBrand: "", cardLast4: "" });
  assertEquals(receipt.includes("$1.00"), true); assertEquals(receipt.includes("No product will be produced or shipped"), true);
  assertEquals(buildCustomerSmsBody(order, buyer, 1).includes("no product will be produced or shipped"), true);
  const normal = { ...order, order_details: { ...order.order_details, live_verification_test: false } };
  assertEquals(supplierSubject(normal), SUPPLIER_SUBJECT);
  assertEquals(buildSupplierEmailHtml(normal, buyer).includes("TEST ONLY — DO NOT PRODUCE OR SHIP"), false);
  assertEquals(buildCustomerSmsBody(normal, buyer, 1), "Chris, thanks for your order with Barber Launch. Your hair system is confirmed and going into production. We'll be in touch with shipping updates. Reply STOP to opt out.");
});
Deno.test("live verification cancellation refuses paid draft without Stripe mutation", async () => {
  const f = fixture({ drafts: { id: "fixture", status: "paid", base_details: { live_verification_test: true }, stripe_checkout_session_id: "cs_live_fixture" } });
  await assertRejects(() => cancelLiveVerification(f.db, user, { confirm: "CANCEL_UNPAID_LIVE_TEST" }, "sk_live_fixture", f.deps));
  assertEquals(f.requests(), 0); assertEquals(f.writes, []);
});