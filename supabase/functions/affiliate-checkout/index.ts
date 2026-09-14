// Public, gated hosted Stripe Checkout for Barber Launch enrollment.
// Refuses to run until the enrollment seller account, price and webhook are confirmed.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, json, loadSettings, missingConfig } from "../_shared/affiliate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const body = await req.json().catch(() => null);
    const referralRef = String((body as any)?.referralRef ?? "");
    if (!referralRef) return json({ error: "Missing referral reference." }, 400, h);

    const settings = await loadSettings(db);
    const missing = missingConfig(settings);
    if (missing.length > 0) {
      return json({ error: "Enrollment checkout is not configured yet.", missing }, 503, h);
    }

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return json({ error: "Payment processing is not configured." }, 503, h);

    const { data: referral } = await db
      .from("affiliate_referrals")
      .select("id, affiliate_id, lead_email, lead_name")
      .eq("id", referralRef)
      .maybeSingle();
    if (!referral) return json({ error: "Referral not found." }, 404, h);

    const { data: affiliate } = await db
      .from("affiliates")
      .select("id, code, status")
      .eq("id", referral.affiliate_id)
      .maybeSingle();
    if (!affiliate || affiliate.status !== "active") {
      return json({ error: "This referral link is no longer active." }, 403, h);
    }

    const origin = req.headers.get("origin") ?? "https://member.thebarberlaunch.com";
    const priceId = settings.enrollment_price_ids[0];

    const form = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/refer/${affiliate.code}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/refer/${affiliate.code}/both`,
      client_reference_id: referral.id as string,
      customer_email: referral.lead_email as string,
      "metadata[affiliate_id]": affiliate.id as string,
      "metadata[affiliate_code]": affiliate.code as string,
      "metadata[referral_id]": referral.id as string,
      "payment_intent_data[metadata][affiliate_id]": affiliate.id as string,
      "payment_intent_data[metadata][referral_id]": referral.id as string,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const session = await res.json();
    if (!res.ok) {
      console.error("stripe checkout session failed", session?.error?.code ?? res.status);
      return json({ error: "Could not start checkout. Please try again." }, 502, h);
    }

    await db
      .from("affiliate_referrals")
      .update({ status: "checkout_started", last_seen_at: new Date().toISOString() })
      .eq("id", referral.id);

    return json({ url: session.url }, 200, h);
  } catch (error) {
    console.error("affiliate-checkout failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong. Please try again." }, 500, { ...corsHeaders });
  }
});
