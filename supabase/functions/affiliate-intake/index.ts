// Public affiliate referral intake. Saves the lead BEFORE the prospect leaves
// for a sales call or checkout, so a later call sale can still be attributed.
//
// Privacy note: this endpoint is anonymous. It never returns anything saved
// about an existing lead (name, phone, affiliate, status) and never returns a
// reusable reference to a referral record. Enrollment hand-off uses a
// short-lived, single-use checkout intent bound to THIS submission only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  isEmail,
  json,
  loadSettings,
  missingConfig,
  normalizeEmail,
  normalizePhone,
  randomToken,
  rateLimit,
  sha256,
} from "../_shared/affiliate.ts";

const CHECKOUT_INTENT_TTL_SECONDS = 900; // 15 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid request." }, 400, h);

    const action = String((body as any).action ?? "submit");
    const code = String((body as any).code ?? "").trim().toLowerCase();
    if (!code || code.length > 64) return json({ error: "Invalid referral link." }, 400, h);

    const settings = await loadSettings(db);
    const missing = missingConfig(settings);

    const { data: affiliate, error: affiliateError } = await db
      .from("affiliates")
      .select("id, code, display_name, status, contact_email")
      .eq("code", code)
      .maybeSingle();
    if (affiliateError) throw affiliateError;

    if (!affiliate || affiliate.status !== "active") {
      return json({ error: "This referral link is no longer active." }, 404, h);
    }

    if (action === "info") {
      return json(
        {
          affiliate: { code: affiliate.code, name: affiliate.display_name },
          callAvailable: Boolean(settings.sales_call_url),
          checkoutAvailable: missing.length === 0,
          setupMessage:
            missing.length === 0
              ? null
              : "Online enrollment checkout isn't switched on yet. Book a call and the Barber Launch team will take it from there.",
          terms: settings.terms_text,
        },
        200,
        h,
      );
    }

    if (action !== "submit") return json({ error: "Unsupported action." }, 400, h);

    const linkType = String((body as any).linkType ?? "");
    const intent = String((body as any).intent ?? ""); // 'call' | 'pay'
    if (!["call", "pay", "both"].includes(linkType)) return json({ error: "Invalid referral link." }, 400, h);
    if (!["call", "pay"].includes(intent)) return json({ error: "Choose a call or checkout." }, 400, h);

    const name = String((body as any).name ?? "").trim().slice(0, 120);
    const emailRaw = (body as any).email;
    const phone = String((body as any).phone ?? "").trim().slice(0, 40);
    if (!name) return json({ error: "Please enter your name." }, 400, h);
    if (!isEmail(emailRaw)) return json({ error: "Please enter a valid email address." }, 400, h);
    const email = normalizeEmail(emailRaw);
    const phoneNorm = normalizePhone(phone);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = await sha256(`${ip}|affiliate-intake`);
    if (!(await rateLimit(db, `ip:${ipHash}`, 12, 600))) {
      return json({ error: "Too many attempts. Please try again shortly." }, 429, h);
    }
    if (!(await rateLimit(db, `email:${await sha256(email)}`, 6, 600))) {
      return json({ error: "Too many attempts. Please try again shortly." }, 429, h);
    }

    // Self-referral guard: an affiliate cannot refer their own account email.
    if (affiliate.contact_email && normalizeEmail(affiliate.contact_email) === email) {
      return json({ error: "You can't refer yourself with your own link." }, 400, h);
    }

    // First established referral wins — never silently reassign. Void referrals
    // are matched too, so a voided lead can never be recreated as a fresh one.
    const { data: existing, error: existingError } = await db
      .from("affiliate_referrals")
      .select("id, affiliate_id, status")
      .eq("lead_email_normalized", email)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.status === "void") {
      return json({ error: "This referral link is no longer active." }, 403, h);
    }

    let referralId: string;

    if (existing) {
      referralId = existing.id as string;
      // Only touch activity fields. Saved identity stays as first submitted and
      // is never echoed back to whoever is on the page now.
      const { error: touchError } = await db
        .from("affiliate_referrals")
        .update({ last_seen_at: new Date().toISOString(), intent })
        .eq("id", referralId);
      if (touchError) throw touchError;
    } else {
      const { data: inserted, error } = await db
        .from("affiliate_referrals")
        .insert({
          affiliate_id: affiliate.id,
          link_type: linkType,
          lead_name: name,
          lead_email: String(emailRaw).trim(),
          lead_email_normalized: email,
          lead_phone: phone || null,
          lead_phone_normalized: phoneNorm,
          token_hash: await sha256(randomToken(24)),
          intent,
          ip_hash: ipHash,
          user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        })
        .select("id")
        .single();
      if (error) throw error;
      referralId = inserted.id as string;
    }

    if (intent === "call") {
      if (!settings.sales_call_url) {
        return json(
          { error: "The Barber Launch booking calendar isn't configured yet. Please try again soon." },
          503,
          h,
        );
      }
      // Truthful status: opening the calendar is a requested call, NOT a booking.
      // 'booked' is only ever set from a verified booking event.
      const { error: statusError } = await db
        .from("affiliate_referrals")
        .update({ status: "call_requested" })
        .eq("id", referralId)
        .eq("status", "lead");
      if (statusError) throw statusError;
      return json({ next: "call", url: settings.sales_call_url, saved: true }, 200, h);
    }

    // intent === 'pay'
    if (missing.length > 0) {
      return json(
        {
          next: "setup_incomplete",
          saved: true,
          message:
            "Online enrollment checkout isn't switched on yet, but your details are saved and credited to this referral. Book a call and the Barber Launch team will finish your enrollment.",
          callUrl: settings.sales_call_url,
        },
        200,
        h,
      );
    }

    // Short-lived, single-use checkout intent bound to this submission. The
    // referral id is never handed to the browser.
    const intentToken = randomToken(32);
    const { error: intentError } = await db.from("affiliate_checkout_intents").insert({
      referral_id: referralId,
      affiliate_id: existing ? (existing.affiliate_id as string) : (affiliate.id as string),
      token_hash: await sha256(intentToken),
      submitted_email_normalized: email,
      submitted_name: name,
      ip_hash: ipHash,
      expires_at: new Date(Date.now() + CHECKOUT_INTENT_TTL_SECONDS * 1000).toISOString(),
    });
    if (intentError) throw intentError;

    return json({ next: "checkout", saved: true, checkoutIntent: intentToken }, 200, h);
  } catch (error) {
    console.error("affiliate-intake failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong. Please try again." }, 500, { ...corsHeaders });
  }
});
