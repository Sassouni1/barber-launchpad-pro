// Public lead form on members' published hair-system pages (Classic + Bold).
// Saves the lead under the site's owner, then emails AND texts the owner's
// account contact details (never the public website phone) through the
// Barber Launch GHL location. Success is reported only when both sends succeed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGhlAccess, GHL_BASE } from "../_shared/ghlMessaging.ts";
import { RELAY_LOCATION_ID } from "../_shared/barberLaunchGhlRelay.ts";
import {
  findContactByEmail, normalizeUsPhone, readProviderMessage, recipientCheck, sendSupportReplySms,
  type GhlAccess, type GhlContact,
} from "../_shared/supportReplySms.ts";
import {
  allowedOrigin, classifyGhlSend, inquiryDetails, isBot, originatingSiteUrl, parseInquiry, sameInquiry,
  PER_EMAIL_HOURLY_LIMIT, PER_SITE_HOURLY_LIMIT, SENDABLE, type ChannelOutcome, type Inquiry,
} from "./logic.ts";

const VERSION = "website-hair-system-inquiry/2026-11-22-v2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TABLE = "website_hair_system_inquiries";
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
const now = () => new Date().toISOString();

function reply(data: Record<string, unknown>, status: number, origin = "") {
  return Response.json(data, { status, headers: {
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "no-store",
  } });
}

async function sendAccess(): Promise<GhlAccess> {
  const r = await getGhlAccess(db as never);
  if ("error" in r) throw new Error(r.error);
  if (r.locationId !== RELAY_LOCATION_ID) throw new Error("wrong_ghl_location");
  return r;
}

async function readAccesses(): Promise<GhlAccess[]> {
  const out: GhlAccess[] = [];
  for (const opts of [{}, { oauthOnly: true }]) {
    try {
      const r = await getGhlAccess(db as never, opts);
      if (!("error" in r) && r.locationId === RELAY_LOCATION_ID && !out.some((a) => a.accessToken === r.accessToken)) out.push(r);
    } catch { /* unavailable */ }
  }
  return out;
}

const ghlHeaders = (token: string, version = "2021-07-28") => ({
  Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", Version: version,
});

/** The member's Barber Launch contact, found by account email; created (email + account phone) only if absent. */
async function memberContact(access: GhlAccess, email: string, phone: string, name: string | null): Promise<GhlContact | null> {
  const found = await findContactByEmail(access, email);
  if (found) return found;
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: "POST", headers: ghlHeaders(access.accessToken, "2021-04-15"),
    body: JSON.stringify({ locationId: access.locationId, email, phone, firstName: parts[0] || "Member", lastName: parts.slice(1).join(" ") }),
  });
  if (!res.ok) { await res.body?.cancel(); throw new Error(`ghl_contact_create_http_${res.status}`); }
  await res.body?.cancel();
  return await findContactByEmail(access, email);
}

async function sendEmail(access: GhlAccess, contactId: string, to: string, subject: string, text: string): Promise<ChannelOutcome> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST", headers: ghlHeaders(access.accessToken),
      body: JSON.stringify({ type: "Email", contactId, emailTo: to, subject,
        html: `<div style="white-space:pre-line;font:16px/1.5 Arial,sans-serif">${escapeHtml(text)}</div>` }),
      signal: AbortSignal.timeout(15_000),
    });
    return classifyGhlSend(res.status, await res.text().catch(() => ""), "email");
  } catch (e) {
    return { status: "uncertain", reason: `ghl_email_error:${(e instanceof Error ? e.message : String(e)).slice(0, 160)}` };
  }
}

/** Atomically claims one channel; only pending/failed rows can send, so no request ever double-sends. */
async function claim(id: string, channel: "email" | "sms") {
  const col = `${channel}_status`;
  const { data } = await db.from(TABLE).update({ [col]: "sending", updated_at: now() }).eq("id", id).in(col, SENDABLE as unknown as string[]).select("id");
  return (data ?? []).length === 1;
}

async function record(id: string, channel: "email" | "sms", out: ChannelOutcome, accesses: GhlAccess[]) {
  const patch: Record<string, unknown> = { [`${channel}_status`]: out.status, updated_at: now() };
  if (out.status === "sent") {
    patch[`${channel}_provider_id`] = out.providerMessageId;
    patch[`${channel}_error`] = null;
    if (out.providerMessageId) {
      const facts = await readProviderMessage(accesses, out.providerMessageId).catch(() => null);
      if (facts?.status) patch[`${channel}_provider_status`] = facts.status;
    }
  } else {
    patch[`${channel}_error`] = out.reason.slice(0, 300);
    console.error("hair inquiry notification not sent", id, channel, out.status, out.reason);
  }
  await db.from(TABLE).update(patch).eq("id", id).eq(`${channel}_status`, "sending");
}

async function notifyMember(lead: { id: string; email_status: string; sms_status: string }, site: any, inquiry: Inquiry, siteUrl: string) {
  const fail = async (reason: string) => {
    const patch: Record<string, unknown> = { updated_at: now() };
    if ((SENDABLE as readonly string[]).includes(lead.email_status)) Object.assign(patch, { email_status: "failed", email_error: reason });
    if ((SENDABLE as readonly string[]).includes(lead.sms_status)) Object.assign(patch, { sms_status: "failed", sms_error: reason });
    await db.from(TABLE).update(patch).eq("id", lead.id);
    console.error("hair inquiry notification blocked", lead.id, reason);
    return { emailSent: lead.email_status === "sent", smsSent: lead.sms_status === "sent" };
  };
  // Account contact details: sign-in email + profile (sign-up) phone. Never the public website phone.
  const { data: authUser } = await db.auth.admin.getUserById(site.user_id);
  const accountEmail = String(authUser?.user?.email ?? "").trim().toLowerCase();
  const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", site.user_id).maybeSingle();
  const accountPhone = normalizeUsPhone(profile?.phone);
  if (!accountEmail) return fail("member_email_missing");
  if (!accountPhone) return fail(profile?.phone ? "member_phone_invalid" : "member_phone_missing");

  let access: GhlAccess;
  try { access = await sendAccess(); } catch (e) { return fail(`ghl_access:${e instanceof Error ? e.message : e}`); }
  let contact: GhlContact | null;
  try { contact = await memberContact(access, accountEmail, accountPhone, profile?.full_name ?? null); }
  catch (e) { return fail(`ghl_contact:${e instanceof Error ? e.message : e}`); }
  const { data: optOut } = await db.from("sms_opt_outs").select("phone").in("phone", [accountPhone, accountPhone.slice(1), accountPhone.slice(2)]).limit(1);
  const who = recipientCheck({ email: accountEmail, phone: accountPhone }, contact, (optOut ?? []).length > 0);
  await db.from(TABLE).update({ ghl_contact_id: contact?.id ?? null, notified_phone_last4: accountPhone.slice(-4), updated_at: now() }).eq("id", lead.id);
  const contactEmailOk = !!contact?.id && String(contact.email ?? "").trim().toLowerCase() === accountEmail;

  const details = inquiryDetails(inquiry, siteUrl);
  const accesses = await readAccesses();
  let emailSent = lead.email_status === "sent";
  let smsSent = lead.sms_status === "sent";

  if (!emailSent && await claim(lead.id, "email")) {
    const out: ChannelOutcome = contactEmailOk
      ? await sendEmail(access, contact!.id!, accountEmail, `New hair-system inquiry from ${inquiry.firstName} ${inquiry.lastName}`, details)
      : { status: "failed", reason: "ghl_contact_email_mismatch" };
    await record(lead.id, "email", out, accesses);
    emailSent = out.status === "sent";
  }
  if (!smsSent && await claim(lead.id, "sms")) {
    const out: ChannelOutcome = who.ok
      ? await (async () => {
        const r = await sendSupportReplySms(access, { contactId: who.contactId, phone: who.phone, message: details });
        return r.status === "sent" ? { status: "sent" as const, providerMessageId: r.providerMessageId } : r as ChannelOutcome;
      })()
      : { status: "failed", reason: who.reason };
    await record(lead.id, "sms", out, accesses);
    smsSent = out.status === "sent";
  }
  return { emailSent, smsSent };
}

async function isAdminCaller(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: ok } = await db.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return ok === true;
}

/** Admin-only: re-read GHL delivery status for one lead's email and text. */
async function verify(inquiryId: string) {
  const { data: row } = await db.from(TABLE).select("id, email_status, sms_status, email_provider_id, sms_provider_id, notified_phone_last4, email_error, sms_error").eq("id", inquiryId).maybeSingle();
  if (!row) return { found: false };
  const accesses = await readAccesses();
  const out: Record<string, unknown> = { found: true, version: VERSION, emailStatus: row.email_status, smsStatus: row.sms_status, phoneLast4: row.notified_phone_last4, emailError: row.email_error, smsError: row.sms_error };
  for (const ch of ["email", "sms"] as const) {
    const id = row[`${ch}_provider_id`];
    if (!id) continue;
    const facts = await readProviderMessage(accesses, id).catch(() => null);
    let readHttp: number[] = [];
    if (!facts) {
      for (const a of accesses) {
        const r = await fetch(`${GHL_BASE}/conversations/messages/${encodeURIComponent(id)}`, { headers: ghlHeaders(a.accessToken, "2021-04-15") }).catch(() => null);
        readHttp.push(r?.status ?? 0); await r?.body?.cancel();
      }
    }
    out[`${ch}Provider`] = facts ? { status: facts.status, direction: facts.direction, from: ch === "sms" ? facts.from : undefined, toLast4: facts.to ? String(facts.to).slice(-4) : null, error: facts.error } : { readable: false, credentials: accesses.length, readHttp };
    if (facts?.status) await db.from(TABLE).update({ [`${ch}_provider_status`]: facts.status, updated_at: now() }).eq("id", row.id);
  }
  return out;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "verify") {
    if (request.method !== "POST" || !(await isAdminCaller(request))) return reply({ error: "Forbidden" }, 403);
    const body = await request.json().catch(() => ({}));
    return reply(await verify(String(body?.inquiryId ?? "")), 200);
  }

  const origin = request.headers.get("origin") || "";
  const originUrl = (() => { try { return new URL(origin); } catch { return null; } })();
  if (!originUrl || originUrl.protocol !== "https:") return reply({ error: "Invalid origin" }, 403);
  if (request.method === "OPTIONS") return reply({}, 200, origin);
  if (request.method !== "POST" || !request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "Invalid request" }, 415, origin);
  if (Number(request.headers.get("content-length") || 0) > 6000) return reply({ error: "Request too large" }, 413, origin);
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) return reply({ error: "Invalid request" }, 400, origin);
  const siteSlug = typeof data.siteSlug === "string" ? data.siteSlug.trim() : "";
  const requestId = typeof data.requestId === "string" ? data.requestId.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(siteSlug) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return reply({ error: "Invalid site" }, 400, origin);

  const { data: site, error: siteError } = await db.from("member_websites")
    .select("id, user_id, site_slug, custom_domain, deployment_status")
    .eq("site_slug", siteSlug).eq("deployment_status", "published").maybeSingle();
  if (siteError || !site) return reply({ error: "Site unavailable" }, 404, origin);
  if (!allowedOrigin(origin, site)) return reply({ error: "Invalid origin" }, 403, origin);
  if (isBot(data)) return reply({ ok: true }, 200, origin);

  const parsed = parseInquiry(data);
  if (!parsed.ok) return reply({ error: "Check your contact details and hair-loss concern." }, 400, origin);
  const inquiry = parsed.inquiry;
  const siteUrl = originatingSiteUrl(site);

  const { data: prior } = await db.from(TABLE)
    .select("id, website_id, email_status, sms_status, first_name, last_name, phone, email, concern, notes")
    .eq("request_id", requestId).maybeSingle();
  if (prior && (prior.website_id !== site.id || !sameInquiry(inquiry, {
    firstName: prior.first_name, lastName: prior.last_name, phone: prior.phone, email: prior.email, concern: prior.concern, notes: prior.notes,
  }))) return reply({ error: "This request has changed. Please reload and try again." }, 409, origin);

  let lead = prior;
  if (!lead) {
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const [{ count: byEmail }, { count: bySite }] = await Promise.all([
      db.from(TABLE).select("id", { count: "exact", head: true }).eq("website_id", site.id).eq("email", inquiry.email).gte("created_at", hourAgo),
      db.from(TABLE).select("id", { count: "exact", head: true }).eq("website_id", site.id).gte("created_at", hourAgo),
    ]);
    if ((byEmail ?? 0) >= PER_EMAIL_HOURLY_LIMIT || (bySite ?? 0) >= PER_SITE_HOURLY_LIMIT) {
      return reply({ error: "Too many requests. Please contact the business directly." }, 429, origin);
    }
    const { data: inserted, error: insertError } = await db.from(TABLE).insert({
      request_id: requestId, website_id: site.id, member_id: site.user_id, origin_url: siteUrl,
      first_name: inquiry.firstName, last_name: inquiry.lastName, phone: inquiry.phone, email: inquiry.email,
      concern: inquiry.concern, notes: inquiry.notes,
    }).select("id, website_id, email_status, sms_status, first_name, last_name, phone, email, concern, notes").single();
    if (insertError?.code === "23505") return reply({ error: "This request is already being sent. Please wait a moment." }, 409, origin);
    if (insertError || !inserted) return reply({ error: "Request could not be saved. Please try again." }, 503, origin);
    lead = inserted;
  }

  const { emailSent, smsSent } = await notifyMember(lead!, site, inquiry, siteUrl);
  if (!emailSent || !smsSent) {
    return reply({ error: "Your inquiry was saved, but the business has not been notified yet. Please call the business if urgent." }, 503, origin);
  }
  return reply({ ok: true }, 200, origin);
});
