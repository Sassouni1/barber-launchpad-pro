// TEMPORARY QA-ONLY function (test mode): isolated Stripe TEST-MODE verification of the
// affiliate flow. It never touches the live key, never moves real money and is
// deleted once the verification run is reported.
//
// Guarded by a single-purpose bearer token held in server-side secrets.
import { adminClient, evaluateAccount, json, stripeCall, testStripeSecret } from "../_shared/affiliate.ts";
import { AFFILIATE_TEST_CONNECT_WEBHOOK_SECRET_NAME, AFFILIATE_TEST_WEBHOOK_SECRET_NAME, writeAffiliateWebhookSecret } from "../_shared/affiliateVault.ts";

const WEBHOOK_URL = "https://ynooatjtgstgwfssnira.supabase.co/functions/v1/affiliate-stripe-webhook";
const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.closed",
  "transfer.created",
  "transfer.updated",
  "transfer.reversed",
  "payout.paid",
  "payout.failed",
];

const QA_EMAIL = "qa-testmode-affiliate@example.com";
const QA_LEAD_EMAIL = "qa-testmode-lead@example.com";

Deno.serve(async (req) => {
  const token = (req.headers.get("x-qa-token") ?? "").trim();
  const expected = Deno.env.get("AFFILIATE_QA_TOKEN") ?? "";
  if (!expected || token !== expected) return json({ error: "Forbidden" }, 403);

  const secret = testStripeSecret();
  if (!secret) return json({ error: "No isolated test-mode Stripe key is configured." }, 503);

  const db = adminClient();
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const action = String(body.action ?? "");
  const call = (path: string, opts: Record<string, unknown> = {}) => stripeCall(path, { ...opts, secret });

  try {
    switch (action) {
      case "identity": {
        const acct = await call("/account");
        return json({
          ok: acct.ok,
          id: acct.data?.id,
          livemode: acct.data?.livemode,
          business_name: acct.data?.business_profile?.name ?? acct.data?.settings?.dashboard?.display_name ?? null,
          email: acct.data?.email,
          country: acct.data?.country,
          currency: acct.data?.default_currency,
        });
      }

      case "setup": {
        const product = await call("/products", {
          body: { name: "QA TEST — Barber Launch Hair System Mastery & Marketing", "metadata[qa]": "affiliate-testmode" },
        });
        if (!product.ok) return json({ step: "product", error: product.data }, 502);
        const price = await call("/prices", {
          body: {
            product: product.data.id,
            unit_amount: 300000,
            currency: "usd",
            "metadata[qa]": "affiliate-testmode",
          },
        });
        if (!price.ok) return json({ step: "price", error: price.data }, 502);

        const endpoint = await call("/webhook_endpoints", {
          body: Object.fromEntries([
            ["url", WEBHOOK_URL],
            ["description", "QA test-mode affiliate events"],
            ...EVENTS.map((e, i) => [`enabled_events[${i}]`, e] as [string, string]),
          ]),
        });
        if (!endpoint.ok) return json({ step: "webhook", error: endpoint.data }, 502);
        await writeAffiliateWebhookSecret(String(endpoint.data.secret), AFFILIATE_TEST_WEBHOOK_SECRET_NAME);

        // Approve the QA price for commission, additively.
        const { data: row } = await db.from("affiliate_settings").select("value").eq("key", "program").maybeSingle();
        const value = (row?.value ?? {}) as Record<string, unknown>;
        const ids = new Set([...(value.enrollment_price_ids as string[] ?? []), price.data.id]);
        const { error } = await db
          .from("affiliate_settings")
          .update({ value: { ...value, enrollment_price_ids: [...ids] } })
          .eq("key", "program");
        if (error) return json({ step: "settings", error: error.message }, 500);

        return json({
          productId: product.data.id,
          priceId: price.data.id,
          webhookEndpointId: endpoint.data.id,
          webhookLivemode: endpoint.data.livemode,
          enrollmentPriceIds: [...ids],
        });
      }

      case "seed": {
        // Synthetic QA identities only.
        const { data: created, error: userError } = await db.auth.admin.createUser({
          email: QA_EMAIL,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { qa: "affiliate-testmode" },
        });
        let userId = created?.user?.id ?? null;
        if (!userId) {
          const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
          userId = list?.users?.find((u) => u.email === QA_EMAIL)?.id ?? null;
        }
        if (!userId) return json({ step: "user", error: userError?.message ?? "no user" }, 500);

        const { data: affiliate, error: affErr } = await db
          .from("affiliates")
          .upsert(
            {
              user_id: userId,
              code: "qatestmode001",
              display_name: "QA Test Mode Affiliate",
              contact_email: QA_EMAIL,
              status: "active",
              external_only: true,
            },
            { onConflict: "code" },
          )
          .select("id")
          .single();
        if (affErr) return json({ step: "affiliate", error: affErr.message }, 500);

        const { data: referral, error: refErr } = await db
          .from("affiliate_referrals")
          .insert({
            affiliate_id: affiliate.id,
            link_type: String(body.linkType ?? "pay"),
            lead_name: "QA Test Lead",
            lead_email: QA_LEAD_EMAIL,
            lead_email_normalized: QA_LEAD_EMAIL,
            token_hash: crypto.randomUUID(),
            intent: "checkout",
            status: "lead",
          })
          .select("id, first_seen_at")
          .single();
        if (refErr) return json({ step: "referral", error: refErr.message }, 500);

        return json({ userId, affiliateId: affiliate.id, referralId: referral.id });
      }

      case "checkout": {
        const session = await call("/checkout/sessions", {
          body: {
            mode: "payment",
            "line_items[0][price]": String(body.priceId),
            "line_items[0][quantity]": 1,
            client_reference_id: String(body.referralId),
            customer_email: QA_LEAD_EMAIL,
            success_url: "https://member.thebarberlaunch.com/affiliates?qa=success",
            cancel_url: "https://member.thebarberlaunch.com/affiliates?qa=cancel",
            "metadata[referral_id]": String(body.referralId),
            "metadata[qa]": "affiliate-testmode",
          },
        });
        return json({ ok: session.ok, id: session.data?.id, url: session.data?.url, livemode: session.data?.livemode });
      }

      case "session": {
        const s = await call(`/checkout/sessions/${body.sessionId}`);
        return json({
          ok: s.ok,
          id: s.data?.id,
          payment_status: s.data?.payment_status,
          payment_intent: s.data?.payment_intent,
          amount_total: s.data?.amount_total,
          livemode: s.data?.livemode,
        });
      }

      case "connect": {
        const acct = await call("/accounts", {
          body: {
            type: "custom",
            country: "US",
            email: QA_EMAIL,
            business_type: "individual",
            "capabilities[transfers][requested]": "true",
            "capabilities[card_payments][requested]": "true",
            "business_profile[mcc]": "7311",
            "business_profile[url]": "https://thebarberlaunch.com",
            "individual[first_name]": "Qa",
            "individual[last_name]": "Tester",
            "individual[email]": QA_EMAIL,
            "individual[phone]": "0000000000",
            "individual[dob][day]": 1,
            "individual[dob][month]": 1,
            "individual[dob][year]": 1901,
            "individual[id_number]": "000000000",
            "individual[ssn_last_4]": "0000",
            "individual[address][line1]": "address_full_match",
            "individual[address][city]": "Denver",
            "individual[address][state]": "CO",
            "individual[address][postal_code]": "80202",
            "individual[address][country]": "US",
            "tos_acceptance[date]": Math.floor(Date.now() / 1000),
            "tos_acceptance[ip]": "8.8.8.8",
            "external_account": "btok_us_verified",
            "metadata[qa]": "affiliate-testmode",
          },
        });
        if (!acct.ok) return json({ step: "account", error: acct.data }, 502);
        const full = await call(`/accounts/${acct.data.id}?expand[]=external_accounts`);
        const ev = evaluateAccount(full.data);
        const { error } = await db.from("affiliate_payout_accounts").upsert(
          {
            affiliate_id: body.affiliateId,
            user_id: body.userId,
            stripe_account_id: acct.data.id,
            source: "qa_testmode",
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
          },
          { onConflict: "affiliate_id" },
        );
        if (error) return json({ step: "payout_account", error: error.message }, 500);
        return json({ accountId: acct.data.id, eligibility: ev, livemode: acct.data.livemode });
      }

      case "account_status": {
        const full = await call(`/accounts/${body.accountId}?expand[]=external_accounts`);
        return json({ ok: full.ok, eligibility: evaluateAccount(full.data) });
      }

      case "refund": {
        const refund = await call("/refunds", {
          body: {
            payment_intent: String(body.paymentIntentId),
            ...(body.amountCents ? { amount: Number(body.amountCents) } : {}),
          },
        });
        return json({ ok: refund.ok, id: refund.data?.id, status: refund.data?.status, amount: refund.data?.amount });
      }

      case "payout": {
        // Payout on the CONNECTED account: the only thing that can evidence bank arrival.
        const res = await fetch("https://api.stripe.com/v1/payouts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Stripe-Account": String(body.accountId),
          },
          body: new URLSearchParams({
            amount: String(body.amountCents),
            currency: "usd",
            description: "QA test-mode affiliate bank payout",
          }),
        });
        const data = await res.json();
        return json({ ok: res.ok, id: data?.id, status: data?.status, arrival_date: data?.arrival_date, error: data?.error });
      }

      case "dispatch": {
        // Test-mode dispatch only; the live scheduler path is untouched.
        const res = await fetch(
          "https://ynooatjtgstgwfssnira.supabase.co/functions/v1/affiliate-transfer-dispatch",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ livemode: false, dryRun: body.dryRun !== false, source: "qa" }),
          },
        );
        return json({ status: res.status, result: await res.json().catch(() => null) });
      }

      case "replay": {
        // Re-delivers a Stripe-GENERATED payload, signed with the test endpoint
        // secret, to prove duplicate handling. The payload is Stripe's; the
        // signature is ours.
        const ev = await call(`/events/${body.eventId}`);
        if (!ev.ok) return json({ error: ev.data }, 502);
        const payload = JSON.stringify(ev.data);
        const ts = Math.floor(Date.now() / 1000);
        const secretValue = await (await import("../_shared/affiliateVault.ts")).readAffiliateWebhookSecret(
          AFFILIATE_TEST_WEBHOOK_SECRET_NAME,
        );
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(String(secretValue)),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}.${payload}`));
        const sig = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "stripe-signature": `t=${ts},v1=${sig}` },
          body: payload,
        });
        return json({ status: res.status, body: await res.json().catch(() => null) });
      }

      case "setup_connect_webhook": {
        const endpoint = await call("/webhook_endpoints", {
          body: {
            url: WEBHOOK_URL,
            connect: "true",
            description: "QA test-mode connected-account events",
            "enabled_events[0]": "payout.paid",
            "enabled_events[1]": "payout.failed",
            "enabled_events[2]": "account.updated",
          },
        });
        if (!endpoint.ok) return json({ error: endpoint.data }, 502);
        await writeAffiliateWebhookSecret(String(endpoint.data.secret), AFFILIATE_TEST_CONNECT_WEBHOOK_SECRET_NAME);
        return json({ endpointId: endpoint.data.id, livemode: endpoint.data.livemode, connect: endpoint.data.connect });
      }

      case "balance": {
        const b = await call("/balance");
        return json({ ok: b.ok, available: b.data?.available, pending: b.data?.pending, livemode: b.data?.livemode });
      }

      case "fund": {
        // Documented Stripe test card that skips the pending period, so the
        // test platform balance can fund a test transfer. No real money.
        const pi = await call("/payment_intents", {
          body: {
            amount: Number(body.amountCents ?? 100000),
            currency: "usd",
            payment_method: "pm_card_bypassPending",
            confirm: "true",
            "automatic_payment_methods[enabled]": "true",
            "automatic_payment_methods[allow_redirects]": "never",
            description: "QA test-mode balance top-up",
          },
        });
        return json({ ok: pi.ok, id: pi.data?.id, status: pi.data?.status, error: pi.data?.error });
      }

      case "verify_doc": {
        const form = new FormData();
        form.append("purpose", "identity_document");
        form.append("file", new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "image/png" }), "doc.png");
        const res = await fetch("https://files.stripe.com/v1/files", {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          body: form,
        });
        const file = await res.json();
        const upd = await call(`/accounts/${body.accountId}`, {
          body: {
            "individual[verification][document][front]": file?.id,
          },
        });
        return json({ fileId: file?.id, ok: upd.ok, error: upd.data?.error });
      }

      case "events": {
        const res = await call(`/events?limit=${Number(body.limit ?? 10)}`);
        return json({
          ok: res.ok,
          events: (res.data?.data ?? []).map((e: any) => ({ id: e.id, type: e.type, created: e.created, livemode: e.livemode })),
        });
      }

      case "backdate": {
        // Isolated TEST-MODE eligibility fixture: seven days cannot be advanced in
        // Stripe, so the verified payment time of a test payment is moved back.
        const { data, error } = await db
          .from("affiliate_payments")
          .update({ paid_at: new Date(Date.now() - 8 * 86_400_000).toISOString() })
          .eq("stripe_payment_intent_id", String(body.paymentIntentId))
          .eq("livemode", false)
          .select("id, paid_at");
        if (error) return json({ error: error.message }, 500);
        return json({ updated: data });
      }

      case "state": {
        const [payments, commissions, transfers, events] = await Promise.all([
          db.from("affiliate_payments").select("*").eq("livemode", false).order("created_at", { ascending: false }).limit(10),
          db.from("affiliate_commissions").select("*").eq("livemode", false).order("created_at", { ascending: false }).limit(20),
          db.from("affiliate_transfers").select("*").eq("livemode", false).order("created_at", { ascending: false }).limit(20),
          db.from("affiliate_payout_events").select("*").eq("livemode", false).order("created_at", { ascending: false }).limit(20),
        ]);
        return json({
          payments: payments.data,
          commissions: commissions.data,
          transfers: transfers.data,
          payoutEvents: events.data,
        });
      }

      case "webhook_events": {
        const { data } = await db
          .from("affiliate_webhook_events")
          .select("stripe_event_id, event_type, status, livemode, error, created_at")
          .eq("livemode", false)
          .order("created_at", { ascending: false })
          .limit(25);
        return json({ events: data });
      }

      case "cleanup": {
        const removed: Record<string, unknown> = {};
        if (body.webhookEndpointId) {
          const del = await call(`/webhook_endpoints/${body.webhookEndpointId}`, { method: "DELETE" });
          removed.webhook = del.ok;
        }
        if (body.priceId) {
          const { data: row } = await db.from("affiliate_settings").select("value").eq("key", "program").maybeSingle();
          const value = (row?.value ?? {}) as Record<string, unknown>;
          const ids = ((value.enrollment_price_ids as string[]) ?? []).filter((p) => p !== body.priceId);
          await db.from("affiliate_settings").update({ value: { ...value, enrollment_price_ids: ids } }).eq("key", "program");
          removed.enrollmentPriceIds = ids;
        }
        return json(removed);
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unknown" }, 500);
  }
});
