// Authenticated affiliate portal: own code, links and sanitized totals only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, json, loadSettings, missingConfig, newAffiliateCode, requireUser } from "../_shared/affiliate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const user = await requireUser(req, db);
    if (!user) return json({ error: "Please sign in." }, 401, h);

    const body = await req.json().catch(() => ({}));
    const action = String((body as any)?.action ?? "summary");

    let { data: affiliate } = await db
      .from("affiliates")
      .select("id, code, display_name, status, commission_rate, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!affiliate && action === "enroll") {
      const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
      for (let attempt = 0; attempt < 5 && !affiliate; attempt++) {
        const { data, error } = await db
          .from("affiliates")
          .insert({
            user_id: user.id,
            code: newAffiliateCode(profile?.full_name ?? user.email),
            display_name: profile?.full_name ?? null,
            contact_email: profile?.email ?? user.email ?? null,
          })
          .select("id, code, display_name, status, commission_rate, created_at")
          .maybeSingle();
        if (!error) affiliate = data;
      }
      if (!affiliate) return json({ error: "Could not create your affiliate account." }, 500, h);
    }

    if (!affiliate) return json({ enrolled: false }, 200, h);

    const settings = await loadSettings(db);

    const { data: totals } = await db.rpc("affiliate_totals", { _affiliate_id: affiliate.id });
    const t = Array.isArray(totals) ? totals[0] : totals;

    const { data: commissions } = await db
      .from("affiliate_commissions")
      .select("id, entry_type, source, amount_cents, currency, status, note, created_at")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: payouts } = await db
      .from("affiliate_payouts")
      .select("id, amount_cents, currency, method, external_reference, paid_at, note")
      .eq("affiliate_id", affiliate.id)
      .order("paid_at", { ascending: false })
      .limit(50);

    // Sanitized referral list — no lead contact details are exposed to affiliates.
    const { data: referrals } = await db
      .from("affiliate_referrals")
      .select("id, link_type, status, created_at")
      .eq("affiliate_id", affiliate.id)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(100);

    return json(
      {
        enrolled: true,
        affiliate: {
          code: affiliate.code,
          displayName: affiliate.display_name,
          status: affiliate.status,
          rate: Number(affiliate.commission_rate ?? 0.2),
        },
        totals: {
          referrals: Number(t?.referrals ?? 0),
          verifiedCents: Number(t?.verified_cents ?? 0),
          pendingCents: Number(t?.pending_cents ?? 0),
          paidCents: Number(t?.paid_cents ?? 0),
          adjustmentCents: Number(t?.adjustment_cents ?? 0),
        },
        commissions: commissions ?? [],
        payouts: payouts ?? [],
        referrals: (referrals ?? []).map((r) => ({
          id: r.id,
          linkType: r.link_type,
          status: r.status,
          createdAt: r.created_at,
        })),
        checkoutReady: missingConfig(settings).length === 0,
        terms: settings.terms_text,
      },
      200,
      h,
    );
  } catch (error) {
    console.error("affiliate-portal failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong." }, 500, { ...corsHeaders });
  }
});
