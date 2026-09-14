// Admin affiliate console: leads, reconciliation, corrections, payout receipts, setup.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  isAdmin,
  json,
  loadSettings,
  missingConfig,
  missingPayoutConfig,
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
        const [{ data: transfers }, { data: payoutAccounts }] = await Promise.all([
          db.from("affiliate_transfers").select("*").order("created_at", { ascending: false }).limit(300),
          db.from("affiliate_payout_accounts").select("*").order("updated_at", { ascending: false }).limit(300),
        ]);
        return json(
          {
            settings,
            missingConfig: missingConfig(settings),
            missingPayoutConfig: missingPayoutConfig(settings),
            affiliates: affiliates ?? [],
            referrals: referrals ?? [],
            payments: payments ?? [],
            commissions: commissions ?? [],
            payouts: payouts ?? [],
            transfers: transfers ?? [],
            payoutAccounts: payoutAccounts ?? [],
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

      case "verify_platform_transfers": {
        // Establishes the real funding/transfer path before any money is promised:
        // is the key's account a Connect platform, and can it fund transfers?
        const settings = await loadSettings(db);
        const key = Deno.env.get("STRIPE_SECRET_KEY");
        if (!key) return json({ error: "No server-side Stripe key is configured." }, 400, h);
        const headers = { Authorization: `Bearer ${key}` };

        const [accRes, listRes, balRes] = await Promise.all([
          fetch("https://api.stripe.com/v1/account", { headers }),
          fetch("https://api.stripe.com/v1/accounts?limit=1", { headers }),
          fetch("https://api.stripe.com/v1/balance", { headers }),
        ]);
        const account = await accRes.json().catch(() => ({}));
        const list = await listRes.json().catch(() => ({}));
        const balance = await balRes.json().catch(() => ({}));

        const platformId = String(account?.id ?? "");
        const isPlatform = listRes.ok && Array.isArray(list?.data);
        const connectedCount = Array.isArray(list?.data) ? list.data.length : 0;
        const transfersActive = account?.capabilities?.transfers === "active";
        const availableUsd = Number(
          (balance?.available ?? []).find((b: any) => String(b.currency).toLowerCase() === "usd")?.amount ?? 0,
        );
        const sellerMatches =
          !settings.expected_seller_account_id || platformId === settings.expected_seller_account_id;

        const verified = isPlatform && connectedCount > 0 && transfersActive && sellerMatches;
        const note = verified
          ? `Key belongs to platform ${platformId}, which has connected accounts and active transfers.`
          : !isPlatform
          ? "This Stripe key is not a Connect platform key, so it cannot transfer to connected accounts."
          : connectedCount === 0
          ? "This Stripe key is a platform but has no connected accounts yet."
          : !transfersActive
          ? "Transfers are not active on this Stripe account."
          : `Key belongs to ${platformId}, not the expected seller ${settings.expected_seller_account_id}.`;

        const next = {
          ...settings,
          platform_transfer_verified: verified,
          platform_transfer_checked_at: new Date().toISOString(),
          platform_transfer_note: note,
        };
        await db
          .from("affiliate_settings")
          .upsert({ key: "program", value: next, updated_at: new Date().toISOString(), updated_by: user.id });
        await audit("platform_transfer_checked", {
          details: { platformId, connectedCount, transfersActive, availableUsd, verified },
        });
        return json(
          {
            verified,
            note,
            platformId,
            availableUsdCents: availableUsd,
            settings: next,
            missingPayoutConfig: missingPayoutConfig(next as any),
          },
          200,
          h,
        );
      }

      case "run_dispatch": {
        const dryRun = body.dryRun !== false;
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/affiliate-transfer-dispatch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dryRun }),
        });
        const out = await res.json().catch(() => ({}));
        await audit("payout_dispatch_run", { details: { dryRun, ok: res.ok } });
        return json(out, res.ok ? 200 : 400, h);
      }

      case "retry_transfer":
      case "cancel_transfer": {
        const transferId = String(body.transferId ?? "");
        const reason = String(body.reason ?? "").trim();
        if (!transferId || !reason) return json({ error: "A transfer and a reason are required." }, 400, h);
        const { data: row } = await db
          .from("affiliate_transfers")
          .select("id, status")
          .eq("id", transferId)
          .maybeSingle();
        if (!row) return json({ error: "Transfer not found." }, 404, h);
        if (["sent", "paid"].includes(String(row.status))) {
          return json({ error: "This transfer already left the account and cannot be changed here." }, 400, h);
        }
        const next = action === "retry_transfer"
          ? { status: "queued", attempts: 0, next_attempt_at: new Date().toISOString(), failure_message: null }
          : { status: "canceled", failure_message: reason };
        await db.from("affiliate_transfers").update(next).eq("id", transferId);
        await audit(action, { details: { transferId, reason } });
        return json({ ok: true }, 200, h);
      }

      case "save_settings": {
        const incoming = { ...((body.settings ?? {}) as Record<string, unknown>) };
        // Verification facts are only ever written by the Stripe account check above.
        delete incoming.seller_account_confirmed;
        delete incoming.verified_stripe_account_id;
        delete incoming.verified_stripe_account_email;
        delete incoming.verified_stripe_account_at;
        delete incoming.platform_transfer_verified;
        delete incoming.platform_transfer_checked_at;
        delete incoming.platform_transfer_note;
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
