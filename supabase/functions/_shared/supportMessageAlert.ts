// Support inbox -> Chris SMS alert. Pure message/outcome logic plus the GHL
// sender, which mirrors the alert path used by notify-certification-submission
// (direct GHL token + location env, else the stored OAuth connection), with a
// fail-closed check that the location is The Barber Launch location.
import { RELAY_LOCATION_ID } from "./barberLaunchGhlRelay.ts";

export const SUPPORT_ALERT_APP_URL = "https://member.thebarberlaunch.com";
export const CHRIS_ALERT_PHONE = "7276374672";
export const BARBER_LAUNCH_LOCATION_ID = RELAY_LOCATION_ID;
export const PREVIEW_MAX = 120;
const GHL_BASE = "https://services.leadconnectorhq.com";

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g;

function clean(text: string | null | undefined, max: number) {
  const s = String(text ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Short, single-line preview. Long digit runs (possible card/account numbers) are hidden. */
export function safePreview(body: string | null | undefined, max = PREVIEW_MAX) {
  const flat = String(body ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  const redacted = flat.replace(/\d(?:[ -]?\d){11,}/g, "[number hidden]");
  return clean(redacted, max);
}

export type AlertMessageInput = {
  messageId: string;
  conversationId: string;
  body: string | null;
  hasAttachment: boolean;
  memberName: string | null;
  memberEmail: string | null;
};

export function supportConversationUrl(conversationId: string) {
  return `${SUPPORT_ALERT_APP_URL}/admin/support?conversation=${encodeURIComponent(conversationId)}`;
}

export function buildSupportAlertSms(i: AlertMessageInput) {
  const preview = safePreview(i.body);
  const parts = [preview ? `"${preview}"` : "", i.hasAttachment ? "[Image attachment]" : ""].filter(Boolean);
  return [
    `SUPPORT_MESSAGE ${i.messageId.slice(0, 8)}`,
    "New Support message from a member",
    `Member: ${clean(i.memberName, 80) || "Unknown"} <${clean(i.memberEmail, 120) || "unknown"}>`,
    `Message: ${parts.join(" ") || "(no text)"}`,
    `Open: ${supportConversationUrl(i.conversationId)}`,
  ].join("\n");
}

export type SendOutcome =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "failed"; reason: string } // definitely not sent; retryable
  | { status: "uncertain"; reason: string }; // may have been sent; never retried

/** 2xx = sent; 4xx = rejected before sending; 5xx/other = provider state unknown. */
export function classifySmsResponse(status: number, body: string): SendOutcome {
  if (status >= 200 && status < 300) {
    let id: string | null = null;
    try {
      const d = JSON.parse(body);
      id = d?.messageId ?? d?.message?.id ?? d?.id ?? null;
    } catch { /* non-json */ }
    return { status: "sent", providerMessageId: id ? String(id) : null };
  }
  const reason = `ghl_sms_http_${status}:${clean(body, 200)}`;
  return status >= 400 && status < 500 ? { status: "failed", reason } : { status: "uncertain", reason };
}

export type GhlAccess = { accessToken: string; locationId: string };
type FetchLike = typeof fetch;

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  Version: "2021-07-28",
});

/** Same Chris-contact resolution as the certification alert path. */
export async function resolveChrisContactId(access: GhlAccess, fetchImpl: FetchLike = fetch): Promise<string> {
  const configured = Deno.env.get("GHL_CHRIS_CONTACT_ID");
  if (configured) return configured;
  const res = await fetchImpl(
    `${GHL_BASE}/contacts/?locationId=${encodeURIComponent(access.locationId)}&query=${encodeURIComponent(CHRIS_ALERT_PHONE)}`,
    { headers: headers(access.accessToken) },
  );
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    const contact = Array.isArray(data.contacts) ? data.contacts[0] : null;
    if (contact?.id) return contact.id;
  } else {
    await res.body?.cancel();
  }
  const created = await fetchImpl(`${GHL_BASE}/contacts/`, {
    method: "POST",
    headers: headers(access.accessToken),
    body: JSON.stringify({ locationId: access.locationId, firstName: "Chris", lastName: "Sassouni", phone: CHRIS_ALERT_PHONE }),
  });
  const text = await created.text().catch(() => "");
  if (!created.ok) throw new Error(`chris_contact_unavailable_${created.status}`);
  let id: string | undefined;
  try { const d = JSON.parse(text); id = d.contact?.id || d.id; } catch { /* ignore */ }
  if (!id) throw new Error("chris_contact_missing_id");
  return id;
}

/**
 * Sends one SMS to Chris. Anything before the send POST is "failed" (not sent);
 * a network error/timeout on the send POST is "uncertain" so it is never repeated.
 */
export async function sendChrisSupportSms(
  getAccess: () => Promise<GhlAccess>,
  message: string,
  fetchImpl: FetchLike = fetch,
): Promise<SendOutcome> {
  let access: GhlAccess;
  let contactId: string;
  try {
    access = await getAccess();
    if (access.locationId !== BARBER_LAUNCH_LOCATION_ID) return { status: "failed", reason: "wrong_ghl_location" };
    contactId = await resolveChrisContactId(access, fetchImpl);
  } catch (e) {
    return { status: "failed", reason: `pre_send:${clean(e instanceof Error ? e.message : String(e), 200)}` };
  }
  try {
    const res = await fetchImpl(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: headers(access.accessToken),
      body: JSON.stringify({ type: "SMS", contactId, message, phone: CHRIS_ALERT_PHONE }),
      signal: AbortSignal.timeout(15_000),
    });
    return classifySmsResponse(res.status, await res.text().catch(() => ""));
  } catch (e) {
    return { status: "uncertain", reason: `send_error:${clean(e instanceof Error ? e.message : String(e), 160)}` };
  }
}
