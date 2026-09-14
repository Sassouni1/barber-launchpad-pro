// Member-facing affiliate payout setup.
// Reuses the member's existing Stripe Connect account when it is genuinely able
// to receive transfers and bank payouts. Never creates a duplicate account and
// never treats charges_enabled alone as payout readiness.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  evaluateAccount,
  json,
  loadSettings,
  missingPayoutConfig,
  normalizePhone,
  requireUser,
  stripeCall,
} from "../_shared/affiliate.ts";

// Affiliate-only referral activity is marketing, not a barber service. We never
// mislabel it just to suppress Stripe questions.
const AFFILIATE_MCC = "7311"; // Advertising services
const AFFILIATE_DESCRIPTION =
  "Referral commissions earned for introducing new customers to Barber Launch training programs.";

/** Only prefill a legal name when it is unambiguous. Never guess a split. */
function splitName(fullName: string | null | undefined) {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return null;
  if (parts.some((p) => p.length < 2 || !/^[\p{L}'’-]+$/u.test(p))) return null;
  return { first: parts[0], last: parts[1] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const user = await requireUser(req, db);
    if (!user) return json({ error: "Please sign in." }, 401, h);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "status");

    const { data: affiliate } = await db
      .from("affiliates")
      .select("id, user_id, status")
      .eq("user_id", user.id)
      .maybeSingle();
    // Payout readiness is a member fact, not an affiliate fact. Content Rewards
    // members can read and set up payouts without enrolling as an affiliate, and
    // nobody is enrolled as a side effect of looking at this page.

    const settings = await loadSettings(db);
    const payoutSetup = missingPayoutConfig(settings);

    const { data: connect } = await db
      .from("barber_launch_stripe_accounts")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const respond = async (extra: Record<string, unknown> = {}) => {
      let account: Record<string, unknown> | null = null;
      if (connect?.stripe_account_id) {
        const res = await stripeCall(`/accounts/${connect.stripe_account_id}`);
        if (res.ok) {
          const ev = evaluateAccount(res.data);
          // Ownership is established by our own member→account mapping; we never
          // touch an account that is not mapped to this signed-in member.
          if (affiliate) await db.from("affiliate_payout_accounts").upsert(
            {
              affiliate_id: affiliate.id,
              user_id: user.id,
              stripe_account_id: ev.stripeAccountId,
              source: "existing_connect",
              country: ev.country,
              default_currency: ev.defaultCurrency,
              account_type: ev.accountType,
              charges_enabled: ev.chargesEnabled,
              payouts_enabled: ev.payoutsEnabled,
              details_submitted: ev.detailsSubmitted,
              transfers_capability: ev.transfersCapability,
              disabled_reason: ev.disabledReason,
              currently_due: ev.currentlyDue,
              pending_verification: ev.pendingVerification,
              external_account_last4: ev.bankLast4,
              external_account_bank_name: ev.bankName,
              eligible: ev.eligible,
              ineligible_reason: ev.ineligibleReason,
              checked_at: new Date().toISOString(),
            },
            { onConflict: "affiliate_id" },
          );
          account = {
            connected: true,
            eligible: ev.eligible,
            reason: ev.ineligibleReason,
            payoutsEnabled: ev.payoutsEnabled,
            transfers: ev.transfersCapability,
            country: ev.country,
            currency: ev.defaultCurrency,
            // Masked, and only what Stripe already returns to us.
            bank: ev.bankLast4 ? { last4: ev.bankLast4, name: ev.bankName } : null,
            needsInfo: ev.currentlyDue.length > 0,
            pendingVerification: ev.pendingVerification.length > 0,
          };
        }
      }
      if (!account) account = { connected: false, eligible: false };

      let transfers: unknown[] = [];
      if (affiliate) {
        const { data } = await db
          .from("affiliate_transfers")
          .select("id, amount_cents, currency, status, payout_status, sent_at, payout_arrival_at, failure_message, created_at")
          .eq("affiliate_id", affiliate.id)
          .order("created_at", { ascending: false })
          .limit(50);
        transfers = data ?? [];
      }

      return json(
        {
          account,
          transfers,
          autoPayoutsReady: payoutSetup.length === 0,
          payoutSetupMissing: payoutSetup,
          ...extra,
        },
        200,
        h,
      );
    };

    if (action === "status") return await respond();

    if (action === "start_onboarding") {
      const origin = req.headers.get("origin") || String(body.returnOrigin ?? "");
      if (!origin) return json({ error: "Missing origin." }, 400, h);

      // Return the member to the page they started from.
      const requested = String(body.returnPath ?? "");
      const returnPath = ["/affiliates", "/content-rewards"].includes(requested) ? requested : "/affiliates";

      let accountId = connect?.stripe_account_id ?? null;

      if (!accountId) {
        const { data: profile } = await db
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", user.id)
          .maybeSingle();

        const prefill: Record<string, unknown> = {
          type: "standard",
          email: profile?.email ?? user.email,
          business_type: "individual",
          "business_profile[mcc]": AFFILIATE_MCC,
          "business_profile[product_description]": AFFILIATE_DESCRIPTION,
          "metadata[user_id]": user.id,
          "metadata[app]": "barber_launch_affiliate",
        };
        // Only verified, member-supplied facts. Never a fabricated DOB, address or SSN.
        const name = splitName(profile?.full_name);
        if (name) {
          prefill["individual[first_name]"] = name.first;
          prefill["individual[last_name]"] = name.last;
        }
        if (profile?.email ?? user.email) prefill["individual[email]"] = profile?.email ?? user.email;
        const phone = normalizePhone(profile?.phone);
        if (phone && phone.length === 10) prefill["individual[phone]"] = `+1${phone}`;

        const created = await stripeCall("/accounts", { body: prefill });
        if (!created.ok) {
          return json({ error: created.data?.error?.message ?? "Stripe could not start setup." }, 400, h);
        }
        accountId = String(created.data.id);
        // Reuse the one member→account mapping the whole app already relies on.
        await db.from("barber_launch_stripe_accounts").insert({
          user_id: user.id,
          stripe_account_id: accountId,
          charges_enabled: Boolean(created.data.charges_enabled),
          payouts_enabled: Boolean(created.data.payouts_enabled),
          details_submitted: Boolean(created.data.details_submitted),
          onboarding_started_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        });
      }

      // Resume/return handling: Stripe asks only for what is still currently due.
      const link = await stripeCall("/account_links", {
        body: {
          account: accountId,
          refresh_url: `${origin}${returnPath}?payouts=refresh`,
          return_url: `${origin}${returnPath}?payouts=return`,
          type: "account_onboarding",
          "collection_options[fields]": "currently_due",
          "collection_options[future_requirements]": "omit",
        },
      });
      if (!link.ok) {
        return json({ error: link.data?.error?.message ?? "Stripe could not open setup." }, 400, h);
      }
      return json({ url: link.data.url }, 200, h);
    }

    return json({ error: "Unsupported action." }, 400, h);
  } catch (error) {
    console.error("affiliate-payouts failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong." }, 500, { ...corsHeaders });
  }
});
