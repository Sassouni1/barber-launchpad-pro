// Automatic affiliate commission payouts over Stripe Connect.
//
// Two phases, both safe to run repeatedly:
//   1. enqueue  — one transfer row per verified commission (unique per commission),
//                 held from the authoritative payment time
//   2. dispatch — atomically reserve the payable balance per affiliate + currency
//                 + mode, then send the Stripe transfer
//
// Hard rules enforced here:
//   * test and live records are fully isolated and a record is never dispatched
//     with a key from the other world
//   * currency is part of every balance calculation
//   * balance reservation happens inside one SQL transaction with an advisory
//     lock, so two workers cannot overpay a partially refunded balance
//   * only the worker holding a row may write to it
//   * every database error is checked; an ambiguous Stripe outcome parks the row
//     for reconciliation instead of risking a second send
//   * configuration / balance / account-not-ready are holds that resume by
//     themselves — they never burn real retry attempts
//   * a dry run writes nothing at all
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  evaluateAccount,
  isAdmin,
  json,
  loadSettings,
  missingPayoutConfig,
  requireUser,
  stripeCall,
  stripeKeyLivemode,
} from "../_shared/affiliate.ts";
import { isAmbiguousTransfer } from "../_shared/affiliateWebhookLogic.ts";

const MAX_ATTEMPTS = 6;
const LOCK_STALE_SECONDS = 300;
const HOLD_MINUTES = 30;

function backoffMinutes(attempt: number) {
  return Math.min(6 * 60, Math.round(5 * Math.pow(3, Math.max(0, attempt - 1))));
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const h = { ...corsHeaders };

  try {
    const db = adminClient();
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const isService = token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isService) {
      const user = await requireUser(req, db);
      if (!user || !(await isAdmin(db, user.id))) return json({ error: "Admins only." }, 403, h);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Real money only moves when explicitly asked for, and only when setup is complete.
    const dryRun = body.dryRun !== false;
    const source = String(body.source ?? "manual");

    const settings = await loadSettings(db);

    // The recurring timer exists and calls this function, but every scheduled run
    // is a deliberate no-op until the master switch is turned on. Nothing is read
    // for dispatch, nothing is queued, nothing is written.
    if (source === "scheduler" && settings.scheduler_enabled !== true) {
      return json(
        {
          source,
          skipped: "scheduler_disabled",
          message: "The automatic payout schedule is switched off, so this run did nothing.",
        },
        200,
        h,
      );
    }
    const missing = missingPayoutConfig(settings);
    const workerId = crypto.randomUUID();

    // ---------- test / live isolation ----------
    const keyLivemode = stripeKeyLivemode();
    if (keyLivemode === null) {
      return json(
        { error: "The Stripe key is missing or unrecognisable, so nothing can be dispatched.", dryRun },
        503,
        h,
      );
    }
    const requested = typeof body.livemode === "boolean" ? (body.livemode as boolean) : keyLivemode;
    if (requested !== keyLivemode) {
      return json(
        {
          error:
            `Refusing to dispatch ${requested ? "live" : "test"} records with a ${keyLivemode ? "live" : "test"}-mode Stripe key.`,
          dryRun,
        },
        409,
        h,
      );
    }
    const livemode = keyLivemode;

    const results: Array<Record<string, unknown>> = [];

    // ---------- dry run: READ ONLY ----------
    // Nothing above this point writes. Enqueue, claim and every other write
    // happen only after this branch returns, so a dry run can never create,
    // change or reserve a row.
    if (dryRun) {
      const { data: preview, error: previewError } = await db
        .from("affiliate_transfers")
        .select("id, affiliate_id, amount_cents, currency, status, attempts, release_after, next_attempt_at, needs_reconciliation")
        .eq("livemode", livemode)
        .in("status", ["queued", "blocked", "processing"])
        .order("created_at", { ascending: true })
        .limit(50);
      if (previewError) throw new Error(`dry run read failed: ${previewError.message}`);

      // How many verified earnings have no transfer row yet — counted, not created.
      const { count: pendingEnqueue, error: countError } = await db
        .from("affiliate_commissions")
        .select("id", { count: "exact", head: true })
        .eq("entry_type", "earned")
        .eq("status", "verified")
        .eq("livemode", livemode)
        .gt("amount_cents", 0);
      if (countError) throw new Error(`dry run count failed: ${countError.message}`);

      return json(
        {
          dryRun: true,
          livemode,
          missingPayoutConfig: missing,
          wouldDispatch: missing.length === 0,
          enqueued: 0,
          verifiedEarnedCommissions: Number(pendingEnqueue ?? 0),
          queue: preview ?? [],
        },
        200,
        h,
      );
    }

    // ---------- phase 1: enqueue (writes start here) ----------
    // The hold clock starts at the verified payment time, handled in SQL.
    let enqueued = 0;
    if (settings.release_timing) {
      const { data: inserted, error: enqueueError } = await db.rpc("affiliate_transfer_enqueue", {
        _livemode: livemode,
        _release_timing: settings.release_timing,
        _delay_days: Number(settings.release_delay_days ?? 0),
        _limit: 200,
      });
      if (enqueueError) throw new Error(`enqueue failed: ${enqueueError.message}`);
      enqueued = Number(inserted ?? 0);
    }


    // Setup incomplete is a hold on the whole run — no row is touched, so no
    // real retry is consumed and everything resumes by itself once ready.
    if (missing.length > 0) {
      return json(
        { dryRun: false, livemode, missingPayoutConfig: missing, enqueued, dispatched: false, processed: [] },
        200,
        h,
      );
    }

    // ---------- phase 2: dispatch ----------
    const { data: claimedRows, error: claimError } = await db.rpc("affiliate_transfer_claim", {
      _worker: workerId,
      _livemode: livemode,
      _stale_seconds: LOCK_STALE_SECONDS,
      _limit: 25,
    });
    if (claimError) throw new Error(`claim failed: ${claimError.message}`);

    for (const tr of (claimedRows ?? []) as any[]) {
      const release = async (patch: Record<string, unknown>) => {
        const { data: ok, error } = await db.rpc("affiliate_transfer_release", {
          _id: tr.id,
          _worker: workerId,
          _patch: patch,
        });
        if (error) throw new Error(`release failed: ${error.message}`);
        return ok === true;
      };

      // Configuration, balance and account-readiness problems: resume later,
      // never consume a retry, never fail the job.
      const hold = async (kind: string, reason: string) => {
        const wrote = await release({
          status: "blocked",
          blocked_kind: kind,
          failure_message: reason,
          next_attempt_at: minutesFromNow(HOLD_MINUTES),
        });
        results.push({ id: tr.id, held: reason, kind, wrote });
      };

      // A genuine Stripe/processing failure: backoff, then give up after MAX.
      const retry = async (reason: string) => {
        const attempts = Number(tr.attempts ?? 0) + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        const wrote = await release({
          status: giveUp ? "failed" : "queued",
          attempts,
          blocked_kind: null,
          failure_message: reason,
          next_attempt_at: minutesFromNow(backoffMinutes(attempts)),
        });
        results.push({ id: tr.id, retryScheduled: !giveUp, reason, wrote });
      };

      const park = async (note: string, transferId?: string | null) => {
        // Lock-independent: an ambiguous outcome must be recorded even if this
        // worker has lost the row.
        const { error } = await db
          .from("affiliate_transfers")
          .update({
            needs_reconciliation: true,
            reconciliation_note: note,
            stripe_transfer_id: transferId ?? tr.stripe_transfer_id ?? null,
            locked_at: null,
            locked_by: null,
          })
          .eq("id", tr.id);
        if (error) console.error("could not park transfer for reconciliation", tr.id, error.message);
        results.push({ id: tr.id, needsReconciliation: note });
      };

      // Affiliate must still be in good standing.
      const { data: affiliate, error: affiliateError } = await db
        .from("affiliates")
        .select("id, status")
        .eq("id", tr.affiliate_id)
        .maybeSingle();
      if (affiliateError) throw new Error(`affiliate read failed: ${affiliateError.message}`);
      if (!affiliate || affiliate.status !== "active") {
        await hold("affiliate_inactive", "Waiting: this affiliate account is not active.");
        continue;
      }

      if (Number(tr.amount_cents) < Number(settings.minimum_transfer_cents ?? 0)) {
        await hold("below_minimum", "Waiting: below the minimum transfer amount.");
        continue;
      }

      // Idempotency keys expire, so an ambiguous or repeated job is reconciled
      // against Stripe's own record before anything else is sent.
      // Any persisted sign that this row was previously reserved, attempted or
      // parked forces a Stripe lookup first: an unknown Stripe success whose
      // database finalisation failed must never be sent a second time.
      const ambiguous = isAmbiguousTransfer(tr as never);
      if (ambiguous) {
        const group = tr.transfer_group ?? tr.idempotency_key;
        const found = await stripeCall(`/transfers?transfer_group=${encodeURIComponent(group)}&limit=5`);
        if (!found.ok) {
          await hold("reconcile_unavailable", "Waiting: Stripe could not be checked for an earlier attempt.");
          continue;
        }
        const existing = (found.data?.data ?? []).find((t: any) => t?.livemode === livemode);
        if (existing) {
          const wrote = await release({
            status: "sent",
            blocked_kind: null,
            stripe_transfer_id: existing.id,
            stripe_destination_payment_id: existing.destination_payment ?? null,
            destination_account_id: existing.destination ?? tr.destination_account_id ?? null,
            sent_at: new Date(Number(existing.created ?? Date.now() / 1000) * 1000).toISOString(),
            failure_message: null,
            needs_reconciliation: false,
          });
          if (!wrote) await park("Stripe already sent this transfer but the record could not be updated.", existing.id);
          else results.push({ id: tr.id, reconciled: existing.id });
          continue;
        }
      }

      // Destination account must be live-checked, not trusted from our cache.
      const { data: payoutAccount, error: payoutAccountError } = await db
        .from("affiliate_payout_accounts")
        .select("stripe_account_id")
        .eq("affiliate_id", tr.affiliate_id)
        .maybeSingle();
      if (payoutAccountError) throw new Error(`payout account read failed: ${payoutAccountError.message}`);
      const destination = payoutAccount?.stripe_account_id ?? tr.destination_account_id;
      if (!destination) {
        await hold("no_account", "Waiting: this affiliate has not connected a payout account yet.");
        continue;
      }
      const acct = await stripeCall(`/accounts/${destination}`);
      if (!acct.ok) {
        await hold("account_unreadable", "Waiting: Stripe could not read the destination account.");
        continue;
      }
      if (typeof acct.data?.livemode === "boolean" && acct.data.livemode !== livemode) {
        await hold("mode_mismatch", "Waiting: the destination account belongs to the other Stripe mode.");
        continue;
      }
      const ev = evaluateAccount(acct.data);
      if (!ev.eligible) {
        await hold("account_not_ready", ev.ineligibleReason ?? "Waiting: this account cannot receive transfers yet.");
        continue;
      }
      if (ev.defaultCurrency !== String(tr.currency).toLowerCase()) {
        await hold("currency_mismatch", "Waiting: the destination account pays out in a different currency.");
        continue;
      }

      // Funded-balance check on the platform account, in this exact currency.
      const balance = await stripeCall("/balance");
      const available = (balance.data?.available ?? []).find(
        (b: any) => String(b.currency).toLowerCase() === String(tr.currency).toLowerCase(),
      );
      if (!balance.ok || Number(available?.amount ?? 0) < Number(tr.amount_cents)) {
        await hold("funding", "Waiting for enough available balance in the Barber Launch Stripe account.");
        continue;
      }

      // Per-commission idempotency key plus a stable transfer group, so any
      // later ambiguity can be resolved against Stripe itself.
      const transfer = await stripeCall("/transfers", {
        idempotencyKey: tr.idempotency_key,
        body: {
          amount: tr.amount_cents,
          currency: tr.currency,
          destination,
          description: "Barber Launch affiliate commission",
          transfer_group: tr.transfer_group ?? tr.idempotency_key,
          "metadata[commission_id]": tr.commission_id,
          "metadata[affiliate_id]": tr.affiliate_id,
          "metadata[transfer_row_id]": tr.id,
        },
      });
      if (!transfer.ok) {
        // 5xx / network-shaped answers are ambiguous: the transfer may exist.
        if (transfer.status >= 500 || transfer.status === 0) {
          await park("Stripe did not confirm the result of this transfer; check Stripe before sending again.");
        } else {
          await retry(transfer.data?.error?.message ?? "Stripe rejected the transfer.");
        }
        continue;
      }
      if (typeof transfer.data?.livemode === "boolean" && transfer.data.livemode !== livemode) {
        await park("Stripe returned a transfer in the wrong mode; this must be reviewed before any further send.");
        continue;
      }

      const wrote = await release({
        status: "sent",
        blocked_kind: null,
        destination_account_id: destination,
        stripe_transfer_id: transfer.data.id,
        stripe_destination_payment_id: transfer.data.destination_payment ?? null,
        sent_at: new Date().toISOString(),
        failure_message: null,
        needs_reconciliation: false,
      });
      if (!wrote) {
        // Money left Stripe but our record could not be written: never resend.
        await park("The transfer was sent but the record could not be updated.", transfer.data.id);
        continue;
      }
      results.push({ id: tr.id, sent: transfer.data.id });
    }

    return json(
      { dryRun: false, livemode, missingPayoutConfig: missing, enqueued, dispatched: true, processed: results },
      200,
      h,
    );
  } catch (error) {
    console.error("affiliate-transfer-dispatch failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong." }, 500, { ...corsHeaders });
  }
});
