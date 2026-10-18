import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hairSystemTestStripeKey, isStripeCheckoutUrl, testLineItems } from "./hairSystemTestMode.ts";

Deno.test("test checkout: one standard system + $10 shipping totals $210", () => {
  const items = testLineItems([{ length: 'Standard 5" hair', curl: "Standard" }], "Shipping · $10");
  assertEquals(items.reduce((s, i) => s + i.unit_amount * i.quantity, 0), 21000);
});

Deno.test("test checkout refuses a live secret key", () => {
  Deno.env.set("HAIR_SYSTEM_STRIPE_TEST_SECRET_KEY", "sk_live_x");
  assertEquals(hairSystemTestStripeKey(), null);
  Deno.env.set("HAIR_SYSTEM_STRIPE_TEST_SECRET_KEY", "sk_test_x");
  assertEquals(hairSystemTestStripeKey(), "sk_test_x");
  Deno.env.delete("HAIR_SYSTEM_STRIPE_TEST_SECRET_KEY");
});

Deno.test("test checkout only redirects to Stripe-hosted checkout", () => {
  assertEquals(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_1"), true);
  assertEquals(isStripeCheckoutUrl("https://evil.example/checkout.stripe.com"), false);
  assertEquals(isStripeCheckoutUrl("http://checkout.stripe.com/x"), false);
});

Deno.test("test SMS recipient uses normalized stored order phone first", async () => {
  const { testSmsRecipient } = await import("./hairSystemTestMode.ts");
  if (testSmsRecipient({ phone: "7276374672" }, null) !== "+17276374672") throw new Error("stored phone not used");
  if (testSmsRecipient({}, "(727) 637-4672") !== "+17276374672") throw new Error("buyer fallback failed");
  if (!testSmsRecipient({}, null).startsWith("(none")) throw new Error("missing phone should be none");
});
