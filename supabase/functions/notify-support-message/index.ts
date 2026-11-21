// Texts Chris when a member sends a new Support message.
// Called by the support_messages AFTER INSERT trigger (via pg_net with a
// server-held token) for rows it already put in support_message_sms_alerts.
// Callers cannot choose recipients or content: the message, sender and member
// are re-read from the database, and the ledger claim allows one send per
// message ID. Admins (user_roles) can read status / trigger a retry sweep.
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getGhlAccess } from "../_shared/ghlMessaging.ts";
import { BARBER_LAUNCH_LOCATION_ID, buildSupportAlertSms, sendChrisSupportSms, type SendOutcome } from "../_shared/supportMessageAlert.ts";

const FUNCTION_VERSION = "notify-support-message/2026-11-21-v1";
const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("Backend configuration unavailable");
const db = createClient(url, key, { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Function-Version": FUNCTION_VERSION } });
const now = () => new Date().toISOString();

async function finish(messageId: string, patch: Record<string, unknown>) {
  const { error } = await db.from("support_message_sms_alerts").update({ ...patch, updated_at: now() })
    .eq("message_id", messageId).eq("status", "sending");
  if (error) console.error("support alert ledger finish failed", messageId, error.message);
}

async function getAccess() {
  const r = await getGhlAccess(db as never);
  if ("error" in r) throw new Error(r.error);
  return r;
}

/** Claim, verify and send one alert. Returns the final ledger status. */
async function processMessage(messageId: string): Promise<string> {
  const { data: claimed, error: claimErr } = await db.rpc("claim_support_message_sms_alert", { _message_id: messageId });
  if (claimErr) {
    console.error("support alert claim failed", messageId, claimErr.message);
    return "claim_error";
  }
  const row = (claimed ?? [])[0];
  if (!row) return "not_claimable"; // already sent/in progress/terminal, unknown, or outside the retry window

  const { data: msg, error: msgErr } = await db.from("support_messages")
    .select("id, conversation_id, sender_id, body, attachment_path, deleted_at, created_at").eq("id", messageId).maybeSingle();
  const { data: conv } = msg
    ? await db.from("support_conversations").select("member_id").eq("id", msg.conversation_id).maybeSingle()
    : { data: null };
  if (msgErr || !msg || !conv) {
    await finish(messageId, { status: "failed", last_error: `read_failed:${msgErr?.message ?? "missing"}`.slice(0, 300) });
    return "failed";
  }
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: msg.sender_id, _role: "admin" });
  if (msg.sender_id !== conv.member_id || msg.sender_id !== row.member_id || isAdmin === true) {
    await finish(messageId, { status: "skipped", last_error: "not_member_message" });
    return "skipped";
  }
  if (msg.deleted_at) {
    await finish(messageId, { status: "skipped", last_error: "message_unsent_before_alert" });
    return "skipped";
  }

  const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", msg.sender_id).maybeSingle();
  const text = buildSupportAlertSms({
    messageId: msg.id,
    conversationId: msg.conversation_id,
    body: msg.body,
    hasAttachment: !!msg.attachment_path,
    memberName: profile?.full_name ?? null,
    memberEmail: profile?.email ?? null,
  });

  const out: SendOutcome = await sendChrisSupportSms(getAccess, text);
  if (out.status === "sent") {
    await finish(messageId, { status: "sent", sent_at: now(), provider_message_id: out.providerMessageId, last_error: null });
  } else {
    console.error("support alert not delivered", messageId, out.status, out.reason);
    await finish(messageId, { status: out.status, last_error: out.reason.slice(0, 300) });
  }
  return out.status;
}

/** Retry stale pending rows (lost dispatch) and definitely-not-sent failures. */
async function sweep(limit: number) {
  const { data, error } = await db.rpc("support_message_sms_alert_retry_candidates", { _limit: limit });
  if (error) {
    console.error("support alert sweep failed", error.message);
    return [];
  }
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

async function status() {
  const { data: rows, error } = await db.from("support_message_sms_alerts")
    .select("message_id, conversation_id, status, attempts, last_error, provider_message_id, message_created_at, sent_at, updated_at")
    .order("message_created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const since = rows?.length ? rows[rows.length - 1].message_created_at : null;
  // Member messages since the ledger began that have no ledger row = missed enqueue.
  const { data: missing } = await db.rpc("support_message_sms_alert_missing", {});
  let locationMatches: boolean | null = null;
  try { locationMatches = (await getAccess()).locationId === BARBER_LAUNCH_LOCATION_ID; } catch { locationMatches = false; }
  return {
    version: FUNCTION_VERSION,
    locationMatches,
    counts,
    countedSince: since,
    missingLedgerRows: missing ?? null,
    needsAttention: (rows ?? []).filter((r) => r.status !== "sent").slice(0, 50),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    const alertToken = req.headers.get("x-alert-token") ?? "";
    if (alertToken) {
      const { data: ok, error } = await db.rpc("verify_support_sms_alert_token", { _token: alertToken });
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
    return json({ error: "Unsupported action" }, 400);
  } catch (e) {
    console.error("notify-support-message error", e instanceof Error ? e.message : e);
    return json({ error: "alert_processing_failed" }, 500);
  }
});
