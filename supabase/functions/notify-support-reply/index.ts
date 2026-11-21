// Texts a member when the Barber Launch team replies to their Support question.
// Called by the support_messages AFTER INSERT trigger (pg_net + server-held
// token) only for rows it already put in support_reply_sms_notifications.
// Callers cannot choose recipient or content: the reply, conversation, sender
// role and member are re-read here, the phone must match both the member's
// profile and their Barber Launch GHL contact, and the ledger claim allows one
// send per reply. Every new team reply gets its own text (no time-window
// suppression). Admins (user_roles) can read status, retry, diagnose the
// sender and verify a recorded provider message.
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getGhlAccess } from "../_shared/ghlMessaging.ts";
import {
  buildSupportReplySms, findContactByEmail, maskPhone, readProviderMessage, recipientCheck,
  replyEligibility, sendSupportReplySms, senderInLocation, SUPPORT_REPLY_FROM_NUMBER, SUPPORT_REPLY_LOCATION_ID, type GhlAccess,
} from "../_shared/supportReplySms.ts";

const FUNCTION_VERSION = "notify-support-reply/2026-11-21-v2";
const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("Backend configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLE = "support_reply_sms_notifications";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Function-Version": FUNCTION_VERSION } });
const now = () => new Date().toISOString();

async function finish(messageId: string, patch: Record<string, unknown>) {
  const { error } = await db.from(TABLE).update({ ...patch, updated_at: now() }).eq("message_id", messageId).eq("status", "sending");
  if (error) console.error("support reply ledger finish failed", messageId, error.message);
}

/** Sending access: the same one Chris's Support alerts use. */
async function sendAccess(): Promise<GhlAccess> {
  const r = await getGhlAccess(db as never);
  if ("error" in r) throw new Error(r.error);
  return r;
}

/** Read-only credentials for verification, in order: sending access, then the stored OAuth connection. */
async function readAccesses(): Promise<GhlAccess[]> {
  const out: GhlAccess[] = [];
  for (const opts of [{}, { oauthOnly: true }]) {
    try {
      const r = await getGhlAccess(db as never, opts);
      if (!("error" in r) && !out.some((a) => a.accessToken === r.accessToken)) out.push(r);
    } catch { /* unavailable */ }
  }
  return out;
}

async function optedOutLocally(phone: string) {
  const variants = [phone, phone.slice(1), phone.slice(2)];
  const { data, error } = await db.from("sms_opt_outs").select("phone").in("phone", variants).limit(1);
  if (error) throw new Error("opt_out_check_failed");
  return (data ?? []).length > 0;
}

async function processMessage(messageId: string): Promise<string> {
  const { data: claimed, error: claimErr } = await db.rpc("claim_support_reply_sms", { _message_id: messageId });
  if (claimErr) { console.error("support reply claim failed", messageId, claimErr.message); return "claim_error"; }
  const row = (claimed ?? [])[0];
  if (!row) return "not_claimable";
  const skip = async (reason: string, extra: Record<string, unknown> = {}) => {
    await finish(messageId, { status: "skipped", last_error: reason, ...extra });
    return "skipped";
  };
  const fail = async (reason: string, extra: Record<string, unknown> = {}) => {
    await finish(messageId, { status: "failed", last_error: reason.slice(0, 300), ...extra });
    return "failed";
  };

  // 1. Re-read the reply and confirm it is a live team reply.
  const { data: msg, error: msgErr } = await db.from("support_messages")
    .select("id, conversation_id, sender_id, deleted_at").eq("id", messageId).maybeSingle();
  if (msgErr) return fail(`read_failed:${msgErr.message}`);
  const { data: conv } = msg ? await db.from("support_conversations").select("member_id").eq("id", msg.conversation_id).maybeSingle() : { data: null };
  const { data: isAdmin } = msg ? await db.rpc("has_role", { _user_id: msg.sender_id, _role: "admin" }) : { data: false };
  const eligible = replyEligibility({ message: msg, memberId: conv?.member_id ?? null, senderIsAdmin: isAdmin === true });
  if (!eligible.ok) return skip(eligible.reason);
  if (conv!.member_id !== row.member_id) return skip("ledger_member_mismatch");

  // 2. Safety stop: a past send that GHL reported from a different number halts all reply texts.
  const { data: mismatch } = await db.from(TABLE).select("message_id").eq("sender_verified", false).limit(1);
  if ((mismatch ?? []).length) return skip("sender_mismatch_halt");

  // 3. Recipient: member profile phone == phone on their Barber Launch GHL contact (found by email), not DND/opted out.
  const { data: profile } = await db.from("profiles").select("email, phone").eq("id", row.member_id).maybeSingle();
  let access: GhlAccess;
  try { access = await sendAccess(); } catch (e) { return fail(`ghl_access:${e instanceof Error ? e.message : e}`); }
  if (access.locationId !== SUPPORT_REPLY_LOCATION_ID) return fail("wrong_ghl_location");
  let contact = null;
  const email = String(profile?.email ?? "").trim().toLowerCase();
  if (email) {
    try { contact = await findContactByEmail(access, email); } catch (e) { return fail(`contact_lookup:${e instanceof Error ? e.message : e}`); }
  }
  let localOptOut = false;
  const prePhone = recipientCheck(profile ? { email: profile.email, phone: profile.phone } : null, null, false);
  if ("phone" in prePhone && prePhone.phone) {
    try { localOptOut = await optedOutLocally(prePhone.phone); } catch { return fail("opt_out_check_failed"); }
  }
  const who = recipientCheck(profile ? { email: profile.email, phone: profile.phone } : null, contact, localOptOut);
  if (!who.ok) return skip(who.reason, { recipient_last4: who.phone ? who.phone.slice(-4) : null, ghl_contact_id: contact?.id ?? null });

  // 4. Sender: the 607 number must not be contradicted by the location's number list (when readable); every send pins it.
  const accesses = await readAccesses();
  const senderOk = await senderInLocation(accesses);
  if (senderOk === false) return skip("sender_number_not_in_location");

  const out = await sendSupportReplySms(access, { contactId: who.contactId, phone: who.phone, message: buildSupportReplySms() });
  const base = { recipient_last4: who.phone.slice(-4), ghl_contact_id: who.contactId, from_number: SUPPORT_REPLY_FROM_NUMBER };
  if (out.status === "sent") {
    await finish(messageId, { ...base, status: "sent", sent_at: now(), provider_message_id: out.providerMessageId, last_error: senderOk === null ? "sender_list_unreadable_pinned_from" : null });
  } else {
    console.error("support reply text not sent", messageId, out.status, out.reason);
    await finish(messageId, { ...base, status: out.status, last_error: out.reason.slice(0, 300) });
  }
  return out.status;
}

async function sweep(limit: number) {
  const { data, error } = await db.rpc("support_reply_sms_retry_candidates", { _limit: limit });
  if (error) { console.error("support reply sweep failed", error.message); return []; }
  const results = [];
  for (const id of (data ?? []) as string[]) results.push({ messageId: id, status: await processMessage(id) });
  return results;
}

async function isAdminCaller(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: ok } = await db.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return ok === true;
}

/** Re-reads one recorded provider message and stores GHL's delivery status and sender. */
async function verify(messageId: string) {
  const { data: row } = await db.from(TABLE).select("message_id, status, provider_message_id").eq("message_id", messageId).maybeSingle();
  if (!row?.provider_message_id) return { messageId, readable: false, reason: "no_provider_message_id" };
  const facts = await readProviderMessage(await readAccesses(), row.provider_message_id);
  if (!facts) return { messageId, readable: false, reason: "no_credential_can_read_messages" };
  const senderVerified = facts.from ? facts.from === SUPPORT_REPLY_FROM_NUMBER : null;
  await db.from(TABLE).update({
    provider_status: facts.status, provider_from: facts.from, sender_verified: senderVerified, verified_at: now(), updated_at: now(),
  }).eq("message_id", messageId);
  return { messageId, readable: true, providerStatus: facts.status, direction: facts.direction, from: facts.from, to: maskPhone(facts.to), senderVerified, providerError: facts.error };
}

async function diagnose() {
  let sendLocationMatches = false;
  try { sendLocationMatches = (await sendAccess()).locationId === SUPPORT_REPLY_LOCATION_ID; } catch { /* false */ }
  const accesses = await readAccesses();
  return {
    version: FUNCTION_VERSION,
    sendLocationMatches,
    readCredentials: accesses.length,
    readLocationsMatch: accesses.map((a) => a.locationId === SUPPORT_REPLY_LOCATION_ID),
    senderNumberListed: await senderInLocation(accesses),
    pinnedFrom: SUPPORT_REPLY_FROM_NUMBER,
  };
}

async function status() {
  const { data: rows, error } = await db.from(TABLE)
    .select("message_id, conversation_id, status, attempts, last_error, recipient_last4, provider_message_id, provider_status, provider_from, sender_verified, message_created_at, sent_at, verified_at")
    .order("message_created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const { data: missing } = await db.rpc("support_reply_sms_missing", {});
  return { version: FUNCTION_VERSION, counts, missingLedgerRows: missing ?? null, recent: (rows ?? []).slice(0, 50) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    const replyToken = req.headers.get("x-reply-token") ?? "";
    if (replyToken) {
      const { data: ok, error } = await db.rpc("verify_support_reply_sms_token", { _token: replyToken });
      if (error || ok !== true) return json({ error: "Unauthorized" }, 401);
      const messageId = String(body.messageId ?? "");
      if (!UUID.test(messageId)) return json({ error: "messageId must be a UUID" }, 400);
      const result = await processMessage(messageId);
      const retried = await sweep(3);
      return json({ messageId, status: result, retried });
    }

    if (!(await isAdminCaller(req))) return json({ error: "Unauthorized" }, 401);
    if (body.action === "status") return json(await status());
    if (body.action === "retry") return json({ retried: await sweep(10) });
    if (body.action === "diagnose") return json(await diagnose());
    if (body.action === "verify") {
      const messageId = String(body.messageId ?? "");
      if (!UUID.test(messageId)) return json({ error: "messageId must be a UUID" }, 400);
      return json(await verify(messageId));
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (e) {
    console.error("notify-support-reply error", e instanceof Error ? e.message : e);
    return json({ error: "reply_text_processing_failed" }, 500);
  }
});
