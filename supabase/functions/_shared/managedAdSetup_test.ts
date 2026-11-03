import { assertEquals } from "jsr:@std/assert@1";
import { buildSetupSessionBody, handleAdCardSetupSession, type SetupDeps } from "./managedAdSetup.ts";

const member = "11111111-1111-4111-8111-111111111111";
const session = {
  id: "cs_1", mode: "setup", status: "complete", customer: "cus_A", setup_intent: "seti_1",
  metadata: { purpose: "ad_card_setup", customer_id: member },
};

function deps(profile: { stripe_customer_id: string | null; default_payment_method_id: string | null } | null, intent: Record<string, unknown>) {
  const saves: string[] = [];
  const d: SetupDeps = {
    retrieveSetupIntent: async () => intent,
    loadBillingProfile: async () => profile,
    saveDefaultPaymentMethod: async (_m, _c, pm) => { saves.push(pm); profile && (profile.default_payment_method_id = pm); },
  };
  return { d, saves };
}

Deno.test("setup success saves payment method once; duplicate delivery is a no-op", async () => {
  const profile = { stripe_customer_id: "cus_A", default_payment_method_id: null };
  const { d, saves } = deps(profile, { status: "succeeded", customer: "cus_A", payment_method: "pm_1" });
  assertEquals(await handleAdCardSetupSession(session, d), { handled: true, result: "saved" });
  assertEquals(await handleAdCardSetupSession(session, d), { handled: true, result: "duplicate" });
  assertEquals(saves, ["pm_1"]);
});

Deno.test("rejects session whose customer is not the member's stored customer", async () => {
  const { d, saves } = deps({ stripe_customer_id: "cus_OTHER", default_payment_method_id: null }, { status: "succeeded", customer: "cus_A", payment_method: "pm_1" });
  assertEquals(await handleAdCardSetupSession(session, d), { handled: true, result: "rejected", reason: "customer_mismatch" });
  assertEquals(saves, []);
});

Deno.test("rejects unsucceeded or mismatched SetupIntent", async () => {
  const p = () => ({ stripe_customer_id: "cus_A", default_payment_method_id: null });
  assertEquals((await handleAdCardSetupSession(session, deps(p(), { status: "requires_action", customer: "cus_A", payment_method: "pm_1" }).d)), { handled: true, result: "rejected", reason: "setup_not_succeeded" });
  assertEquals((await handleAdCardSetupSession(session, deps(p(), { status: "succeeded", customer: "cus_B", payment_method: "pm_1" }).d)), { handled: true, result: "rejected", reason: "intent_customer_mismatch" });
});

Deno.test("payment-mode funding sessions are not handled by card setup", async () => {
  const { d } = deps(null, {});
  assertEquals(await handleAdCardSetupSession({ ...session, mode: "payment" }, d), { handled: false });
  assertEquals(await handleAdCardSetupSession({ ...session, metadata: { transaction_id: "x" } }, d), { handled: false });
});

Deno.test("setup session body charges nothing and is scoped to server member id", () => {
  const body = buildSetupSessionBody({ stripeCustomerId: "cus_A", memberId: member, appUrl: "https://x" });
  assertEquals(body.mode, "setup");
  assertEquals(body["metadata[customer_id]"], member);
  assertEquals(Object.keys(body).some((k) => k.startsWith("line_items") || k.includes("amount")), false);
});

Deno.test("setup session uses hosted Checkout with success/cancel URLs, not embedded return_url", () => {
  const body = buildSetupSessionBody({ stripeCustomerId: "cus_A", memberId: member, appUrl: "https://x" });
  assertEquals(body.ui_mode, "hosted");
  assertEquals(body.success_url, "https://x/ads?setup_session_id={CHECKOUT_SESSION_ID}");
  assertEquals(body.cancel_url, "https://x/ads?setup_canceled=1");
  assertEquals("return_url" in body, false);
});
