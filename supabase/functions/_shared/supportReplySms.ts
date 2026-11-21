// Member SMS when the Barber Launch team replies in Support.
// Pure decision/message logic plus small GHL helpers. Separate from the
// member -> Chris alert (supportMessageAlert.ts), which it does not change.
import { classifySmsResponse, type SendOutcome } from "./supportMessageAlert.ts";
import { RELAY_LOCATION_ID } from "./barberLaunchGhlRelay.ts";

export const SUPPORT_REPLY_LOCATION_ID = RELAY_LOCATION_ID;
/** The Barber Launch number already used for Chris's Support alerts. Every send pins it. */
export const SUPPORT_REPLY_FROM_NUMBER = "+17276076347";
export const SUPPORT_PAGE_URL = "https://member.thebarberlaunch.com/support";
const GHL_BASE = "https://services.leadconnectorhq.com";

/** Private: never includes the reply text, names, or conversation details. */
export function buildSupportReplySms() {
  return `Barber Launch replied to your support question. Log in to read it: ${SUPPORT_PAGE_URL} (reply there, not by text). Reply STOP to opt out.`;
}

/** US/Canada numbers only (the sender is a US long code). Returns +1XXXXXXXXXX or null. */
export function normalizeUsPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null;
}

export const maskPhone = (e164: string | null) => (e164 ? `***${e164.slice(-4)}` : null);

export type ReplyMessage = { id: string; conversation_id: string; sender_id: string; deleted_at: string | null };
export type ReplyFacts = {
  message: ReplyMessage | null;
  memberId: string | null;
  senderIsAdmin: boolean;
};

/** Only a live, admin-authored reply in someone else's conversation qualifies. */
export function replyEligibility(f: ReplyFacts): { ok: true } | { ok: false; reason: string } {
  if (!f.message || !f.memberId) return { ok: false, reason: "message_or_conversation_missing" };
  if (f.message.sender_id === f.memberId) return { ok: false, reason: "member_authored" };
  if (!f.senderIsAdmin) return { ok: false, reason: "sender_not_team" };
  if (f.message.deleted_at) return { ok: false, reason: "reply_unsent_before_text" };
  return { ok: true };
}

export type GhlContact = {
  id?: string;
  locationId?: string;
  email?: string | null;
  phone?: string | null;
  dnd?: boolean;
  dndSettings?: Record<string, { status?: string } | undefined> | null;
};
export type MemberProfile = { email: string | null; phone: string | null };

/**
 * The phone must be the member's own saved profile number AND the number on
 * the Barber Launch GHL contact found by the member's email. Any DND/opt-out,
 * mismatch or missing piece skips the text.
 */
export function recipientCheck(
  profile: MemberProfile | null,
  contact: GhlContact | null,
  optedOutLocally: boolean,
): { ok: true; phone: string; contactId: string } | { ok: false; reason: string; phone?: string | null } {
  if (!profile) return { ok: false, reason: "member_profile_missing" };
  const phone = normalizeUsPhone(profile.phone);
  if (!phone) return { ok: false, reason: profile.phone ? "member_phone_invalid" : "member_phone_missing" };
  if (optedOutLocally) return { ok: false, reason: "member_opted_out", phone };
  const email = String(profile.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "member_email_missing", phone };
  if (!contact?.id) return { ok: false, reason: "ghl_contact_unresolved", phone };
  if (contact.locationId && contact.locationId !== SUPPORT_REPLY_LOCATION_ID) return { ok: false, reason: "ghl_contact_wrong_location", phone };
  if (String(contact.email ?? "").trim().toLowerCase() !== email) return { ok: false, reason: "ghl_contact_email_mismatch", phone };
  if (normalizeUsPhone(contact.phone) !== phone) return { ok: false, reason: "ghl_contact_phone_mismatch", phone };
  const smsDnd = contact.dndSettings?.SMS?.status;
  if (contact.dnd === true || (smsDnd && smsDnd.toLowerCase() === "active")) return { ok: false, reason: "member_dnd", phone };
  return { ok: true, phone, contactId: contact.id };
}

/**
 * Phone numbers listed for the location. Accepts the live GHL shape
 * {status, data: {numbers: [{phoneNumber}]}} and direct lists
 * ({numbers: [...]}, {phoneNumbers: [...]}, {data: [...]}, or a bare array).
 */
export function locationNumbers(payload: unknown): string[] {
  const asRecord = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const pickList = (v: unknown): unknown[] | null => {
    if (Array.isArray(v)) return v;
    const r = asRecord(v);
    if (!r) return null;
    for (const k of ["numbers", "phoneNumbers"]) if (Array.isArray(r[k])) return r[k] as unknown[];
    return null;
  };
  const root = asRecord(payload);
  const list = pickList(payload) ?? (root ? pickList(root.data) : null) ?? [];
  return list
    .map((n) => {
      if (typeof n === "string") return n;
      const r = asRecord(n);
      return r?.phoneNumber ?? r?.number ?? null;
    })
    .map((n) => normalizeUsPhone(typeof n === "string" ? n : null))
    .filter((n): n is string => !!n);
}

/** Delivery facts from GET /conversations/messages/{id}; from/to only when GHL reports them. */
export function providerMessageFacts(payload: unknown) {
  const root = (payload ?? {}) as Record<string, any>;
  const m = (root.message ?? root) as Record<string, any>;
  const pick = (...vals: unknown[]) => vals.find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const from = pick(m.from, m.fromNumber, m.meta?.from, m.meta?.fromNumber, m.meta?.sms?.from);
  const to = pick(m.to, m.toNumber, m.meta?.to, m.meta?.toNumber, m.meta?.sms?.to);
  return {
    status: pick(m.status) ?? null,
    direction: pick(m.direction) ?? null,
    from: from ? normalizeUsPhone(from) ?? from : null,
    to: to ? normalizeUsPhone(to) ?? to : null,
    error: pick(m.error, m.meta?.error) ?? null,
  };
}

export type GhlAccess = { accessToken: string; locationId: string };
type FetchLike = typeof fetch;
const headers = (token: string, version = "2021-07-28") => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  Version: version,
});

/** Read-only contact lookup by email; never creates a contact. Throws on read failure. */
export async function findContactByEmail(access: GhlAccess, email: string, fetchImpl: FetchLike = fetch): Promise<GhlContact | null> {
  const res = await fetchImpl(
    `${GHL_BASE}/contacts/search/duplicate?locationId=${encodeURIComponent(access.locationId)}&email=${encodeURIComponent(email)}`,
    { headers: headers(access.accessToken, "2021-04-15") },
  );
  if (!res.ok) { await res.body?.cancel(); throw new Error(`ghl_contact_lookup_http_${res.status}`); }
  const data = await res.json().catch(() => ({}));
  const id = data?.contact?.id;
  if (!id) return null;
  // Full record carries dnd / dndSettings.
  const full = await fetchImpl(`${GHL_BASE}/contacts/${encodeURIComponent(id)}`, { headers: headers(access.accessToken, "2021-04-15") });
  if (!full.ok) { await full.body?.cancel(); throw new Error(`ghl_contact_read_http_${full.status}`); }
  const fd = await full.json().catch(() => ({}));
  return (fd?.contact ?? null) as GhlContact | null;
}

/** true/false when the location's numbers are readable; null when no credential can read them. */
export async function senderInLocation(accesses: GhlAccess[], fetchImpl: FetchLike = fetch): Promise<boolean | null> {
  for (const a of accesses) {
    if (a.locationId !== SUPPORT_REPLY_LOCATION_ID) continue;
    try {
      const res = await fetchImpl(`${GHL_BASE}/phone-system/numbers/location/${encodeURIComponent(a.locationId)}`, { headers: headers(a.accessToken) });
      if (!res.ok) { await res.body?.cancel(); continue; }
      return locationNumbers(await res.json().catch(() => ({}))).includes(SUPPORT_REPLY_FROM_NUMBER);
    } catch { /* try next credential */ }
  }
  return null;
}

/** One SMS from the pinned Barber Launch number. Network errors on the POST are "uncertain" (never resent). */
export async function sendSupportReplySms(
  access: GhlAccess,
  input: { contactId: string; phone: string; message: string },
  fetchImpl: FetchLike = fetch,
): Promise<SendOutcome> {
  if (access.locationId !== SUPPORT_REPLY_LOCATION_ID) return { status: "failed", reason: "wrong_ghl_location" };
  try {
    const res = await fetchImpl(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: headers(access.accessToken),
      body: JSON.stringify({
        type: "SMS",
        contactId: input.contactId,
        message: input.message,
        fromNumber: SUPPORT_REPLY_FROM_NUMBER,
        toNumber: input.phone,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return classifySmsResponse(res.status, await res.text().catch(() => ""));
  } catch (e) {
    return { status: "uncertain", reason: `send_error:${(e instanceof Error ? e.message : String(e)).slice(0, 160)}` };
  }
}

/** Reads one provider message with the first credential allowed to. null = unreadable. */
export async function readProviderMessage(accesses: GhlAccess[], messageId: string, fetchImpl: FetchLike = fetch) {
  for (const a of accesses) {
    try {
      const res = await fetchImpl(`${GHL_BASE}/conversations/messages/${encodeURIComponent(messageId)}`, { headers: headers(a.accessToken, "2021-04-15") });
      if (!res.ok) { await res.body?.cancel(); continue; }
      return providerMessageFacts(await res.json().catch(() => ({})));
    } catch { /* next */ }
  }
  return null;
}
