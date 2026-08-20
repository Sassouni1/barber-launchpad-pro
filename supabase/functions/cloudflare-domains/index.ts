import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser, serviceClient } from "../_shared/websiteAuth.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = typeof body.action === "string" ? body.action : "";

    const config = cloudflareConfig();
    if (!config) {
      return json({
        available: false,
        configured: false,
        error:
          "Domain search and purchase are unavailable until CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_REGISTRAR_API_TOKEN are configured.",
      }, 503);
    }

    if (action === "search") {
      const query = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
      if (!DOMAIN_RE.test(query)) return json({ error: "Enter a valid domain name" }, 400);

      const result = await cf(
        `/accounts/${config.accountId}/registrar/domains/${encodeURIComponent(query)}`,
        { method: "GET" },
        config.token,
      );

      // 404 from the registrar means the name is not in this account; ask availability.
      const availability = await cf(
        `/accounts/${config.accountId}/registrar/domains/${encodeURIComponent(query)}/availability`,
        { method: "GET" },
        config.token,
      );

      return json({
        configured: true,
        domain: query,
        ownedByAccount: result.ok,
        available: availability.payload?.result?.available ?? null,
        price: availability.payload?.result?.price ?? null,
        currency: availability.payload?.result?.currency ?? "USD",
        raw: availability.ok ? undefined : availability.payload?.errors?.[0]?.message ?? null,
      });
    }

    if (action === "register") {
      const domain = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";
      const confirmedDomain = typeof body.confirmedDomain === "string"
        ? body.confirmedDomain.trim().toLowerCase()
        : "";
      const confirmedPrice = Number(body.confirmedPrice);

      if (!DOMAIN_RE.test(domain)) return json({ error: "Enter a valid domain name" }, 400);
      if (body.confirm !== true || confirmedDomain !== domain) {
        return json({ error: "Registration requires explicit confirmation of the selected domain" }, 400);
      }
      if (!Number.isFinite(confirmedPrice) || confirmedPrice <= 0) {
        return json({ error: "Registration requires the confirmed displayed price" }, 400);
      }

      // Re-check price server-side so we never charge a different amount than displayed.
      const availability = await cf(
        `/accounts/${config.accountId}/registrar/domains/${encodeURIComponent(domain)}/availability`,
        { method: "GET" },
        config.token,
      );
      const livePrice = Number(availability.payload?.result?.price);
      if (availability.payload?.result?.available === false) {
        return json({ error: "That domain is no longer available" }, 409);
      }
      if (Number.isFinite(livePrice) && Math.abs(livePrice - confirmedPrice) > 0.01) {
        return json({
          error: `Price changed to ${livePrice}. Please review and confirm again.`,
          price: livePrice,
        }, 409);
      }

      const registration = await cf(
        `/accounts/${config.accountId}/registrar/domains/${encodeURIComponent(domain)}`,
        { method: "PUT", body: JSON.stringify({ auto_renew: true, privacy: true }) },
        config.token,
      );
      if (!registration.ok) {
        return json({
          error: registration.payload?.errors?.[0]?.message ?? "Cloudflare registration failed",
        }, 502);
      }

      const supabase = serviceClient();
      const { error: updateError } = await supabase
        .from("member_websites")
        .update({
          custom_domain: domain,
          cloudflare_registration_status: "registered",
          cloudflare_attachment_status: "pending",
        })
        .eq("user_id", user.id);
      if (updateError) return json({ error: updateError.message }, 500);

      return json({ success: true, domain, registrationStatus: "registered" });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
