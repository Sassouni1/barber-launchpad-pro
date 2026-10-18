import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hairSystemTestStripeKey, testLineItems } from "./hairSystemTestMode.ts";

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
