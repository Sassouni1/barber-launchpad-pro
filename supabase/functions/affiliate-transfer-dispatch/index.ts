// Automatic affiliate commission payouts over Stripe Connect.
//
// Two phases, both safe to run repeatedly:
//   1. enqueue  — one transfer row per verified commission (unique per commission)
//   2. dispatch — claim due rows, send the Stripe transfer with a per-commission
//                 idempotency key, retry with backoff, block on ineligible accounts
//
// Nothing is sent unless setup is complete AND the platform transfer path has
// been verified. Dry run is the default so this can be exercised without money
// moving.
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
} from "../_shared/affiliate.ts";

const MAX_ATTEMPTS = 6;
const LOCK_STALE_MS = 5 * 60 * 1000;

function backoffMinutes(attempt: number) {
  return Math.min(6 * 60, Math.round(5 * Math.pow(3, Math.max(0, attempt - 1))));
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

    const settings = await loadSettings(db);
    const missing = missingPayoutConfig(settings);
    const workerId = crypto.randomUUID();

    // ---------- phase 1: enqueue ----------
    const { data: commissions } = await db
      .from("affiliate_commissions")
      .select("id, affiliate_id, amount_cents, currency, status, entry_type, livemode, created_at")
      .eq("entry_type", "earned")
      .eq("status", "verified")
      .gt("amount_cents", 0)
      .order("created_at", { ascending: true })
      .limit(200);

    const enqueued: string[] = [];
    for (const c of commissions ?? []) {
      const { data: existing } = await db
        .from("affiliate_transfers")
        .select("id")
        .eq("commission_id", c.id)
        .maybeSingle();
      if (existing) continue;

      const delayDays = settings.release_timing === "after_days" ? Number(settings.release_delay_days ?? 0) : 0;
      const releaseAfter = new Date(new Date(c.created_at).getTime() + delayDays * 86_400_000).toISOString();

      const { error } = await db.from("affiliate_transfers").insert({
        affiliate_id: c.affiliate_id,
        commission_id: c.id,
        amount_cents: c.amount_cents,
        currency: c.currency,
        idempotency_key: `aff_tr_${c.id}`,
        release_after: releaseAfter,
        next_attempt_at: releaseAfter,
        livemode: c.livemode,
      });
      if (!error) enqueued.push(c.id);
    }

    // ---------- phase 2: dispatch ----------
    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - LOCK_STALE_MS).toISOString();

    const { data: due } = await db
      .from("affiliate_transfers")
      .select("*")
      .in("status", ["queued", "processing"])
      .lte("next_attempt_at", nowIso)
      .lte("release_after", nowIso)
      .order("created_at", { ascending: true })
      .limit(25);

    const results: Array<Record<string, unknown>> = [];

    for (const tr of due ?? []) {
      // Concurrent-worker protection: only one worker may hold a row at a time.
      if (tr.locked_at && tr.locked_at > staleIso) {
        results.push({ id: tr.id, skipped: "locked by another worker" });
        continue;
      }
      const { data: claimed } = await db
        .from("affiliate_transfers")
        .update({ status: "processing", locked_at: nowIso, locked_by: workerId })
        .eq("id", tr.id)
        .in("status", ["queued", "processing"])
        .or(`locked_at.is.null,locked_at.lte.${staleIso}`)
        .select("id")
        .maybeSingle();
      if (!claimed) {
        results.push({ id: tr.id, skipped: "claimed by another worker" });
        continue;
      }

      const release = async (patch: Record<string, unknown>) => {
        await db
          .from("affiliate_transfers")
          .update({ locked_at: null, locked_by: null, ...patch })
          .eq("id", tr.id);
      };

      const defer = async (reason: string, blocked = false) => {
        const attempts = Number(tr.attempts ?? 0) + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        await release({
          status: blocked ? "blocked" : giveUp ? "failed" : "queued",
          attempts,
          failure_message: reason,
          next_attempt_at: new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
        });
        results.push({ id: tr.id, deferred: reason, blocked });
      };

      if (missing.length > 0) {
        await defer(`Automatic payouts are not configured yet: ${missing.join("; ")}`);
        continue;
      }

      // Affiliate must still be in good standing.
      const { data: affiliate } = await db
        .from("affiliates")
        .select("id, status")
        .eq("id", tr.affiliate_id)
        .maybeSingle();
      if (!affiliate || affiliate.status !== "active") {
        await defer("Affiliate account is not active.", true);
        continue;
      }

      // Net-balance check: refunds and disputes must not be paid out.
      const { data: ledger } = await db
        .from("affiliate_commissions")
        .select("amount_cents")
        .eq("affiliate_id", tr.affiliate_id)
        .eq("status", "verified")
        .neq("entry_type", "payout");
      const netOwed = (ledger ?? []).reduce((s, e) => s + Number(e.amount_cents ?? 0), 0);
      const { data: alreadySent } = await db
        .from("affiliate_transfers")
        .select("amount_cents")
        .eq("affiliate_id", tr.affiliate_id)
        .in("status", ["sent", "paid"]);
      const sentTotal = (alreadySent ?? []).reduce((s, e) => s + Number(e.amount_cents ?? 0), 0);
      if (netOwed - sentTotal < Number(tr.amount_cents)) {
        await defer("Balance owed is lower than this commission (refund or dispute adjustment).");
        continue;
      }
      if (Number(tr.amount_cents) < Number(settings.minimum_transfer_cents ?? 0)) {
        await defer("Below the minimum transfer amount.");
        continue;
      }

      // Destination account must be live-checked, not trusted from our cache.
      const { data: payoutAccount } = await db
        .from("affiliate_payout_accounts")
        .select("stripe_account_id")
        .eq("affiliate_id", tr.affiliate_id)
        .maybeSingle();
      const destination = payoutAccount?.stripe_account_id ?? tr.destination_account_id;
      if (!destination) {
        await defer("This affiliate has no connected payout account yet.", true);
        continue;
      }
      const acct = await stripeCall(`/accounts/${destination}`);
      if (!acct.ok) {
        await defer("Stripe could not read the destination account.");
        continue;
      }
      const ev = evaluateAccount(acct.data);
      if (!ev.eligible) {
        await defer(ev.ineligibleReason ?? "Destination account cannot receive transfers.", true);
        continue;
      }
      if (ev.defaultCurrency !== String(tr.currency).toLowerCase()) {
        await defer("Destination account currency does not match the commission.", true);
        continue;
      }

      // Funded-balance check on the platform account.
      const balance = await stripeCall("/balance");
      const available = (balance.data?.available ?? []).find(
        (b: any) => String(b.currency).toLowerCase() === String(tr.currency).toLowerCase(),
      );
      if (!balance.ok || Number(available?.amount ?? 0) < Number(tr.amount_cents)) {
        await defer("Waiting for enough available balance in the Barber Launch Stripe account.");
        continue;
      }

      if (dryRun) {
        await release({ status: "queued", destination_account_id: destination, failure_message: null });
        results.push({ id: tr.id, dryRun: true, wouldSend: tr.amount_cents, destination });
        continue;
      }

      // Per-commission idempotency key: a retry can never double-pay.
      const transfer = await stripeCall("/transfers", {
        idempotencyKey: tr.idempotency_key,
        body: {
          amount: tr.amount_cents,
          currency: tr.currency,
          destination,
          description: "Barber Launch affiliate commission",
          "metadata[commission_id]": tr.commission_id,
          "metadata[affiliate_id]": tr.affiliate_id,
        },
      });
      if (!transfer.ok) {
        await defer(transfer.data?.error?.message ?? "Stripe rejected the transfer.");
        continue;
      }

      await release({
        status: "sent",
        destination_account_id: destination,
        stripe_transfer_id: transfer.data.id,
        stripe_destination_payment_id: transfer.data.destination_payment ?? null,
        sent_at: new Date().toISOString(),
        failure_message: null,
      });
      results.push({ id: tr.id, sent: transfer.data.id });
    }

    return json({ dryRun, missingPayoutConfig: missing, enqueued: enqueued.length, processed: results }, 200, h);
  } catch (error) {
    console.error("affiliate-transfer-dispatch failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong." }, 500, { ...corsHeaders });
  }
});
