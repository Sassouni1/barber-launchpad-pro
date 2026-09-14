// Admin affiliate console: leads, reconciliation, corrections, payout receipts, setup.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  isAdmin,
  json,
  loadSettings,
  missingConfig,
  requireUser,
} from "../_shared/affiliate.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const user = await requireUser(req, db);
    if (!user) return json({ error: "Please sign in." }, 401, h);
    if (!(await isAdmin(db, user.id))) return json({ error: "Admins only." }, 403, h);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "overview");

    const audit = (action: string, extra: Record<string, unknown>) =>
      db.from("affiliate_admin_audit").insert({ actor_id: user.id, action, ...extra });

    switch (action) {
      case "overview": {
        const settings = await loadSettings(db);
        const [{ data: affiliates }, { data: referrals }, { data: payments }, { data: commissions }, { data: payouts }] =
          await Promise.all([
            db.from("affiliates").select("*").order("created_at", { ascending: false }),
            db
              .from("affiliate_referrals")
              .select("id, affiliate_id, link_type, status, lead_name, lead_email, lead_phone, created_at, last_seen_at")
              .order("created_at", { ascending: false })
              .limit(500),
            db
              .from("affiliate_payments")
              .select("*")
              .order("paid_at", { ascending: false })
              .limit(500),
            db.from("affiliate_commissions").select("*").order("created_at", { ascending: false }).limit(500),
            db.from("affiliate_payouts").select("*").order("paid_at", { ascending: false }).limit(200),
          ]);
        return json(
          {
            settings,
            missingConfig: missingConfig(settings),
            affiliates: affiliates ?? [],
            referrals: referrals ?? [],
            payments: payments ?? [],
            commissions: commissions ?? [],
            payouts: payouts ?? [],
          },
          200,
          h,
        );
      }

      case "verify_seller_account": {
        // Asks Stripe which account the configured server-side key belongs to and
        // compares it with the expected Barber Launch enrollment seller. No charges.
        const settings = await loadSettings(db);
        const expected = String(body.expectedAccountId ?? settings.expected_seller_account_id ?? "").trim();
        if (!expected) return json({ error: "Set the expected seller account id first." }, 400, h);

        const key = Deno.env.get("STRIPE_SECRET_KEY");
        if (!key) return json({ error: "No server-side Stripe key is configured." }, 400, h);

        const res = await fetch("https://api.stripe.com/v1/account", {
          headers: { Authorization: `Bearer ${key}` },
        });
        const account = await res.json().catch(() => ({}));
        if (!res.ok) {
          return json({ error: account?.error?.message ?? "Stripe rejected the account lookup." }, 400, h);
        }

        const actualId = String(account.id ?? "");
        const actualEmail = account.email ?? null;
        const matches = actualId === expected;
        const next = {
          ...settings,
          expected_seller_account_id: expected,
          verified_stripe_account_id: actualId,
          verified_stripe_account_email: actualEmail,
          verified_stripe_account_at: new Date().toISOString(),
          seller_account_confirmed: matches,
        };
        await db
          .from("affiliate_settings")
          .upsert({ key: "program", value: next, updated_at: new Date().toISOString(), updated_by: user.id });
        await audit("seller_account_checked", {
          details: { expected, actual: actualId, matches, livemode: account.charges_enabled ?? null },
        });
        return json(
          {
            matches,
            accountId: actualId,
            accountEmail: actualEmail,
            settings: next,
            missingConfig: missingConfig(next as any),
          },
          200,
          h,
        );
      }

      case "save_settings": {
        const incoming = (body.settings ?? {}) as Record<string, unknown>;
        const current = await loadSettings(db);
        const next = {
          ...current,
          ...incoming,
          enrollment_price_ids: Array.isArray(incoming.enrollment_price_ids)
            ? (incoming.enrollment_price_ids as string[]).map(String).filter(Boolean)
            : current.enrollment_price_ids,
        };
        await db
          .from("affiliate_settings")
          .upsert({ key: "program", value: next, updated_at: new Date().toISOString(), updated_by: user.id });
        await audit("settings_updated", { details: { keys: Object.keys(incoming) } });
        return json({ settings: next, missingConfig: missingConfig(next as any) }, 200, h);
      }

      case "set_status": {
        const affiliateId = String(body.affiliateId ?? "");
        const status = String(body.status ?? "");
        if (!affiliateId || !["active", "suspended"].includes(status)) {
          return json({ error: "Invalid request." }, 400, h);
        }
        await db
          .from("affiliates")
          .update({ status, suspended_at: status === "suspended" ? new Date().toISOString() : null })
          .eq("id", affiliateId);
        await audit("affiliate_status_changed", { affiliate_id: affiliateId, details: { status } });
        return json({ ok: true }, 200, h);
      }

      case "reassign_referral": {
        // Audited dispute correction — never silent.
        const referralId = String(body.referralId ?? "");
        const affiliateId = String(body.affiliateId ?? "");
        const reason = String(body.reason ?? "").trim();
        if (!referralId || !affiliateId || !reason) {
          return json({ error: "A referral, an affiliate and a reason are all required." }, 400, h);
        }
        const { data: before } = await db
          .from("affiliate_referrals")
          .select("affiliate_id")
          .eq("id", referralId)
          .maybeSingle();
        await db.from("affiliate_referrals").update({ affiliate_id: affiliateId }).eq("id", referralId);
        await audit("referral_reassigned", {
          referral_id: referralId,
          affiliate_id: affiliateId,
          details: { from: before?.affiliate_id ?? null, reason },
        });
        return json({ ok: true }, 200, h);
      }

      case "reconcile_payment": {
        // Match a verified Stripe payment record to a referral. Real payment proof only.
        const paymentId = String(body.paymentId ?? "");
        const referralId = String(body.referralId ?? "");
        const reason = String(body.reason ?? "").trim();
        if (!paymentId || !referralId || !reason) {
          return json({ error: "A payment, a referral and a reason are all required." }, 400, h);
        }
        const { data: payment } = await db
          .from("affiliate_payments")
          .select("*")
          .eq("id", paymentId)
          .maybeSingle();
        const { data: referral } = await db
          .from("affiliate_referrals")
          .select("id, affiliate_id")
          .eq("id", referralId)
          .maybeSingle();
        if (!payment || !referral) return json({ error: "Payment or referral not found." }, 404, h);
        if (!payment.stripe_object_id || !payment.price_id) {
          return json({ error: "This payment has no verified product record and cannot be matched." }, 400, h);
        }

        const settings = await loadSettings(db);
        if (!settings.enrollment_price_ids.includes(payment.price_id)) {
          return json({ error: "This payment is not for an approved enrollment price." }, 400, h);
        }

        await db
          .from("affiliate_payments")
          .update({ referral_id: referral.id, affiliate_id: referral.affiliate_id, matched_by: "admin", matched_by_admin: user.id })
          .eq("id", paymentId);

        const { data: existing } = await db
          .from("affiliate_commissions")
          .select("id")
          .eq("payment_id", paymentId)
          .eq("entry_type", "earned")
          .maybeSingle();

        if (!existing) {
          const eligible = Number(payment.eligible_amount_cents ?? 0) - Number(payment.refunded_amount_cents ?? 0);
          if (eligible > 0) {
            await db.from("affiliate_commissions").insert({
              affiliate_id: referral.affiliate_id,
              referral_id: referral.id,
              payment_id: paymentId,
              entry_type: "earned",
              amount_cents: Math.round(eligible * 0.2),
              currency: payment.currency,
              basis_amount_cents: eligible,
              rate: 0.2,
              status: "verified",
              livemode: payment.livemode,
              note: "Admin reconciliation",
              created_by: user.id,
            });
          }
        }
        await audit("payment_reconciled", {
          payment_id: paymentId,
          referral_id: referralId,
          affiliate_id: referral.affiliate_id,
          details: { reason },
        });
        return json({ ok: true }, 200, h);
      }

      case "manual_adjustment": {
        const affiliateId = String(body.affiliateId ?? "");
        const amountCents = Math.round(Number(body.amountCents ?? 0));
        const note = String(body.note ?? "").trim();
        if (!affiliateId || !Number.isFinite(amountCents) || amountCents === 0 || !note) {
          return json({ error: "An affiliate, a non-zero amount and a note are all required." }, 400, h);
        }
        await db.from("affiliate_commissions").insert({
          affiliate_id: affiliateId,
          entry_type: "manual",
          amount_cents: amountCents,
          status: "verified",
          note,
          created_by: user.id,
        });
        await audit("manual_adjustment", { affiliate_id: affiliateId, details: { amountCents, note } });
        return json({ ok: true }, 200, h);
      }

      case "record_payout": {
        // Records an already-completed external payout receipt. Moves no money.
        const affiliateId = String(body.affiliateId ?? "");
        const amountCents = Math.round(Number(body.amountCents ?? 0));
        const method = String(body.method ?? "").trim();
        const reference = String(body.reference ?? "").trim();
        if (!affiliateId || amountCents <= 0 || !method || !reference) {
          return json({ error: "Affiliate, amount, method and reference are all required." }, 400, h);
        }
        await db.from("affiliate_payouts").insert({
          affiliate_id: affiliateId,
          amount_cents: amountCents,
          method,
          external_reference: reference,
          note: String(body.note ?? "").trim() || null,
          recorded_by: user.id,
        });
        await audit("payout_recorded", { affiliate_id: affiliateId, details: { amountCents, method, reference } });
        return json({ ok: true }, 200, h);
      }

      default:
        return json({ error: "Unsupported action." }, 400, h);
    }
  } catch (error) {
    console.error("affiliate-admin failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong." }, 500, { ...corsHeaders });
  }
});
