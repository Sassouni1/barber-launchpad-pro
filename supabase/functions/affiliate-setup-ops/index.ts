// TEMPORARY, token-guarded setup operations for the affiliate enrollment checkout.
// Removed once setup is complete. Never returns secrets.
import { adminClient, json, loadSettings, stripeCall, stripeKeyLivemode } from "../_shared/affiliate.ts";
import { readAffiliateWebhookSecret, writeAffiliateWebhookSecret } from "../_shared/affiliateVault.ts";

const WEBHOOK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/affiliate-stripe-webhook`;

const EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "charge.dispute.created",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.closed",
  "charge.dispute.funds_reinstated",
  "transfer.created",
  "transfer.updated",
  "transfer.reversed",
  "payout.paid",
  "payout.failed",
];

const PRODUCT_NAME = "Barber Launch Hair System Mastery & Marketing";
const PRODUCT_TAG = "barber_launch_enrollment_3000";
const PRICE_CENTS = 300000;

Deno.serve(async (req) => {
  const token = req.headers.get("x-setup-token") ?? "";
  const expected = Deno.env.get("AFFILIATE_SETUP_OPS_TOKEN") ?? "";
  if (!expected || token !== expected) return json({ error: "forbidden" }, 403);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "identity");
  const db = adminClient();

  try {
    if (action === "identity") {
      const acc = await stripeCall("/account");
      if (!acc.ok) return json({ error: acc.data?.error?.message ?? "lookup failed" }, 400);
      const a = acc.data;
      return json({
        accountId: a.id,
        email: a.email ?? null,
        businessProfileName: a.business_profile?.name ?? null,
        companyName: a.company?.name ?? null,
        dashboardDisplayName: a.settings?.dashboard?.display_name ?? null,
        businessType: a.business_type ?? null,
        country: a.country ?? null,
        defaultCurrency: a.default_currency ?? null,
        chargesEnabled: a.charges_enabled ?? null,
        payoutsEnabled: a.payouts_enabled ?? null,
        keyLivemode: stripeKeyLivemode(),
      });
    }

    if (action === "find_price") {
      // Read-only: look for an existing active one-time $3,000 USD price.
      const search = await stripeCall(
        `/prices/search?query=${encodeURIComponent(`active:'true' AND currency:'usd' AND type:'one_time'`)}&limit=100&expand[]=data.product`,
      );
      if (!search.ok) return json({ error: search.data?.error?.message ?? "price search failed" }, 400);
      const matches = (search.data?.data ?? [])
        .filter((p: any) => Number(p.unit_amount) === PRICE_CENTS)
        .map((p: any) => ({
          priceId: p.id,
          productId: typeof p.product === "string" ? p.product : p.product?.id,
          productName: typeof p.product === "string" ? null : p.product?.name ?? null,
          livemode: p.livemode,
          metadata: p.metadata ?? {},
        }));
      return json({ matches });
    }

    if (action === "ensure_price") {
      // Idempotent: reuse a price tagged for this offer, otherwise create once.
      const tagged = await stripeCall(
        `/prices/search?query=${encodeURIComponent(`active:'true' AND metadata['offer']:'${PRODUCT_TAG}'`)}&limit=10`,
      );
      if (tagged.ok && (tagged.data?.data ?? []).length > 0) {
        const p = tagged.data.data[0];
        return json({ created: false, priceId: p.id, productId: p.product, livemode: p.livemode });
      }

      const product = await stripeCall("/products", {
        body: {
          name: PRODUCT_NAME,
          description: "Barber Launch enrollment — Hair System Mastery & Marketing program.",
          "metadata[offer]": PRODUCT_TAG,
          "metadata[managed_by]": "barber_launch_member_app",
        },
        idempotencyKey: `bl_product_${PRODUCT_TAG}`,
      });
      if (!product.ok) return json({ error: product.data?.error?.message ?? "product create failed" }, 400);

      const price = await stripeCall("/prices", {
        body: {
          product: product.data.id,
          currency: "usd",
          unit_amount: PRICE_CENTS,
          "metadata[offer]": PRODUCT_TAG,
        },
        idempotencyKey: `bl_price_${PRODUCT_TAG}_${PRICE_CENTS}`,
      });
      if (!price.ok) return json({ error: price.data?.error?.message ?? "price create failed" }, 400);

      return json({
        created: true,
        productId: product.data.id,
        productName: product.data.name,
        priceId: price.data.id,
        unitAmount: price.data.unit_amount,
        livemode: price.data.livemode,
      });
    }

    if (action === "list_webhooks") {
      const res = await stripeCall("/webhook_endpoints?limit=100");
      if (!res.ok) return json({ error: res.data?.error?.message ?? "list failed" }, 400);
      return json({
        stored: Boolean(await readAffiliateWebhookSecret().catch(() => null)),
        endpoints: (res.data?.data ?? []).map((e: any) => ({
          id: e.id,
          url: e.url,
          status: e.status,
          livemode: e.livemode,
          events: e.enabled_events,
        })),
      });
    }

    if (action === "ensure_webhook") {
      const list = await stripeCall("/webhook_endpoints?limit=100");
      if (!list.ok) return json({ error: list.data?.error?.message ?? "list failed" }, 400);
      const existing = (list.data?.data ?? []).find((e: any) => e.url === WEBHOOK_URL);
      const haveSecret = Boolean(await readAffiliateWebhookSecret().catch(() => null));

      if (existing && haveSecret) {
        // Keep the event list current without recreating the endpoint.
        const upd = await stripeCall(`/webhook_endpoints/${existing.id}`, {
          body: Object.fromEntries(EVENTS.map((e, i) => [`enabled_events[${i}]`, e])),
        });
        if (!upd.ok) return json({ error: upd.data?.error?.message ?? "update failed" }, 400);
        return json({ created: false, endpointId: existing.id, url: WEBHOOK_URL, events: EVENTS, secretStored: true });
      }

      if (existing && !haveSecret) {
        // Its signing secret is only revealed at creation, so it is unusable. Replace it.
        const del = await stripeCall(`/webhook_endpoints/${existing.id}`, { method: "DELETE" });
        if (!del.ok) return json({ error: del.data?.error?.message ?? "could not replace endpoint" }, 400);
      }

      const created = await stripeCall("/webhook_endpoints", {
        body: {
          url: WEBHOOK_URL,
          description: "Barber Launch affiliate enrollment commission events",
          ...Object.fromEntries(EVENTS.map((e, i) => [`enabled_events[${i}]`, e])),
        },
      });
      if (!created.ok) return json({ error: created.data?.error?.message ?? "create failed" }, 400);
      const secret = created.data?.secret;
      if (!secret) return json({ error: "Stripe did not return a signing secret." }, 500);
      await writeAffiliateWebhookSecret(String(secret));

      return json({
        created: true,
        endpointId: created.data.id,
        url: WEBHOOK_URL,
        status: created.data.status,
        livemode: created.data.livemode,
        events: EVENTS,
        secretStored: true,
      });
    }

    if (action === "save_settings") {
      const patch = (body.patch ?? {}) as Record<string, unknown>;
      const settings = await loadSettings(db);
      const next = { ...settings, ...patch };
      const { error } = await db
        .from("affiliate_settings")
        .upsert({ key: "program", value: next, updated_at: new Date().toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ settings: next });
    }

    return json({ error: "unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "failed" }, 500);
  }
});
