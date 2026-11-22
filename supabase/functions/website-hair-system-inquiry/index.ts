import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGhlAccess, normalizePhone, resolveContactId, sendGhlEmail, sendGhlSms } from "../_shared/ghlMessaging.ts";
import { RELAY_LOCATION_ID } from "../_shared/barberLaunchGhlRelay.ts";

const concerns = new Set(["Thinning hair", "Receding hairline", "Crown loss", "Bald spots", "Not sure yet"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);

function response(data: Record<string, unknown>, status: number, origin: string) {
  return Response.json(data, { status, headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  } });
}

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  const originUrl = (() => { try { return new URL(origin); } catch { return null; } })();
  if (!originUrl || originUrl.protocol !== "https:") return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (request.method === "OPTIONS") return response({}, 200, origin);
  if (request.method !== "POST" || !request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "Invalid request" }, 415, origin);
  if (Number(request.headers.get("content-length") || 0) > 6000) return response({ error: "Request too large" }, 413, origin);
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) return response({ error: "Invalid request" }, 400, origin);
  const siteSlug = clean(data.siteSlug, 64);
  const requestId = clean(data.requestId, 36);
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(siteSlug) || !/^[0-9a-f-]{36}$/i.test(requestId)) return response({ error: "Invalid site" }, 400, origin);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: site, error: siteError } = await supabase.from("member_websites")
    .select("id,user_id,site_slug,custom_domain,deployment_status")
    .eq("site_slug", siteSlug).eq("deployment_status", "published").maybeSingle();
  if (siteError || !site) return response({ error: "Site unavailable" }, 404, origin);
  const previewOrigin = `https://sites.thebarberlaunch.com`;
  const domainOrigin = site.custom_domain ? `https://${String(site.custom_domain).toLowerCase().replace(/^www\./, "")}` : "";
  const allowed = origin === previewOrigin || origin === domainOrigin || (domainOrigin && origin === domainOrigin.replace("https://", "https://www."));
  if (!allowed) return response({ error: "Invalid origin" }, 403, origin);
  if (clean(data.website, 100)) return response({ ok: true }, 200, origin);

  const firstName = clean(data.firstName, 60);
  const lastName = clean(data.lastName, 60);
  const phone = clean(data.phone, 30);
  const email = clean(data.email, 254);
  const concern = clean(data.concern, 80);
  const notes = clean(data.notes, 1000);
  if (!firstName || !lastName || !/^[+()\d\s.-]{10,30}$/.test(phone) || phone.replace(/\D/g, "").length < 10 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !concerns.has(concern) || data.service !== "Hair systems inquiry") {
    return response({ error: "Check your contact details and hair-loss concern." }, 400, origin);
  }

  const { data: prior } = await supabase.from("website_hair_system_inquiries")
    .select("id,email_status,sms_status,first_name,last_name,phone,email,concern,notes")
    .eq("request_id", requestId).eq("website_id", site.id).maybeSingle();
  if (prior && (prior.first_name !== firstName || prior.last_name !== lastName || prior.phone !== phone ||
    prior.email !== email || prior.concern !== concern || prior.notes !== notes)) {
    return response({ error: "This request has changed. Please reload and try again." }, 409, origin);
  }
  if (!prior) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from("website_hair_system_inquiries")
      .select("id", { count: "exact", head: true }).eq("website_id", site.id).eq("email", email).gte("created_at", oneHourAgo);
    if ((count || 0) >= 3) return response({ error: "Too many requests. Please contact the business directly." }, 429, origin);
  }
  const { data: lead, error: insertError } = prior ? { data: prior, error: null } : await supabase.from("website_hair_system_inquiries")
    .insert({ request_id: requestId, website_id: site.id, member_id: site.user_id,
      first_name: firstName, last_name: lastName, phone, email, concern, notes })
    .select("id,email_status,sms_status").single();
  if (insertError || !lead) return response({ error: "Request could not be saved. Please try again." }, 503, origin);

  const { data: profile } = await supabase.from("profiles").select("full_name,phone")
    .eq("id", site.user_id).maybeSingle();
  const { data: authUser } = await supabase.auth.admin.getUserById(site.user_id);
  const memberEmail = authUser.user?.email || "";
  const memberPhone = normalizePhone(clean(profile?.phone || authUser.user?.user_metadata?.phone || authUser.user?.phone, 30));
  if (!memberEmail || !memberPhone) return response({ error: "The site owner has no notification contact details. Your inquiry was saved." }, 503, origin);

  const access = await getGhlAccess(supabase);
  if ("error" in access || access.locationId !== RELAY_LOCATION_ID) return response({ error: "Notification service unavailable. Your inquiry was saved." }, 503, origin);
  const contactId = await resolveContactId(access, { email: memberEmail, phone: memberPhone, name: profile?.full_name });
  if (!contactId) return response({ error: "Notification service unavailable. Your inquiry was saved." }, 503, origin);

  const details = ["New hair-system inquiry", `Name: ${firstName} ${lastName}`, `Phone: ${phone}`, `Email: ${email}`,
    `Hair-loss concern: ${concern}`, `Notes: ${notes || "None"}`, `Site: ${siteSlug}`].join("\n");
  let emailSent = lead.email_status === "sent";
  let smsSent = lead.sms_status === "sent";
  if (!emailSent) {
    const result = await sendGhlEmail(access, { contactId, emailTo: memberEmail,
      subject: `New hair-system inquiry — ${siteSlug}`,
      html: `<div style="white-space:pre-line;font:16px/1.5 sans-serif">${escapeHtml(details)}</div>` });
    emailSent = result.ok;
    await supabase.from("website_hair_system_inquiries").update({ email_status: result.ok ? "sent" : "failed",
      email_provider_id: result.ok ? result.messageId : null }).eq("id", lead.id);
  }
  if (!smsSent) {
    const result = await sendGhlSms(access, { contactId, phone: memberPhone, message: details });
    smsSent = result.ok;
    await supabase.from("website_hair_system_inquiries").update({ sms_status: result.ok ? "sent" : "failed",
      sms_provider_id: result.ok ? result.messageId : null }).eq("id", lead.id);
  }
  if (!emailSent || !smsSent) return response({ error: "Your inquiry was saved, but notification delivery is pending. Please call the business if urgent." }, 503, origin);
  return response({ ok: true, emailSent, smsSent }, 200, origin);
});
