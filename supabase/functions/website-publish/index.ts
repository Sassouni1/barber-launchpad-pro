import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser, serviceClient, slugify } from "../_shared/websiteAuth.ts";

const MAX_HTML_BYTES = 1_500_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function previewBase() {
  return (Deno.env.get("CLOUDFLARE_SITE_PREVIEW_BASE_URL") ?? "https://sites.thebarberlaunch.com")
    .replace(/\/+$/, "");
}

function cloudflareConfig() {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const token = Deno.env.get("CLOUDFLARE_REGISTRAR_API_TOKEN");
  const worker = Deno.env.get("CLOUDFLARE_SITE_WORKER_NAME") ?? "barber-launch-member-sites";
  if (!accountId || !token) return null;
  return { accountId, token, worker };
}

/** Idempotently binds an already-registered custom domain to the member sites Worker. */
async function attachCustomDomain(hostname: string) {
  const cf = cloudflareConfig();
  if (!cf) {
    return { status: "unavailable", error: "Cloudflare credentials are not configured" };
  }
  const headers = {
    Authorization: `Bearer ${cf.token}`,
    "Content-Type": "application/json",
  };

  const apex = hostname.split(".").slice(-2).join(".");
  const zoneRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(apex)}`,
    { headers },
  );
  const zoneJson = await zoneRes.json().catch(() => ({}));
  const zoneId = zoneJson?.result?.[0]?.id;
  if (!zoneId) {
    return { status: "failed", error: `No Cloudflare zone found for ${apex}` };
  }

  const existingRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/workers/domains?hostname=${encodeURIComponent(hostname)}`,
    { headers },
  );
  const existingJson = await existingRes.json().catch(() => ({}));
  if (Array.isArray(existingJson?.result) && existingJson.result.length > 0) {
    return { status: "attached", error: null };
  }

  const attachRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/workers/domains`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        environment: "production",
        hostname,
        service: cf.worker,
        zone_id: zoneId,
      }),
    },
  );
  const attachJson = await attachRes.json().catch(() => ({}));
  if (!attachRes.ok || attachJson?.success === false) {
    const msg = attachJson?.errors?.[0]?.message ?? `Cloudflare error ${attachRes.status}`;
    return { status: "failed", error: String(msg) };
  }
  return { status: "attached", error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const homeHtml = typeof body.homeHtml === "string" ? body.homeHtml : "";
    const hairSystemHtml = typeof body.hairSystemHtml === "string" ? body.hairSystemHtml : "";

    if (!homeHtml.trim() || !hairSystemHtml.trim()) {
      return json({ error: "Both homeHtml and hairSystemHtml are required" }, 400);
    }
    if (homeHtml.length > MAX_HTML_BYTES || hairSystemHtml.length > MAX_HTML_BYTES) {
      return json({ error: "Page document is too large to publish" }, 413);
    }

    const supabase = serviceClient();

    const { data: existing, error: loadError } = await supabase
      .from("member_websites")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) return json({ error: loadError.message }, 500);

    // Resolve a stable slug for this member.
    let slug = existing?.site_slug as string | undefined;
    if (!slug) {
      const requested = typeof body.siteSlug === "string" ? body.siteSlug : "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const fallback = `site-${user.id.slice(0, 8)}`;
      let candidate = slugify(requested || profile?.full_name || "", fallback);
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: taken } = await supabase
          .from("member_websites")
          .select("id")
          .eq("site_slug", candidate)
          .maybeSingle();
        if (!taken) break;
        candidate = `${slugify(requested || profile?.full_name || "", fallback)}-${crypto.randomUUID().slice(0, 5)}`;
      }
      slug = candidate;
    }

    const customDomain = (existing?.custom_domain as string | null) ?? null;

    let attachment = { status: existing?.cloudflare_attachment_status ?? "none", error: null as string | null };
    if (customDomain) {
      attachment = await attachCustomDomain(customDomain);
    }

    const liveUrl = customDomain && attachment.status === "attached"
      ? `https://${customDomain}`
      : `${previewBase()}/${slug}`;

    const payload = {
      user_id: user.id,
      site_slug: slug,
      home_html: homeHtml,
      hair_system_html: hairSystemHtml,
      home_document: body.homeDocument ?? existing?.home_document ?? {},
      hair_system_document: body.hairSystemDocument ?? existing?.hair_system_document ?? {},
      deployment_status: "published",
      published_at: new Date().toISOString(),
      live_url: liveUrl,
      cloudflare_attachment_status: attachment.status,
      cloudflare_last_error: attachment.error,
    };

    const { data: saved, error: saveError } = existing
      ? await supabase.from("member_websites").update(payload).eq("id", existing.id).select().single()
      : await supabase.from("member_websites").insert(payload).select().single();

    if (saveError) return json({ error: saveError.message }, 500);

    return json({
      success: true,
      siteSlug: saved.site_slug,
      liveUrl: saved.live_url,
      previewUrl: `${previewBase()}/${saved.site_slug}`,
      customDomain: saved.custom_domain,
      customDomainStatus: attachment.status,
      customDomainError: attachment.error,
      publishedAt: saved.published_at,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
