// Public, gated hosted Stripe Checkout for Barber Launch enrollment.
// Refuses to run until the enrollment seller account, price and webhook are confirmed.
//
// Access is proved by a short-lived, single-use checkout intent issued by
// affiliate-intake for the current submission. Referral ids are never accepted
// from the browser, and redirect URLs are never taken from the request Origin.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  json,
  loadSettings,
  missingConfig,
  rateLimit,
  safeOrigin,
  sha256,
} from "../_shared/affiliate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const body = await req.json().catch(() => null);
    const intentToken = String((body as any)?.checkoutIntent ?? "").trim();
    if (!intentToken || intentToken.length > 200) {
      return json({ error: "This checkout link has expired. Please submit the form again." }, 400, h);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const ipHash = await sha256(`${ip}|affiliate-checkout`);
    if (!(await rateLimit(db, `checkout-ip:${ipHash}`, 10, 600))) {
      return json({ error: "Too many attempts. Please try again shortly." }, 429, h);
    }

    const settings = await loadSettings(db);
    const missing = missingConfig(settings);
    if (missing.length > 0) {
      return json({ error: "Enrollment checkout is not configured yet.", missing }, 503, h);
    }

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json({ error: "Payment processing is not configured." }, 503, h);

    const tokenHash = await sha256(intentToken);
    const { data: intent, error: intentError } = await db
      .from("affiliate_checkout_intents")
      .select(
        "id, referral_id, affiliate_id, submitted_email_normalized, submitted_name, expires_at, consumed_at, stripe_session_id, stripe_session_url",
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (intentError) throw intentError;
    if (!intent || new Date(intent.expires_at as string).getTime() < Date.now()) {
      return json({ error: "This checkout link has expired. Please submit the form again." }, 410, h);
    }

    // Idempotent: the same intent always returns the same Stripe session.
    if (intent.stripe_session_url) {
      return json({ url: intent.stripe_session_url }, 200, h);
    }

    const { data: referral, error: referralError } = await db
      .from("affiliate_referrals")
      .select("id, affiliate_id, lead_email, lead_name, status")
      .eq("id", intent.referral_id as string)
      .maybeSingle();
    if (referralError) throw referralError;
    if (!referral) return json({ error: "Referral not found." }, 404, h);
    if (referral.status === "void") {
      return json({ error: "This referral link is no longer active." }, 403, h);
    }

    const { data: affiliate, error: affiliateError } = await db
      .from("affiliates")
      .select("id, code, status")
      .eq("id", referral.affiliate_id)
      .maybeSingle();
    if (affiliateError) throw affiliateError;
    if (!affiliate || affiliate.status !== "active") {
      return json({ error: "This referral link is no longer active." }, 403, h);
    }

    const origin = safeOrigin(req);
    const priceId = settings.enrollment_price_ids[0];

    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/refer/${affiliate.code}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/refer/${affiliate.code}/both`,
      client_reference_id: referral.id as string,
      // The email collected in THIS submission, never the stored lead record.
      customer_email: intent.submitted_email_normalized as string,
      "metadata[affiliate_id]": affiliate.id as string,
      "metadata[affiliate_code]": affiliate.code as string,
      "metadata[referral_id]": referral.id as string,
      "metadata[checkout_intent_id]": intent.id as string,
      "payment_intent_data[metadata][affiliate_id]": affiliate.id as string,
      "payment_intent_data[metadata][referral_id]": referral.id as string,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // One Stripe session per intent, even if the browser retries.
        "Idempotency-Key": `aff_co_${intent.id}`,
      },
      body: form,
    });
    const session = await res.json();
    if (!res.ok) {
      console.error("stripe checkout session failed", session?.error?.code ?? res.status);
      return json({ error: "Could not start checkout. Please try again." }, 502, h);
    }

    const { error: saveError } = await db
      .from("affiliate_checkout_intents")
      .update({
        stripe_session_id: session.id ?? null,
        stripe_session_url: session.url ?? null,
        consumed_at: new Date().toISOString(),
      })
      .eq("id", intent.id as string);
    if (saveError) throw saveError;

    // A converted referral keeps its status — a repeat visit never downgrades it.
    if (referral.status !== "converted") {
      const { error: statusError } = await db
        .from("affiliate_referrals")
        .update({ status: "checkout_started", last_seen_at: new Date().toISOString() })
        .eq("id", referral.id)
        .neq("status", "converted");
      if (statusError) throw statusError;
    }

    return json({ url: session.url }, 200, h);
  } catch (error) {
    console.error("affiliate-checkout failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong. Please try again." }, 500, { ...corsHeaders });
  }
});
