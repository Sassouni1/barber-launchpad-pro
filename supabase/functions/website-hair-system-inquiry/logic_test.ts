import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { allowedOrigin, classifyGhlSend, inquiryDetails, isBot, originatingSiteUrl, parseInquiry, sameInquiry } from "./logic.ts";

const form = { firstName: " Sam ", lastName: "Lee", phone: "(727) 555-0101", email: "sam@example.com", concern: "Crown loss", notes: "Prefers mornings", service: "Hair systems inquiry" };

Deno.test("text includes full name, phone, email, concern, notes and originating site", () => {
  const p = parseInquiry(form);
  if (!p.ok) throw new Error("should parse");
  const text = inquiryDetails(p.inquiry, "https://sites.thebarberlaunch.com/site-abc/hair-loss-solutions/");
  for (const part of ["Name: Sam Lee", "Phone: (727) 555-0101", "Email: sam@example.com", "Hair-loss concern: Crown loss", "Notes: Prefers mornings", "Site: https://sites.thebarberlaunch.com/site-abc/hair-loss-solutions/"]) {
    assertEquals(text.includes(part), true, part);
  }
});

Deno.test("empty notes read None", () => {
  const p = parseInquiry({ ...form, notes: "" });
  if (!p.ok) throw new Error("should parse");
  assertEquals(inquiryDetails(p.inquiry, "x").includes("Notes: None"), true);
});

Deno.test("validation rejects bad phone, email, concern and service", () => {
  assertEquals(parseInquiry({ ...form, phone: "12345" }).ok, false);
  assertEquals(parseInquiry({ ...form, email: "nope" }).ok, false);
  assertEquals(parseInquiry({ ...form, concern: "Other" }).ok, false);
  assertEquals(parseInquiry({ ...form, service: "x" }).ok, false);
  assertEquals(parseInquiry({ ...form, lastName: " " }).ok, false);
});

Deno.test("honeypot marks bots", () => {
  assertEquals(isBot({ website: "spam.com" }), true);
  assertEquals(isBot({ website: "" }), false);
});

Deno.test("same request id with changed details is not the same inquiry", () => {
  const a = parseInquiry(form), b = parseInquiry({ ...form, notes: "changed" });
  if (!a.ok || !b.ok) throw new Error("parse");
  assertEquals(sameInquiry(a.inquiry, a.inquiry), true);
  assertEquals(sameInquiry(a.inquiry, b.inquiry), false);
});

Deno.test("origin: shared host or the member's own domain only", () => {
  assertEquals(allowedOrigin("https://sites.thebarberlaunch.com", { custom_domain: null }), true);
  assertEquals(allowedOrigin("https://shop.com", { custom_domain: "www.shop.com" }), true);
  assertEquals(allowedOrigin("https://www.shop.com", { custom_domain: "shop.com" }), true);
  assertEquals(allowedOrigin("https://evil.com", { custom_domain: "shop.com" }), false);
  assertEquals(originatingSiteUrl({ site_slug: "site-1", custom_domain: "WWW.Shop.com" }), "https://shop.com/hair-loss-solutions/");
});

Deno.test("GHL 4xx is a definite failure, 5xx is uncertain (never resent)", () => {
  assertEquals(classifyGhlSend(201, '{"messageId":"m1"}', "sms"), { status: "sent", providerMessageId: "m1" });
  assertEquals(classifyGhlSend(422, "bad", "email").status, "failed");
  assertEquals(classifyGhlSend(502, "", "sms").status, "uncertain");
});
