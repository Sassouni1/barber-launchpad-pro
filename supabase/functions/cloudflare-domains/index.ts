import { corsHeaders } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/websiteAuth.ts";
import { SITE_WORKER_SOURCE, SITE_WORKER_VERSION, deploySiteWorker } from "../_shared/siteWorker.ts";
import { requireMemberContentAccess } from "../_shared/memberGate.ts";


const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,24})+$/;
const STRIPE_ACCOUNT = "acct_1LMNKMI6LFtj88Bq";
const DOMAIN_SOURCE = "barber_launch_member_domain";
const MEMBER_SITE = "https://member.thebarberlaunch.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cloudflareConfig() {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = Deno.env.get("CLOUDFLARE_REGISTRAR_API_TOKEN");
  if (!accountId || !token) return null;
  return { accountId, token };
}

async function cf(path: string, init: RequestInit, token: string) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok && payload?.success !== false, status: res.status, payload };
}

function cfError(payload: Record<string, unknown> | undefined, fallback: string) {
  const errors = (payload as { errors?: Array<{ message?: string }> } | undefined)?.errors;
  return errors?.[0]?.message ?? fallback;
}

async function stripe(path: string, key: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2026-03-25.dahlia", ...(init.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload, status: response.status };
}

type CheckResult = {
  domain: string;
  available: boolean;
  price: number | null;
  renewalPrice: number | null;
  currency: string;
  reason: string | null;
};

/** Authoritative availability + pricing via the current domain-check endpoint. */
async function checkDomains(domains: string[], accountId: string, token: string) {
  const res = await cf(
    `/accounts/${accountId}/registrar/domain-check`,
    { method: "POST", body: JSON.stringify({ domains }) },
    token,
  );
  if (!res.ok) {
    return { ok: false as const, error: cfError(res.payload, `Cloudflare error ${res.status}`) };
  }

  // Cloudflare currently nests the checked array under result.domains; fall back to a top-level array only if that is what it actually returns.
  const result = res.payload?.result;
  const rows = Array.isArray(result?.domains)
    ? result.domains
    : Array.isArray(result)
    ? result
    : [];

  const results: CheckResult[] = rows.map((row: Record<string, unknown>) => {
    const pricing = (row?.pricing ?? {}) as Record<string, any>;
    const registrable = row?.registrable === true;
    const premium = row?.tier === "premium";
    const price = Number(pricing?.registration_cost);
    const renewal = Number(pricing?.renewal_cost);
    let reason: string | null = null;
    if (!registrable) reason = (row?.reason as string | undefined) ?? "This domain is not available for registration";
    else if (premium) reason = "Premium domains cannot be purchased here";
    else if (!Number.isFinite(price)) reason = "Pricing unavailable for this domain";
    return {
      domain: row?.name ?? row?.domain ?? "",
      available: registrable && !premium && Number.isFinite(price),
      price: Number.isFinite(price) ? price : null,
      renewalPrice: Number.isFinite(renewal) ? renewal : null,
      currency: pricing?.currency ?? "USD",
      reason,
    };
  });
  return { ok: true as const, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = typeof body.action === "string" ? body.action : "";

    // The worker deploy action may also be authorised by the server-only deploy secret.
    const deploySecret = Deno.env.get("SITE_WORKER_DEPLOY_SECRET") ?? "";
    const secretOk = action === "deploy-site-worker" && Boolean(deploySecret) &&
      (req.headers.get("x-deploy-secret") ?? "") === deploySecret;

    const { user, error: authError } = await requireUser(req);
    if (!user && !secretOk) return json({ error: authError }, 401);


    const config = cloudflareConfig();
    if (!config) {
      return json({
        available: false,
        configured: false,
        error:
          "Domain search and purchase are unavailable until CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_REGISTRAR_API_TOKEN are configured.",
      }, 503);
    }

    if (action === "check") {
      const raw: unknown[] = Array.isArray(body.domains) ? body.domains : [];
      const domains = raw
        .filter((d: unknown): d is string => typeof d === "string")
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20);
      if (domains.length === 0) return json({ error: "Provide at least one domain name" }, 400);
      if (domains.some((d: string) => !DOMAIN_RE.test(d))) {
        return json({ error: "Enter a complete domain name, for example yourshop.com" }, 400);
      }

      const checked = await checkDomains(domains, config.accountId, config.token);
      if (!checked.ok) return json({ error: checked.error }, 502);
      // Return both `results` and `domains` for compatibility with current Website Editor consumers.
      return json({ configured: true, results: checked.results, domains: checked.results });
    }

    if (action === "register") {
      // Registration charges Barber Launch's Cloudflare card. Only the signed,
      // paid Stripe webhook may call Cloudflare's registration endpoint.
      return json({ error: "Complete the member domain checkout before registration" }, 403);
    }

    if (action === "checkout") {
      if (!user) return json({ error: "Invalid or expired session" }, 401);
      const access = await requireMemberContentAccess(req, corsHeaders);
      if (!access.ok) return access.response;

      const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
      if (!DOMAIN_RE.test(domain)) return json({ error: "Enter a complete domain name" }, 400);
      const db = serviceClient();
      const { data: website, error: websiteError } = await db.from("member_websites")
        .select("id, template_key, custom_domain").eq("user_id", user.id).maybeSingle();
      if (websiteError || !website || !["guided-charlotte", "guided-kait"].includes(website.template_key))
        return json({ error: "Save your website draft before buying a domain" }, 409);
      if (website.custom_domain) return json({ error: "This website already has a domain" }, 409);
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (!stripeKey) return json({ error: "Domain checkout is unavailable" }, 503);
      const account = await stripe("account", stripeKey);
      if (!account.ok || account.payload?.id !== STRIPE_ACCOUNT) return json({ error: "Domain checkout account is unavailable" }, 503);

      // Availability and price are checked again immediately before payment.
      const checked = await checkDomains([domain], config.accountId, config.token);
      if (!checked.ok) return json({ error: checked.error }, 502);
      const current = checked.results.find((r) => r.domain === domain) ?? checked.results[0];
      if (!current || !current.available || current.price === null) {
        return json({ error: current?.reason ?? "That domain is no longer available" }, 409);
      }
      if (current.currency.toUpperCase() !== "USD") return json({ error: "Only USD domain pricing is supported" }, 409);
      const costCents = Math.round(current.price * 100);
      if (costCents < 100 || costCents > 50_000) return json({ error: "This domain needs manual pricing review" }, 409);
      if (Number(body.confirmedPrice) !== current.price || body.confirmedDomain !== domain)
        return json({ error: "The domain or price changed. Review the current price before checkout.", current }, 409);

      const { data: prior } = await db.from("member_domain_orders").select("*").eq("domain", domain).maybeSingle();
      if (prior) {
        if (prior.user_id !== user.id) return json({ error: "This domain is already in another order" }, 409);
        if (prior.status !== "checkout_open" || !prior.stripe_session_id) return json({ error: `This domain order is ${prior.status}. Contact support before retrying.` }, 409);
        const session = await stripe(`checkout/sessions/${encodeURIComponent(prior.stripe_session_id)}`, stripeKey);
        if (session.ok && session.payload?.status === "open" && session.payload?.url)
          return json({ checkoutUrl: session.payload.url, domain, price: prior.member_charge_cents / 100, currency: "USD" });
        return json({ error: "The earlier checkout expired. Contact support to reopen it safely." }, 409);
      }

      const { data: order, error: orderError } = await db.from("member_domain_orders").insert({
        user_id: user.id, domain, cloudflare_cost_cents: costCents,
        member_charge_cents: costCents, status: "checkout_pending",
      }).select("id").single();
      if (orderError || !order) return json({ error: "Could not reserve this domain order" }, 409);

      const form = new URLSearchParams({
        mode: "payment", "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(costCents),
        "line_items[0][price_data][product_data][name]": `Domain registration: ${domain}`,
        "line_items[0][quantity]": "1",
        success_url: `${MEMBER_SITE}/my-website?domain_order=${order.id}`,
        cancel_url: `${MEMBER_SITE}/my-website?domain_order=${order.id}&cancelled=1`,
        customer_email: user.email ?? "",
        "metadata[source]": DOMAIN_SOURCE, "metadata[order_id]": order.id,
        "metadata[user_id]": user.id, "metadata[domain]": domain,
      });
      const checkout = await stripe("checkout/sessions", stripeKey, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `member_domain_${order.id}` },
        body: form,
      });
      if (!checkout.ok || !checkout.payload?.id || !checkout.payload?.url) {
        await db.from("member_domain_orders").update({ status: "failed", last_error: "Could not create Stripe checkout" }).eq("id", order.id);
        return json({ error: "Could not open secure checkout" }, 502);
      }
      await db.from("member_domain_orders").update({ status: "checkout_open", stripe_session_id: checkout.payload.id }).eq("id", order.id);
      return json({ checkoutUrl: checkout.payload.url, domain, price: costCents / 100, currency: "USD" });
    }

    if (action === "status") {
      if (!user) return json({ error: "Invalid or expired session" }, 401);
      const orderId = typeof body.orderId === "string" ? body.orderId : "";
      if (orderId && !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Invalid order" }, 400);
      const db = serviceClient();
      let query = db.from("member_domain_orders")
        .select("id,domain,status,member_charge_cents,cloudflare_registration_state,last_error")
        .eq("user_id", user.id);
      if (orderId) query = query.eq("id", orderId);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return json({ error: "Order could not be loaded" }, 500);
      if (!data) return json({ order: null });
      if (data.status === "registration_pending") {
        const result = await cf(`/accounts/${config.accountId}/registrar/registrations/${encodeURIComponent(data.domain)}/registration-status`, { method: "GET" }, config.token);
        const state = result.payload?.result?.state;
        if (result.ok && ["succeeded", "action_required", "failed", "blocked"].includes(state)) {
          data.status = state === "succeeded" ? "registered" : "action_required";
          data.cloudflare_registration_state = state;
          data.last_error = state === "succeeded" ? null : "Domain registration needs review";
          await db.from("member_domain_orders").update({
            status: data.status, cloudflare_registration_state: state, last_error: data.last_error,
            updated_at: new Date().toISOString(),
          }).eq("id", data.id);
          await db.from("member_websites").update({ cloudflare_registration_status: state })
            .eq("user_id", user.id).eq("custom_domain", data.domain);
        }
      }
      return json({ order: data });
    }

    // Push the canonical member-sites Worker source in this repo to Cloudflare.
    // Authorised by an admin session, or by the server-only SITE_WORKER_DEPLOY_SECRET.
    if (action === "deploy-site-worker") {
      let allowed = secretOk;
      if (!allowed && user) {
        const svc = serviceClient();
        const { data: isAdmin } = await svc.rpc("has_role", { _user_id: user.id, _role: "admin" });
        allowed = isAdmin === true;
      }
      if (!allowed) return json({ error: "Admins only" }, 403);


      const result = await deploySiteWorker(config.accountId, config.token);
      if (!result.ok) return json({ error: result.error }, 502);
      return json({
        success: true,
        worker: Deno.env.get("CLOUDFLARE_SITE_WORKER_NAME") ?? "barber-launch-member-sites",
        version: result.version,
      });
    }


    return json({ error: "Unknown action" }, 400);

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
