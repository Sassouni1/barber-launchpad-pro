import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BARBER_LAUNCH_LOCATION_ID, buildSupportAlertSms, classifySmsResponse, safePreview, sendChrisSupportSms } from "./supportMessageAlert.ts";

const base = {
  messageId: "abcdef12-0000-4000-8000-000000000001",
  conversationId: "c0ffee00-0000-4000-8000-000000000002",
  body: "How do I cut a\n\nskin system?",
  hasAttachment: false,
  memberName: "Jamie Member",
  memberEmail: "jamie@example.com",
};

Deno.test("alert includes member, preview and direct conversation link", () => {
  const sms = buildSupportAlertSms(base);
  assertStringIncludes(sms, "Member: Jamie Member <jamie@example.com>");
  assertStringIncludes(sms, 'Message: "How do I cut a skin system?"');
  assertStringIncludes(sms, "https://member.thebarberlaunch.com/admin/support?conversation=c0ffee00-0000-4000-8000-000000000002");
});

Deno.test("image-only message uses attachment label", () => {
  assertStringIncludes(buildSupportAlertSms({ ...base, body: "", hasAttachment: true }), "Message: [Image attachment]");
});

Deno.test("preview is capped at 120 characters", () => {
  assertEquals(safePreview("x".repeat(500)).length, 120);
});

Deno.test("long digit runs are hidden from the preview", () => {
  assertEquals(safePreview("card 4242 4242 4242 4242 ok"), "card [number hidden] ok");
});

Deno.test("2xx is sent, 4xx retryable failure, 5xx uncertain", () => {
  assertEquals(classifySmsResponse(201, '{"messageId":"m1"}'), { status: "sent", providerMessageId: "m1" });
  assertEquals(classifySmsResponse(422, "bad").status, "failed");
  assertEquals(classifySmsResponse(502, "gateway").status, "uncertain");
});

Deno.test("wrong GHL location never sends", async () => {
  let calls = 0;
  const out = await sendChrisSupportSms(async () => ({ accessToken: "t", locationId: "other" }), "hi", (async () => { calls++; return new Response("{}"); }) as typeof fetch);
  assertEquals(out, { status: "failed", reason: "wrong_ghl_location" });
  assertEquals(calls, 0);
});

Deno.test("network error on the send call is uncertain, not retryable", async () => {
  const f = (async (url: string | URL | Request) => {
    if (String(url).includes("/contacts/")) return new Response(JSON.stringify({ contacts: [{ id: "chris" }] }));
    throw new Error("timeout");
  }) as typeof fetch;
  const out = await sendChrisSupportSms(async () => ({ accessToken: "t", locationId: BARBER_LAUNCH_LOCATION_ID }), "hi", f);
  assertEquals(out.status, "uncertain");
});

Deno.test("successful send posts to Chris's contact", async () => {
  let body = "";
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("/contacts/")) return new Response(JSON.stringify({ contacts: [{ id: "chris" }] }));
    body = String(init?.body); return new Response(JSON.stringify({ messageId: "m9" }), { status: 201 });
  }) as typeof fetch;
  const out = await sendChrisSupportSms(async () => ({ accessToken: "t", locationId: BARBER_LAUNCH_LOCATION_ID }), "hello", f);
  assertEquals(out, { status: "sent", providerMessageId: "m9" });
  const parsed = JSON.parse(body);
  assert(parsed.contactId === "chris" && parsed.phone === "7276374672" && parsed.type === "SMS");
});
