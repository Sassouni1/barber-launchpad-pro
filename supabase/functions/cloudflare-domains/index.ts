import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser, serviceClient, slugify } from "../_shared/websiteAuth.ts";
import { SITE_WORKER_SOURCE, SITE_WORKER_VERSION } from "../_shared/siteWorker.ts";


const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,24})+$/;

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

  const results: CheckResult[] = rows.map((row: Record<string, any>) => {
    const pricing = row?.pricing ?? {};
    const registrable = row?.registrable === true;
    const premium = row?.tier === "premium";
    const price = Number(pricing?.registration_cost);
    const renewal = Number(pricing?.renewal_cost);
    let reason: string | null = null;
    if (!registrable) reason = row?.reason ?? "This domain is not available for registration";
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
      const raw = Array.isArray(body.domains) ? body.domains : [];
      const domains = raw
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20);
      if (domains.length === 0) return json({ error: "Provide at least one domain name" }, 400);
      if (domains.some((d) => !DOMAIN_RE.test(d))) {
        return json({ error: "Enter a complete domain name, for example yourshop.com" }, 400);
      }

      const checked = await checkDomains(domains, config.accountId, config.token);
      if (!checked.ok) return json({ error: checked.error }, 502);
      // Return both `results` and `domains` for compatibility with current Website Editor consumers.
      return json({ configured: true, results: checked.results, domains: checked.results });
    }

    if (action === "register") {
      if (!user) return json({ error: "Invalid or expired session" }, 401);

      const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
      const confirmedDomain = typeof body.confirmedDomain === "string"
        ? body.confirmedDomain.trim().toLowerCase()
        : "";
      const confirmedPrice = Number(body.confirmedPrice);

      if (!DOMAIN_RE.test(domain)) return json({ error: "Enter a complete domain name" }, 400);
      if (body.confirmPurchase !== true || confirmedDomain !== domain) {
        return json({ error: "Registration requires explicit confirmation of the selected domain" }, 400);
      }
      if (!Number.isFinite(confirmedPrice) || confirmedPrice <= 0) {
        return json({ error: "Registration requires the confirmed displayed price" }, 400);
      }

      // Re-check immediately so we never register an unavailable name or a changed price.
      const checked = await checkDomains([domain], config.accountId, config.token);
      if (!checked.ok) return json({ error: checked.error }, 502);
      const current = checked.results.find((r) => r.domain === domain) ?? checked.results[0];
      if (!current || !current.available || current.price === null) {
        return json({ error: current?.reason ?? "That domain is no longer available" }, 409);
      }
      if (Math.abs(current.price - confirmedPrice) > 0.01) {
        return json({
          error: `The price changed to ${current.currency} ${current.price}. Please review and confirm again.`,
          price: current.price,
          currency: current.currency,
        }, 409);
      }

      const registration = await cf(
        `/accounts/${config.accountId}/registrar/registrations`,
        { method: "POST", body: JSON.stringify({ domain_name: domain, auto_renew: false }) },
        config.token,
      );
      if (!registration.ok) {
        return json({ error: cfError(registration.payload, "Cloudflare registration failed") }, 502);
      }

      const supabase = serviceClient();
      const { data: existing } = await supabase
        .from("member_websites")
        .select("id, site_slug")
        .eq("user_id", user.id)
        .maybeSingle();

      const registrationStatus = registration.payload?.result?.status ?? "pending";

      if (existing) {
        const { error: updateError } = await supabase
          .from("member_websites")
          .update({
            custom_domain: domain,
            cloudflare_registration_status: registrationStatus,
            cloudflare_attachment_status: "pending",
            cloudflare_last_error: null,
          })
          .eq("id", existing.id);
        if (updateError) return json({ error: updateError.message }, 500);
      } else {
        const { error: insertError } = await supabase.from("member_websites").insert({
          user_id: user.id,
          site_slug: slugify(domain.split(".")[0], `site-${user.id.slice(0, 8)}`),
          custom_domain: domain,
          cloudflare_registration_status: registrationStatus,
          cloudflare_attachment_status: "pending",
          deployment_status: "draft",
        });
        if (insertError) return json({ error: insertError.message }, 500);
      }

      return json({
        success: true,
        domain,
        registration: registration.payload?.result ?? null,
        registrationStatus,
      });
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
