// TEMPORARY, token-guarded setup + self-test helper for the affiliate program.
//
// It exists so the authorized Stripe connection can be used to finish setup and
// to prove the signed webhook path works, without ever exposing a secret.
// Remove once setup and verification are complete.
import {
  adminClient,
  json,
  loadSettings,
  randomToken,
  stripeCall,
} from "../_shared/affiliate.ts";
import {
  AFFILIATE_CONNECT_WEBHOOK_SECRET_NAME,
  readAffiliateWebhookSecret,
  writeAffiliateWebhookSecret,
} from "../_shared/affiliateVault.ts";

const WEBHOOK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/affiliate-stripe-webhook`;

// Bank payout results for the affiliates' OWN connected accounts. Platform
// payout events do not prove an affiliate's bank received anything.
const CONNECT_EVENTS = [
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "account.updated",
];

const encoder = new TextEncoder();

async function sign(payload: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("AFFILIATE_SETUP_OPS_TOKEN");
  if (!expected || req.headers.get("x-setup-token") !== expected) {
    return json({ error: "Not allowed." }, 403);
  }

  try {
    const db = adminClient();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    // Verification only: calls the payout runner as the service role in
    // read-only dry-run mode. It can never be asked to dispatch.
    if (action === "dispatch_dryrun") {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/affiliate-transfer-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ dryRun: true, source: String(body.source ?? "manual") }),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch { /* keep raw */ }
      return json({ status: res.status, body: parsed });
    }

    if (action === "list_webhooks") {
      const res = await stripeCall("/webhook_endpoints?limit=25");
      return json({
        ok: res.ok,
        endpoints: (res.data?.data ?? []).map((e: any) => ({
          id: e.id,
          url: e.url,
          status: e.status,
          livemode: e.livemode,
          application: e.application ?? null,
          apiVersion: e.api_version ?? null,
          enabledEvents: e.enabled_events,
        })),
      });
    }

    if (action === "ensure_connect_webhook") {
      const settings = await loadSettings(db);
      const stored = await readAffiliateWebhookSecret(AFFILIATE_CONNECT_WEBHOOK_SECRET_NAME).catch(() => null);
      if (settings.connect_webhook_endpoint_id && stored) {
        const check = await stripeCall(`/webhook_endpoints/${settings.connect_webhook_endpoint_id}`);
        if (check.ok && check.data?.status === "enabled") {
          return json({ ok: true, reused: true, endpointId: check.data.id, events: check.data.enabled_events });
        }
      }

      const form: Record<string, unknown> = {
        url: WEBHOOK_URL,
        connect: true,
        description: "Barber Launch affiliate — connected-account bank payout results",
      };
      CONNECT_EVENTS.forEach((e, i) => (form[`enabled_events[${i}]`] = e));
      const created = await stripeCall("/webhook_endpoints", { method: "POST", body: form });
      if (!created.ok) return json({ ok: false, error: created.data?.error?.message ?? "Stripe rejected it" }, 400);

      if (created.data?.secret) {
        await writeAffiliateWebhookSecret(created.data.secret, AFFILIATE_CONNECT_WEBHOOK_SECRET_NAME);
      }
      const next = {
        ...settings,
        connect_webhook_endpoint_id: created.data.id,
        connect_webhook_secret_stored: Boolean(created.data?.secret),
      };
      await db
        .from("affiliate_settings")
        .upsert({ key: "program", value: next, updated_at: new Date().toISOString() });
      return json({
        ok: true,
        created: true,
        endpointId: created.data.id,
        events: created.data.enabled_events,
        livemode: created.data.livemode,
      });
    }

    if (action === "save_settings") {
      const settings = await loadSettings(db);
      const next = { ...settings, ...((body.settings ?? {}) as Record<string, unknown>) };
      await db.from("affiliate_settings").upsert({ key: "program", value: next, updated_at: new Date().toISOString() });
      return json({ ok: true, settings: next });
    }

    /**
     * Signed-delivery self test, entirely in TEST MODE (livemode:false) with
     * synthetic ids. It proves signature verification, claim/duplicate handling
     * and connected-account payout recording. It never touches Stripe, never
     * creates a charge, and its records cannot reach live payouts.
     */
    if (action === "webhook_selftest") {
      const which = String(body.secret ?? "connect");
      const secret = which === "connect"
        ? await readAffiliateWebhookSecret(AFFILIATE_CONNECT_WEBHOOK_SECRET_NAME)
        : await readAffiliateWebhookSecret();
      if (!secret) return json({ ok: false, error: "No stored signing secret for that endpoint." }, 400);

      const suffix = randomToken(6);
      const event = {
        id: `evt_selftest_${suffix}`,
        object: "event",
        type: "payout.paid",
        livemode: false,
        created: Math.floor(Date.now() / 1000),
        account: `acct_selftest_${suffix}`,
        data: {
          object: {
            id: `po_selftest_${suffix}`,
            object: "payout",
            amount: 1234,
            currency: "usd",
            status: "paid",
            arrival_date: Math.floor(Date.now() / 1000),
          },
        },
      };
      const payload = JSON.stringify(event);
      const ts = Math.floor(Date.now() / 1000);
      const signature = await sign(payload, secret, ts);

      const post = (sig: string) =>
        fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "stripe-signature": `t=${ts},v1=${sig}` },
          body: payload,
        });

      const good = await post(signature);
      const goodBody = await good.json().catch(() => ({}));
      const replay = await post(signature);
      const replayBody = await replay.json().catch(() => ({}));
      const tampered = await post(signature.replace(/.$/, signature.endsWith("a") ? "b" : "a"));
      const tamperedBody = await tampered.json().catch(() => ({}));

      const { data: recorded } = await db
        .from("affiliate_payout_events")
        .select("stripe_event_id, event_type, stripe_account_id, stripe_payout_id, livemode, details")
        .eq("stripe_event_id", event.id)
        .maybeSingle();
      const { data: claim } = await db
        .from("affiliate_webhook_events")
        .select("event_id, status, attempts, livemode")
        .eq("event_id", event.id)
        .maybeSingle();

      return json({
        ok: true,
        eventId: event.id,
        accepted: { status: good.status, body: goodBody },
        replay: { status: replay.status, body: replayBody },
        badSignature: { status: tampered.status, body: tamperedBody },
        recordedPayoutEvent: recorded,
        claimRow: claim,
      });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("affiliate-setup-ops failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Something went wrong." }, 500);
  }
});
