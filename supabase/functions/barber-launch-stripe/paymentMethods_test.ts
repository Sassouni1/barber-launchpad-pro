import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  creationMethodParams,
  customLinkMethodMode,
  DYNAMIC_UPDATE_PARAMS,
  needsDynamicMigration,
  storedMethodTypes,
  stripeConfirmsDynamic,
  summarizePayOverTime,
} from "./paymentMethods.ts";

Deno.test("custom one-time link with pay-over-time allowed uses Stripe dynamic methods", () => {
  assertEquals(customLinkMethodMode({ allowPayOverTime: true }, false), "dynamic");
  assertEquals(customLinkMethodMode({}, false), "dynamic");
  assertEquals(creationMethodParams("dynamic"), {});
  assertEquals(storedMethodTypes("dynamic"), ["dynamic"]);
});

Deno.test("unchecked custom link stays card-only, including legacy allowKlarna:false", () => {
  assertEquals(customLinkMethodMode({ allowPayOverTime: false }, false), "card");
  assertEquals(customLinkMethodMode({ allowKlarna: false }, false), "card");
  assertEquals(customLinkMethodMode({ allowPayOverTime: true, allowKlarna: false }, false), "card");
  assertEquals(creationMethodParams("card"), { "payment_method_types[0]": "card" });
  assertEquals(storedMethodTypes("card"), ["card"]);
});

Deno.test("recurring links are always card-only", () => {
  assertEquals(customLinkMethodMode({ allowPayOverTime: true }, true), "card");
});

Deno.test("dynamic update sends payment_method_types as an empty string", () => {
  assertEquals(DYNAMIC_UPDATE_PARAMS, { payment_method_types: "" });
});

Deno.test("sync migrates only active one-time klarna links", () => {
  assertEquals(needsDynamicMigration({ active: true, recurring_interval: null, payment_method_types: ["card", "klarna"] }), true);
  assertEquals(needsDynamicMigration({ active: true, recurring_interval: null, payment_method_types: ["card"] }), false);
  assertEquals(needsDynamicMigration({ active: true, recurring_interval: "month", payment_method_types: ["card", "klarna"] }), false);
  assertEquals(needsDynamicMigration({ active: false, recurring_interval: null, payment_method_types: ["card", "klarna"] }), false);
  assertEquals(needsDynamicMigration({ active: true, recurring_interval: null, payment_method_types: ["dynamic"] }), false);
});

Deno.test("row is updated only when Stripe returns dynamic methods", () => {
  assertEquals(stripeConfirmsDynamic({ payment_method_types: null }), true);
  assertEquals(stripeConfirmsDynamic({ payment_method_types: [] }), true);
  assertEquals(stripeConfirmsDynamic({ payment_method_types: ["card", "klarna"] }), false);
  assertEquals(stripeConfirmsDynamic({}), false);
  assertEquals(stripeConfirmsDynamic(null), false);
});

Deno.test("pay-over-time summary distinguishes on, needs activation and off", () => {
  assertEquals(summarizePayOverTime([{
    is_default: true, active: true,
    klarna: { available: true, display_preference: { value: "on" } },
    afterpay_clearpay: { available: false, display_preference: { value: "on" } },
    affirm: { available: false, display_preference: { value: "off" } },
  }]), { klarna: "on", afterpay_clearpay: "needs_activation", affirm: "off" });
  assertEquals(summarizePayOverTime([]), null);
});
