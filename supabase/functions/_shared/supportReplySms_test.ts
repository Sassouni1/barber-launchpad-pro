import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSupportReplySms, locationNumbers, normalizeUsPhone, providerMessageFacts, recipientCheck, replyEligibility,
  sendSupportReplySms, SUPPORT_REPLY_FROM_NUMBER, SUPPORT_REPLY_LOCATION_ID,
} from "./supportReplySms.ts";

const member = "11111111-1111-1111-1111-111111111111";
const admin = "22222222-2222-2222-2222-222222222222";
const msg = (sender: string, deleted: string | null = null) => ({ id: "m1", conversation_id: "c1", sender_id: sender, deleted_at: deleted });
const contact = { id: "abc", locationId: SUPPORT_REPLY_LOCATION_ID, email: "Member@Example.com", phone: "+15555550123", dnd: false };
const profile = { email: "member@example.com", phone: "(555) 555-0123" };

Deno.test("text is one segment, private, links to Support and says text replies don't reach Support", () => {
  const t = buildSupportReplySms();
  assert(t.length <= 160, `length ${t.length}`);
  assert(t.includes("https://member.thebarberlaunch.com/support"));
  assert(t.includes("not by text"));
  assert(t.includes("STOP"));
});

Deno.test("only a live team reply in a member's conversation qualifies", () => {
  assertEquals(replyEligibility({ message: msg(admin), memberId: member, senderIsAdmin: true }), { ok: true });
  assertEquals(replyEligibility({ message: msg(member), memberId: member, senderIsAdmin: false }), { ok: false, reason: "member_authored" });
  // An admin writing in their own conversation is the member, not a team reply.
  assertEquals(replyEligibility({ message: msg(admin), memberId: admin, senderIsAdmin: true }), { ok: false, reason: "member_authored" });
  assertEquals(replyEligibility({ message: msg(admin), memberId: member, senderIsAdmin: false }), { ok: false, reason: "sender_not_team" });
  assertEquals(replyEligibility({ message: msg(admin, "2026-01-01"), memberId: member, senderIsAdmin: true }), { ok: false, reason: "reply_unsent_before_text" });
  assertEquals(replyEligibility({ message: null, memberId: member, senderIsAdmin: true }).ok, false);
});

Deno.test("US phone normalization rejects invalid numbers", () => {
  assertEquals(normalizeUsPhone("727-637-4672"), "+17276374672");
  assertEquals(normalizeUsPhone("+1 (727) 637 4672"), "+17276374672");
  assertEquals(normalizeUsPhone("12345"), null);
  assertEquals(normalizeUsPhone("+447700900123"), null);
  assertEquals(normalizeUsPhone("0276374672"), null);
  assertEquals(normalizeUsPhone(null), null);
});

Deno.test("recipient must match profile phone and the GHL contact found by email; DND/opt-out skip", () => {
  assertEquals(recipientCheck(profile, contact, false), { ok: true, phone: "+15555550123", contactId: "abc" });
  assertEquals(recipientCheck({ ...profile, phone: null }, contact, false).ok, false);
  assertEquals((recipientCheck({ ...profile, phone: "123" }, contact, false) as { reason: string }).reason, "member_phone_invalid");
  assertEquals((recipientCheck(profile, contact, true) as { reason: string }).reason, "member_opted_out");
  assertEquals((recipientCheck(profile, null, false) as { reason: string }).reason, "ghl_contact_unresolved");
  assertEquals((recipientCheck(profile, { ...contact, phone: "+15555550999" }, false) as { reason: string }).reason, "ghl_contact_phone_mismatch");
  assertEquals((recipientCheck(profile, { ...contact, email: "other@example.com" }, false) as { reason: string }).reason, "ghl_contact_email_mismatch");
  assertEquals((recipientCheck(profile, { ...contact, locationId: "other" }, false) as { reason: string }).reason, "ghl_contact_wrong_location");
  assertEquals((recipientCheck(profile, { ...contact, dnd: true }, false) as { reason: string }).reason, "member_dnd");
  assertEquals((recipientCheck(profile, { ...contact, dndSettings: { SMS: { status: "active" } } }, false) as { reason: string }).reason, "member_dnd");
  assertEquals(recipientCheck(profile, { ...contact, dndSettings: { SMS: { status: "inactive" } } }, false).ok, true);
});

Deno.test("send pins the 607 sender and classifies outcomes", async () => {
  let sent: Record<string, unknown> = {};
  const ok = await sendSupportReplySms({ accessToken: "t", locationId: SUPPORT_REPLY_LOCATION_ID }, { contactId: "abc", phone: "+15555550123", message: "x" },
    (async (_u: unknown, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ messageId: "pm1" }), { status: 201 }); }) as typeof fetch);
  assertEquals(ok, { status: "sent", providerMessageId: "pm1" });
  assertEquals(sent.fromNumber, SUPPORT_REPLY_FROM_NUMBER);
  assertEquals(sent.fromNumber, "+17276076347");
  assertEquals(sent.toNumber, "+15555550123");
  const wrong = await sendSupportReplySms({ accessToken: "t", locationId: "elsewhere" }, { contactId: "abc", phone: "+15555550123", message: "x" },
    (() => { throw new Error("must not call"); }) as typeof fetch);
  assertEquals(wrong.status, "failed");
  const rejected = await sendSupportReplySms({ accessToken: "t", locationId: SUPPORT_REPLY_LOCATION_ID }, { contactId: "abc", phone: "+1", message: "x" },
    (async () => new Response("bad", { status: 422 })) as typeof fetch);
  assertEquals(rejected.status, "failed");
  const unknown = await sendSupportReplySms({ accessToken: "t", locationId: SUPPORT_REPLY_LOCATION_ID }, { contactId: "abc", phone: "+1", message: "x" },
    (async () => new Response("oops", { status: 502 })) as typeof fetch);
  assertEquals(unknown.status, "uncertain");
  const timeout = await sendSupportReplySms({ accessToken: "t", locationId: SUPPORT_REPLY_LOCATION_ID }, { contactId: "abc", phone: "+1", message: "x" },
    (async () => { throw new Error("timeout"); }) as typeof fetch);
  assertEquals(timeout.status, "uncertain");
});

Deno.test("provider facts and location numbers parse", () => {
  assertEquals(providerMessageFacts({ message: { status: "delivered", direction: "outbound", from: "+17276076347", to: "+15555550123" } }),
    { status: "delivered", direction: "outbound", from: "+17276076347", to: "+15555550123", error: null });
  assertEquals(providerMessageFacts({ status: "sent" }).from, null);
  assertEquals(locationNumbers({ numbers: [{ phoneNumber: "+1 727 607 6347" }, { phoneNumber: "bad" }] }), ["+17276076347"]);
});
