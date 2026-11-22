import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertCardOwned, attachBillingAfterPayment, domainCheckoutForm, eligibleSavedCards, parsePaymentChoice,
  processPaidDomainSession, resolveMemberStripeCustomer, toCardViews,
  type CardView, type DomainOrder, type LinkStatus, type ResolveDeps, type WebhookDeps,
} from "./memberDomainBilling.ts";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ORDER_ID = "33333333-3333-3333-3333-333333333333";
// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

function stripeFixture(objects: Record<string, Obj | Error>) {
  const calls: string[] = [];
  return {
    calls,
    get: async (path: string) => {
      calls.push(path);
      const hit = objects[path];
      if (hit instanceof Error) throw hit;
      return hit ?? null;
    },
  };
}

const paidSession = (id: string, customer: string | null) => ({ id, livemode: true, payment_status: "paid", customer });
const liveCustomer = (id: string, owner?: string) => ({ id, livemode: true, metadata: owner ? { barber_launch_member_id: owner } : {} });
const noHistory = (cus: string) => ({
  [`charges?customer=${cus}&limit=100`]: { data: [{ id: "ch_mine", payment_intent: "pi_mine" }], has_more: false },
  [`checkout/sessions?customer=${cus}&limit=100`]: { data: [{ id: "cs_live_mine" }], has_more: false },
});

function resolveDeps(over: Partial<ResolveDeps> & { stripe: ReturnType<typeof stripeFixture> }) {
  const links: Array<[string, string, string]> = [];
  const deps: ResolveDeps = {
    loadProfile: async () => null,
    listClaims: async () => [],
    listGrants: async () => [],
    refsOwnedByOthers: async () => false,
    linkCustomer: async (u, c, s) => { links.push([u, c, s]); return "linked"; },
    ...over,
    stripeGet: over.stripe.get,
  };
  return { deps, links };
}

Deno.test("an existing server link wins and no payment evidence is searched", async () => {
  const stripe = stripeFixture({ "customers/cus_LINKED": liveCustomer("cus_LINKED") });
  const { deps, links } = resolveDeps({
    stripe, loadProfile: async () => ({ stripe_customer_id: "cus_LINKED", default_payment_method_id: "pm_1" }),
    listGrants: async () => { throw new Error("must not read grants"); },
  });
  const result = await resolveMemberStripeCustomer(deps, ME);
  assertEquals(result, { status: "resolved", customerId: "cus_LINKED", source: "existing_link", defaultPaymentMethodId: "pm_1" });
  assertEquals(links, [[ME, "cus_LINKED", "existing_link"]]);
});

Deno.test("an older Customer link shared with another member never exposes cards", async () => {
  const stripe = stripeFixture({ "customers/cus_SHARED": liveCustomer("cus_SHARED") });
  const { deps } = resolveDeps({
    stripe, loadProfile: async () => ({ stripe_customer_id: "cus_SHARED", default_payment_method_id: "pm_1" }),
    linkCustomer: async () => "customer_owned_by_other",
  });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "owned_by_other" });
  assertEquals(stripe.calls.length, 0);
});

Deno.test("a verified checkout claim traces to its Customer and is linked once", async () => {
  const stripe = stripeFixture({
    "payment_intents/pi_claim": { id: "pi_claim", livemode: true, status: "succeeded", customer: "cus_A" },
    "customers/cus_A": liveCustomer("cus_A"), ...noHistory("cus_A"),
  });
  const { deps, links } = resolveDeps({ stripe, listClaims: async () => [{ checkout_session_id: "cs_live_x", payment_intent_id: "pi_claim", charge_id: null }] });
  const result = await resolveMemberStripeCustomer(deps, ME);
  assertEquals(result.status, "resolved");
  assertEquals(links, [[ME, "cus_A", "checkout_claim"]]);
});

Deno.test("ambiguous linkage: grants tracing to two Customers stay unresolved and nothing is linked", async () => {
  const stripe = stripeFixture({
    "checkout/sessions/cs_live_one": paidSession("cs_live_one", "cus_A"),
    "charges/ch_two": { id: "ch_two", livemode: true, paid: true, status: "succeeded", customer: "cus_B" },
  });
  const { deps, links } = resolveDeps({ stripe, listGrants: async () => [
    { source: "stripe_checkout", evidence_ref: "cs_live_one" }, { source: "stripe_charge", evidence_ref: "ch_two" },
  ] });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "ambiguous" });
  assertEquals(links.length, 0);
});

Deno.test("cross-member: a Customer whose payments back another member's grant is never linked", async () => {
  const stripe = stripeFixture({
    "checkout/sessions/cs_live_one": paidSession("cs_live_one", "cus_A"), "customers/cus_A": liveCustomer("cus_A"), ...noHistory("cus_A"),
  });
  let askedRefs: string[] = [];
  const { deps, links } = resolveDeps({
    stripe, listGrants: async () => [{ source: "hair_system_order", evidence_ref: "cs_live_one" }],
    refsOwnedByOthers: async (_u, refs) => { askedRefs = refs; return true; },
  });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "owned_by_other" });
  assert(askedRefs.includes("ch_mine") && askedRefs.includes("pi_mine") && askedRefs.includes("cs_live_mine"));
  assertEquals(links.length, 0);
});

Deno.test("cross-member: Customer metadata naming another member blocks the link", async () => {
  const stripe = stripeFixture({ "checkout/sessions/cs_live_one": paidSession("cs_live_one", "cus_A"), "customers/cus_A": liveCustomer("cus_A", OTHER) });
  const { deps, links } = resolveDeps({ stripe, listGrants: async () => [{ source: "stripe_checkout", evidence_ref: "cs_live_one" }] });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "owned_by_other" });
  assertEquals(links.length, 0);
});

Deno.test("a concurrent link of the same Customer by another member leaves this member unresolved", async () => {
  const stripe = stripeFixture({ "checkout/sessions/cs_live_one": paidSession("cs_live_one", "cus_A"), "customers/cus_A": liveCustomer("cus_A"), ...noHistory("cus_A") });
  const { deps } = resolveDeps({ stripe, listGrants: async () => [{ source: "stripe_checkout", evidence_ref: "cs_live_one" }],
    linkCustomer: async (): Promise<LinkStatus> => "customer_owned_by_other" });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "owned_by_other" });
});

Deno.test("a failed Stripe read fails closed instead of deciding on partial evidence", async () => {
  const stripe = stripeFixture({ "checkout/sessions/cs_live_one": paidSession("cs_live_one", "cus_A"), "charges/ch_two": new Error("Stripe read failed: 500") });
  const { deps, links } = resolveDeps({ stripe, listGrants: async () => [
    { source: "stripe_checkout", evidence_ref: "cs_live_one" }, { source: "stripe_charge", evidence_ref: "ch_two" },
  ] });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "lookup_failed" });
  assertEquals(links.length, 0);
});

Deno.test("unpaid, refunded-to-test or test-mode objects are not evidence", async () => {
  const stripe = stripeFixture({ "checkout/sessions/cs_live_one": { id: "cs_live_one", livemode: true, payment_status: "unpaid", customer: "cus_A" } });
  const { deps } = resolveDeps({ stripe, listGrants: async () => [{ source: "stripe_checkout", evidence_ref: "cs_live_one" }, { source: "admin_grant", evidence_ref: "x" }] });
  assertEquals(await resolveMemberStripeCustomer(deps, ME), { status: "unresolved", reason: "no_evidence" });
});

const NOW = new Date("2026-11-22T07:00:00Z");
const pm = (id: string, customer: string, exp: [number, number], redisplay?: string) =>
  ({ id, type: "card", customer, allow_redisplay: redisplay, card: { brand: "visa", last4: "4242", exp_month: exp[0], exp_year: exp[1], number: "4242424242424242", cvc: "123" } });

Deno.test("cards are masked, scoped to the Customer, and expired cards are not eligible", () => {
  const views = toCardViews([pm("pm_ok", "cus_A", [12, 2027]), pm("pm_old", "cus_A", [10, 2026]), pm("pm_nov", "cus_A", [11, 2026]), pm("pm_theirs", "cus_B", [12, 2030])], "cus_A", "pm_ok", NOW);
  assertEquals(views.map(v => v.id), ["pm_ok", "pm_old", "pm_nov"]);
  assertEquals(Object.keys(views[0]).sort(), ["brand", "expMonth", "expYear", "expired", "id", "isDefault", "last4", "redisplay"]);
  assertEquals(eligibleSavedCards(views).map(v => v.id), ["pm_ok", "pm_nov"]);
  assertEquals(views[0].redisplay, "unspecified");
});

Deno.test("cross-member: a card attached to someone else's Customer cannot be used or removed", () => {
  assertEquals(assertCardOwned(pm("pm_x", "cus_B", [1, 2030]), "cus_A"), false);
  assertEquals(assertCardOwned(pm("pm_x", "cus_A", [1, 2030]), null), false);
  assertEquals(assertCardOwned(pm("pm_x", "cus_A", [1, 2030]), "cus_A"), true);
});

const card = (over: Partial<CardView> = {}): CardView => ({ id: "pm_ok", brand: "visa", last4: "4242", expMonth: 12, expYear: 2027, expired: false, isDefault: false, redisplay: "unspecified", ...over });
const resolved = { status: "resolved" as const, customerId: "cus_A", source: "existing_link", defaultPaymentMethodId: null };
const base = { orderId: ORDER_ID, userId: ME, domain: "shop.com", amountCents: 1077, email: "me@example.com", memberSite: "https://member.thebarberlaunch.com" };

Deno.test("saved card: linked Customer, no customer_email, and only the chosen card's consent category is shown", () => {
  const plan = domainCheckoutForm({ ...base, resolution: resolved, choice: { method: "saved", paymentMethodId: "pm_ok" }, eligibleCards: [card()] });
  assert(plan.ok);
  const form = plan.form;
  assertEquals(form.get("customer"), "cus_A");
  assertEquals(form.get("customer_email"), null);
  assertEquals(form.get("saved_payment_method_options[allow_redisplay_filters][0]"), "unspecified");
  assertEquals(form.get("line_items[0][price_data][unit_amount]"), "1077");
  assertEquals(form.get("payment_intent_data[setup_future_usage]"), null);
  assertEquals(form.get("metadata[order_id]"), ORDER_ID);
  assertEquals(form.get("payment_intent_data[metadata][user_id]"), ME);
  assertEquals(form.get("ui_mode"), "embedded");
  assertEquals(form.get("return_url"), `https://member.thebarberlaunch.com/my-website?domain_order=${ORDER_ID}&session_id={CHECKOUT_SESSION_ID}`);
  assertEquals(form.get("success_url"), null);
  assertEquals(form.get("cancel_url"), null);
});

Deno.test("embedded checkout returns to the same website builder route for admin review", () => {
  const plan = domainCheckoutForm({ ...base, secondMode: true, resolution: resolved, choice: { method: "new", saveCard: false }, eligibleCards: [] });
  assert(plan.ok);
  assertEquals(plan.form.get("return_url"), `https://member.thebarberlaunch.com/my-website?domain_order=${ORDER_ID}&second=1&session_id={CHECKOUT_SESSION_ID}`);
});

Deno.test("saved-card fallback: an ineligible, foreign or unresolved card is refused so the member uses a new card", () => {
  const foreign = domainCheckoutForm({ ...base, resolution: resolved, choice: { method: "saved", paymentMethodId: "pm_theirs" }, eligibleCards: [card()] });
  assertEquals(foreign.ok, false);
  const unresolved = domainCheckoutForm({ ...base, resolution: { status: "unresolved", reason: "ambiguous" }, choice: { method: "saved", paymentMethodId: "pm_ok" }, eligibleCards: [card()] });
  assertEquals(unresolved.ok, false);
});

Deno.test("new card: unresolved members get a fresh Customer at checkout; saving needs explicit opt-in", () => {
  const plain = domainCheckoutForm({ ...base, resolution: { status: "unresolved", reason: "ambiguous" }, choice: { method: "new", saveCard: false }, eligibleCards: [] });
  assert(plain.ok);
  assertEquals(plain.form.get("customer"), null);
  assertEquals(plain.form.get("customer_creation"), "always");
  assertEquals(plain.form.get("customer_email"), "me@example.com");
  assertEquals(plain.form.get("payment_intent_data[setup_future_usage]"), null);
  assertEquals(plain.form.get("saved_payment_method_options[allow_redisplay_filters][0]"), null);
  const saved = domainCheckoutForm({ ...base, resolution: resolved, choice: { method: "new", saveCard: true }, eligibleCards: [] });
  assert(saved.ok);
  assertEquals(saved.form.get("customer"), "cus_A");
  assertEquals(saved.form.get("payment_intent_data[setup_future_usage]"), "on_session");
  assertEquals(saved.form.get("metadata[save_card]"), "true");
});

Deno.test("payment choice parsing never implies saving or a saved card", () => {
  assertEquals(parsePaymentChoice(undefined), { method: "new", saveCard: false });
  assertEquals(parsePaymentChoice({ method: "new", saveCard: "yes" }), { method: "new", saveCard: false });
  assertEquals(parsePaymentChoice({ method: "saved", paymentMethodId: "card_123" }), null);
  assertEquals(parsePaymentChoice({ method: "auto" }), null);
});

// ---- Paid event processing -------------------------------------------------

function webhookWorld(over: { order?: Partial<DomainOrder>; session?: Obj; intent?: Obj; check?: Obj; registration?: { ok: boolean; status: number; data: Obj }; websiteFree?: boolean } = {}) {
  const order: DomainOrder = { id: ORDER_ID, user_id: ME, domain: "shop.com", status: "checkout_open", member_charge_cents: 1077, cloudflare_cost_cents: 1077, stripe_session_id: "cs_live_S", ...over.order };
  const session = { id: "cs_live_S", livemode: true, mode: "payment", status: "complete", payment_status: "paid", currency: "usd", amount_total: 1077,
    customer: "cus_A", payment_intent: "pi_S",
    metadata: { source: "barber_launch_member_domain", order_id: ORDER_ID, user_id: ME, domain: "shop.com", customer_link: "existing", stripe_customer: "cus_A", save_card: "true" },
    ...over.session };
  const intent = { id: "pi_S", livemode: true, status: "succeeded", customer: "cus_A", amount_received: 1077,
    metadata: { order_id: ORDER_ID, user_id: ME }, payment_method: { id: "pm_new", type: "card", customer: "cus_A" }, ...over.intent };
  const state = { order: { ...order } as DomainOrder & Obj, registrations: 0, registrationBodies: [] as string[], assigned: [] as string[], links: [] as Array<[string, string, string | null | undefined]>, redisplay: [] as string[], patches: [] as Obj[] };
  const deps: WebhookDeps = {
    stripeGet: async path => path.startsWith("checkout/sessions/") ? session : path.startsWith("payment_intents/") ? intent : null,
    stripePost: async (path, form) => { state.redisplay.push(`${path}:${form.get("allow_redisplay")}`); return {}; },
    registrar: { accountId: "acc", token: "tok" },
    cloudflare: async (path, init) => {
      if (path.endsWith("/domain-check")) return { ok: true, status: 200, data: over.check ?? { result: { domains: [{ registrable: true, pricing: { registration_cost: "10.77", currency: "USD" } }] } } };
      state.registrations++;
      state.registrationBodies.push(String(init?.body ?? ""));
      return over.registration ?? { ok: true, status: 200, data: { result: { state: "succeeded" } } };
    },
    loadOrder: async () => ({ ...state.order }),
    claimOrder: async () => {
      // Mirrors the conditional UPDATE … WHERE status IN (checkout_open, checkout_pending).
      if (!["checkout_open", "checkout_pending"].includes(state.order.status)) return false;
      state.order.status = "registering";
      return true;
    },
    updateOrder: async (_id, patch) => { state.patches.push(patch); Object.assign(state.order, patch); },
    assignWebsite: async (_u, domain) => { if (over.websiteFree === false) return false; state.assigned.push(domain); return true; },
    linkCustomer: async (u, c, _s, p) => { state.links.push([u, c, p]); return "already_linked"; },
    log: () => {},
  };
  return { deps, state };
}

Deno.test("a fully matching paid event registers once with auto-renew off and attaches the opted-in card", async () => {
  const { deps, state } = webhookWorld();
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "registered");
  assertEquals(state.registrations, 1);
  assertEquals(JSON.parse(state.registrationBodies[0]), { domain_name: "shop.com", auto_renew: false });
  assertEquals(state.assigned, ["shop.com"]);
  assertEquals(state.redisplay, ["payment_methods/pm_new:always"]);
  assertEquals(state.links.at(-1), [ME, "cus_A", "pm_new"]);
});

Deno.test("duplicate events: concurrent and repeated deliveries register the domain only once", async () => {
  const { deps, state } = webhookWorld();
  const results = await Promise.all([processPaidDomainSession(deps, "cs_live_S"), processPaidDomainSession(deps, "cs_live_S")]);
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "duplicate");
  assertEquals(results.filter(r => r === "registered").length, 1);
  assertEquals(state.registrations, 1);
});

Deno.test("stale price: a higher Cloudflare price after payment stops before registration", async () => {
  const { deps, state } = webhookWorld({ check: { result: { domains: [{ registrable: true, pricing: { registration_cost: "12.00", currency: "USD" } }] } } });
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "action_required");
  assertEquals(state.registrations, 0);
  assertEquals(state.assigned.length, 0);
});

Deno.test("missing price data is treated as changed, never as cheaper", async () => {
  const { deps, state } = webhookWorld({ check: { result: { domains: [{ registrable: true, pricing: { currency: "USD" } }] } } });
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "action_required");
  assertEquals(state.registrations, 0);
});

Deno.test("failed registration is flagged for review, not retried, and the website is untouched", async () => {
  const { deps, state } = webhookWorld({ registration: { ok: false, status: 500, data: {} } });
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "action_required");
  assertEquals(state.order.last_error, "Registration needs review (500)");
  assertEquals(state.assigned.length, 0);
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "duplicate");
  assertEquals(state.registrations, 1);
});

Deno.test("cross-member: a session paid for another member's order is rejected before any claim", async () => {
  const { deps, state } = webhookWorld({ session: { metadata: { source: "barber_launch_member_domain", order_id: ORDER_ID, user_id: OTHER, domain: "shop.com" } } });
  await assertRejects(() => processPaidDomainSession(deps, "cs_live_S"));
  assertEquals(state.order.status, "checkout_open");
  assertEquals(state.registrations, 0);
});

Deno.test("an amount or domain mismatch is rejected before any claim", async () => {
  for (const session of [{ amount_total: 999 }, { metadata: { source: "barber_launch_member_domain", order_id: ORDER_ID, user_id: ME, domain: "other.com" } }]) {
    const { deps, state } = webhookWorld({ session });
    await assertRejects(() => processPaidDomainSession(deps, "cs_live_S"));
    assertEquals(state.order.status, "checkout_open");
  }
});

Deno.test("billing attach refuses a payment whose Customer differs from the linked one", async () => {
  const links: string[] = [];
  const deps = { stripeGet: async () => ({ livemode: true, status: "succeeded", customer: "cus_OTHER", amount_received: 1077, metadata: { order_id: ORDER_ID, user_id: ME } }),
    stripePost: async () => ({}), linkCustomer: async (_u: string, c: string) => { links.push(c); return "linked" as LinkStatus; } };
  const order = { id: ORDER_ID, user_id: ME, domain: "shop.com", status: "registering", member_charge_cents: 1077, cloudflare_cost_cents: 1077, stripe_session_id: "cs_live_S" };
  assertEquals(await attachBillingAfterPayment(deps, { customer: "cus_A", payment_intent: "pi_S", metadata: { customer_link: "new", save_card: "true" } }, order), "mismatch");
  assertEquals(await attachBillingAfterPayment(deps, { customer: "cus_B", payment_intent: "pi_S", metadata: { customer_link: "existing", stripe_customer: "cus_A" } }, order), "mismatch");
  assertEquals(links.length, 0);
});

Deno.test("without explicit opt-in the paid card is not marked for redisplay", async () => {
  const { deps, state } = webhookWorld({ session: { metadata: { source: "barber_launch_member_domain", order_id: ORDER_ID, user_id: ME, domain: "shop.com", customer_link: "new", save_card: "false" } } });
  assertEquals(await processPaidDomainSession(deps, "cs_live_S"), "registered");
  assertEquals(state.redisplay.length, 0);
  assertEquals(state.links, [[ME, "cus_A", undefined]]);
});
