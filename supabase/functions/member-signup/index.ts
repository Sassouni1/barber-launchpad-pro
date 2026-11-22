// Purchase-first account creation for /create. Public sign-up is closed in auth
// settings; accounts are created here only after the checkout email matches a
// completed Barber Launch purchase or an explicit admin grant, or (no purchase)
// a live HighLevel read shows the exact member-access tag on a contact with this
// exact email in the approved location (tag-sourced grant only; see memberTagAccess). The only email
// sent is the standard sign-up confirmation (Cloud Auth). No other messages.
// Rate-limited per IP and per email; answers never reveal whether an account exists.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, rateLimit } from "../_shared/affiliate.ts";
import { normalizeEmailOrNull } from "../_shared/memberAccess.ts";
import { lookupQualifyingPurchase, safeSignupRedirect } from "../_shared/memberPurchaseLookup.ts";
import { hairSystemGhlAccess } from "../_shared/hairSystemGhlAccess.ts";
import { syncMemberTag, TAG_GRANT_SOURCE, tagEvidenceRef } from "../_shared/memberTagAccess.ts";

const VERSION = "member-signup/2026-11-22-v2";
const TAG_ALLOWS = new Set(["granted", "reinstated", "linked", "unchanged_active", "tag_only_check"]);
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ version: VERSION, ...body }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ ok: false, reason: "method_not_allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return reply({ ok: false, reason: "invalid_request" }, 400); }

  const action = body?.action === "create" ? "create" : body?.action === "check" ? "check" : null;
  const email = normalizeEmailOrNull(body?.email);
  if (!action || !email || email.length > 254) return reply({ ok: false, reason: "invalid_email" }, 400);

  const db = adminClient();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipOk = await rateLimit(db, `member-signup:ip:${ip}`, 10, 3600);
  const emailOk = ipOk && await rateLimit(db, `member-signup:email:${email}`, 6, 3600);
  if (!ipOk || !emailOk) return reply({ ok: false, reason: "rate_limited" }, 429);

  let password = "", firstName = "", lastName = "", phone = "";
  if (action === "create") {
    password = typeof body?.password === "string" ? body.password : "";
    firstName = clean(body?.firstName, 80);
    lastName = clean(body?.lastName, 80);
    phone = clean(body?.phone, 30);
    if (password.length < 8 || password.length > 72) return reply({ ok: false, reason: "weak_password" }, 400);
    if (!firstName || !lastName) return reply({ ok: false, reason: "name_required" }, 400);
  }

  const purchase = await lookupQualifyingPurchase(db, email);
  if (purchase.status === "unavailable") return reply({ ok: false, reason: "check_unavailable" }, 503);
  let via: "purchase" | "member_tag" = "purchase";
  if (purchase.status === "no_match") {
    // No purchase: check the HighLevel member-access tag (exact email, approved location).
    // "check" never creates a grant; a failed lookup never grants or revokes.
    const tag = await syncMemberTag(db, await hairSystemGhlAccess(db as any), { email, userId: null, allowGrant: action === "create" });
    if (tag.outcome === "unavailable") {
      console.warn("member-signup tag check unavailable", tag.reason);
      return reply({ ok: false, reason: "check_unavailable" }, 503);
    }
    if (!TAG_ALLOWS.has(tag.outcome)) return reply({ ok: false, reason: "no_purchase" });
    via = "member_tag";
  }
  if (action === "check") return reply({ ok: true, matched: true, via });

  // Record the verified purchase against the email (links to the account by email).
  if (purchase.status === "matched" && purchase.freshGrants.length) {
    const { error } = await db.from("member_access_grants")
      .upsert(purchase.freshGrants, { onConflict: "source,evidence_ref", ignoreDuplicates: true });
    if (error) return reply({ ok: false, reason: "check_unavailable" }, 500);
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email, password, email_confirm: false,
    user_metadata: { full_name: `${firstName} ${lastName}`.trim(), ...(phone ? { phone } : {}) },
  });
  const alreadyExists = Boolean(createErr) && /already|exists|registered/i.test(createErr?.message ?? "");
  if (createErr && !alreadyExists) {
    console.error("member-signup create failed", createErr.message);
    return reply({ ok: false, reason: "create_failed" }, 500);
  }
  if (created?.user && phone) {
    await db.from("profiles").update({ phone }).eq("id", created.user.id);
  }

  // Standard confirmation email (Cloud Auth "Confirm signup"). For an existing,
  // already-confirmed account this sends nothing; the answer stays the same.
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { error: resendErr } = await anon.auth.resend({
    type: "signup", email, options: { emailRedirectTo: safeSignupRedirect(body?.redirectTo) },
  });
  if (resendErr && created?.user) {
    console.error("member-signup confirmation failed", resendErr.message);
    await db.auth.admin.deleteUser(created.user.id);
    return reply({ ok: false, reason: /rate|seconds/i.test(resendErr.message) ? "rate_limited" : "confirmation_unavailable" }, 503);
  }
  if (via === "member_tag" && created?.user) {
    // Bind the tag grant to the new account only once the account is kept.
    const { error: linkErr } = await db.from("member_access_grants").update({ user_id: created.user.id })
      .eq("source", TAG_GRANT_SOURCE).eq("evidence_ref", tagEvidenceRef(email)).eq("status", "active").is("user_id", null);
    if (linkErr) console.error("member-signup tag grant link failed", linkErr.message);
  }
  return reply({ ok: true, status: "check_email" });
});
