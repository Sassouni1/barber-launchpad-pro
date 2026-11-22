// Member Billing: masked saved cards, Stripe-hosted card add/replace, card
// removal and domain order receipts — always scoped to the signed-in member's
// own verified Stripe Customer. Raw card details never touch this server.
import { corsHeaders } from "../_shared/cors.ts";
import { requireMemberContentAccess } from "../_shared/memberGate.ts";
import { serviceClient } from "../_shared/websiteAuth.ts";
import {
  BILLING_SETUP_SOURCE, PAYMENT_METHOD_RE, assertCardOwned, resolveMemberStripeCustomer, toCardViews, type Resolution,
} from "../_shared/memberDomainBilling.ts";
import { linkCustomerVia, resolveDepsFor, stripeApi } from "../_shared/memberDomainBillingRuntime.ts";

const MEMBER_SITE = "https://member.thebarberlaunch.com";
const SETUP_SESSION_RE = /^cs_live_[A-Za-z0-9]+$/;
const RECEIPT_STATUSES = new Set(["paid", "registering", "registration_pending", "registered", "action_required"]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function returnOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  try {
    const url = new URL(origin);
    if (url.origin === MEMBER_SITE || (url.protocol === "https:" && url.hostname.endsWith(".lovable.app"))) return url.origin;
  } catch { /* fall through */ }
  return MEMBER_SITE;
}

function customerStatus(resolution: Resolution) {
  return resolution.status === "resolved"
    ? { status: "linked" as const }
    : { status: resolution.reason === "no_evidence" ? "none" as const : "unresolved" as const, reason: resolution.reason };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const access = await requireMemberContentAccess(req, corsHeaders);
  if (!access.ok) return access.response;
  const userId = access.userId;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!stripeKey) return json({ error: "Billing is unavailable right now" }, 503);

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = typeof body.action === "string" ? body.action : "";
    const db = serviceClient();
    const stripe = stripeApi(stripeKey);
    const account = await stripe.get("account");
    if (account?.id !== "acct_1LMNKMI6LFtj88Bq") return json({ error: "Billing is unavailable right now" }, 503);
    const resolve = () => resolveMemberStripeCustomer(resolveDepsFor(db, stripe.get), userId);

    if (action === "summary") {
      const resolution = await resolve();
      let cards: ReturnType<typeof toCardViews> = [];
      if (resolution.status === "resolved") {
        const methods = await stripe.get(`customers/${encodeURIComponent(resolution.customerId)}/payment_methods?type=card&limit=20`);
        cards = toCardViews(methods?.data ?? [], resolution.customerId, resolution.defaultPaymentMethodId, new Date());
      }
      const { data: orders, error } = await db.from("member_domain_orders")
        .select("id, domain, status, member_charge_cents, currency, stripe_payment_intent_id, last_error, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      const withReceipts = [];
      let lookups = 0;
      for (const order of orders ?? []) {
        let receiptUrl: string | null = null;
        if (order.stripe_payment_intent_id && RECEIPT_STATUSES.has(order.status) && lookups < 10) {
          lookups++;
          const intent = await stripe.get(`payment_intents/${encodeURIComponent(order.stripe_payment_intent_id)}?expand[]=latest_charge`).catch(() => null);
          const charge = intent?.latest_charge;
          if (intent?.status === "succeeded" && intent.metadata?.order_id === order.id && typeof charge?.receipt_url === "string" &&
              charge.receipt_url.startsWith("https://")) receiptUrl = charge.receipt_url;
        }
        const { stripe_payment_intent_id: _hidden, ...visible } = order;
        withReceipts.push({ ...visible, receipt_url: receiptUrl });
      }
      return json({ customer: customerStatus(resolution), cards, orders: withReceipts });
    }

    if (action === "setup") {
      let resolution = await resolve();
      if (resolution.status === "unresolved" && resolution.reason === "lookup_failed")
        return json({ error: "Billing could not be checked right now. Try again in a moment." }, 503);
      if (resolution.status === "unresolved" && resolution.reason === "customer_unavailable")
        return json({ error: "Your saved billing profile needs a review. Contact Barber Launch Support." }, 409);
      let customerId = resolution.status === "resolved" ? resolution.customerId : null;
      if (!customerId) {
        // No verified existing Customer: create a fresh one owned only by this member.
        const created = await stripe.post("customers", new URLSearchParams({
          ...(access.email ? { email: access.email } : {}),
          "metadata[barber_launch_member_id]": userId,
        }), `member_billing_customer_${userId}`);
        if (typeof created.id !== "string") throw new Error("Customer not created");
        const link = await linkCustomerVia(db)(userId, created.id, "created_for_member");
        if (link === "linked" || link === "already_linked") customerId = created.id;
        else {
          resolution = await resolve();
          if (resolution.status !== "resolved") return json({ error: "Your billing profile needs a review. Contact Barber Launch Support." }, 409);
          customerId = resolution.customerId;
        }
      }
      const origin = returnOrigin(req);
      const session = await stripe.post("checkout/sessions", new URLSearchParams({
        mode: "setup", currency: "usd", customer: customerId, "payment_method_types[0]": "card",
        success_url: `${origin}/billing?setup_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?setup=cancelled`,
        "metadata[source]": BILLING_SETUP_SOURCE, "metadata[user_id]": userId,
        "setup_intent_data[metadata][source]": BILLING_SETUP_SOURCE, "setup_intent_data[metadata][user_id]": userId,
      }));
      if (typeof session.url !== "string" || !session.url.startsWith("https://checkout.stripe.com/")) throw new Error("Setup session not created");
      return json({ url: session.url });
    }

    if (action === "setup-complete") {
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      if (!SETUP_SESSION_RE.test(sessionId)) return json({ error: "Invalid card setup" }, 400);
      const resolution = await resolve();
      if (resolution.status !== "resolved") return json({ error: "Card setup could not be confirmed" }, 409);
      const session = await stripe.get(`checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=setup_intent`);
      const intent = session?.setup_intent;
      if (!session || session.livemode !== true || session.mode !== "setup" || session.status !== "complete" ||
          session.metadata?.source !== BILLING_SETUP_SOURCE || session.metadata?.user_id !== userId ||
          session.customer !== resolution.customerId || intent?.status !== "succeeded")
        return json({ error: "Card setup could not be confirmed" }, 409);
      const pmId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
      const pm = pmId ? await stripe.get(`payment_methods/${encodeURIComponent(pmId)}`) : null;
      if (!assertCardOwned(pm, resolution.customerId)) return json({ error: "Card setup could not be confirmed" }, 409);
      // The member explicitly added this card for future Barber Launch purchases.
      await stripe.post(`payment_methods/${encodeURIComponent(pm.id)}`, new URLSearchParams({ allow_redisplay: "always" }));
      await linkCustomerVia(db)(userId, resolution.customerId, "existing_link", pm.id);
      return json({ ok: true });
    }

    if (action === "remove-card") {
      const pmId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : "";
      if (!PAYMENT_METHOD_RE.test(pmId)) return json({ error: "Invalid card" }, 400);
      const resolution = await resolve();
      const customerId = resolution.status === "resolved" ? resolution.customerId : null;
      const pm = await stripe.get(`payment_methods/${encodeURIComponent(pmId)}`);
      if (!assertCardOwned(pm, customerId)) return json({ error: "Card not found" }, 404);
      await stripe.post(`payment_methods/${encodeURIComponent(pmId)}/detach`, new URLSearchParams());
      await db.from("member_billing_profiles").update({ default_payment_method_id: null })
        .eq("customer_id", userId).eq("default_payment_method_id", pmId);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("member-billing failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Billing is unavailable right now" }, 503);
  }
});
