import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireUser, serviceClient, slugify } from "../_shared/websiteAuth.ts";
import { deploySiteWorker, type WorkerSyncResult } from "../_shared/siteWorker.ts";

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

type AttachOutcome = {
  status: "active" | "pending" | "failed" | "unavailable" | "none";
  workerDomainId: string | null;
  error: string | null;
};

/**
 * Attaches the configured hostname to the shared member-sites Worker.
 * Works for any domain already managed in this Cloudflare account — registrar
 * registration status is irrelevant. Idempotent: an existing binding is reused.
 * Only ever called from a member-initiated publish.
 */
async function attachCustomDomain(hostname: string): Promise<AttachOutcome> {
  const cf = cloudflareConfig();
  if (!cf) {
    return { status: "unavailable", workerDomainId: null, error: "Cloudflare credentials are not configured" };
  }
  const headers = {
    Authorization: `Bearer ${cf.token}`,
    "Content-Type": "application/json",
  };

  // Resolve the active zone for the hostname (apex or a subdomain of it).
  const labels = hostname.split(".");
  let zone: { id?: string; name?: string } | undefined;
  for (let i = 0; i < labels.length - 1 && !zone?.id; i++) {
    const candidate = labels.slice(i).join(".");
    const zoneRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(candidate)}&status=active`,
      { headers },
    );
    const zoneJson = await zoneRes.json().catch(() => ({}));
    zone = zoneJson?.result?.[0];
  }
  if (!zone?.id) {
    return {
      status: "pending",
      workerDomainId: null,
      error: "This domain is not an active zone in the connected Cloudflare account yet",
    };
  }


  const existingRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/workers/domains?hostname=${encodeURIComponent(hostname)}`,
    { headers },
  );
  const existingJson = await existingRes.json().catch(() => ({}));
  const existing = Array.isArray(existingJson?.result) ? existingJson.result[0] : null;
  if (existing?.id) {
    return { status: "active", workerDomainId: String(existing.id), error: null };
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
        zone_id: zone.id,
        zone_name: zone.name ?? hostname,
      }),
    },
  );
  const attachJson = await attachRes.json().catch(() => ({}));
  if (!attachRes.ok || attachJson?.success === false) {
    return {
      status: "failed",
      workerDomainId: null,
      error: String(attachJson?.errors?.[0]?.message ?? `Cloudflare error ${attachRes.status}`),
    };
  }
  return { status: "active", workerDomainId: attachJson?.result?.id ? String(attachJson.result.id) : null, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, error: authError } = await requireUser(req);
    if (!user) return json({ error: authError }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // One shared contract: an array of configured pages rendered by the editor.
    const rawPages = Array.isArray(body.pages) ? body.pages : [];
    const pages = rawPages
      .map((p) => p as Record<string, unknown>)
      .filter((p) => typeof p?.path === "string" && typeof p?.html === "string")
      .map((p) => ({
        key: typeof p.key === "string" ? p.key : String(p.path),
        path: String(p.path),
        html: String(p.html),
      }));

    if (pages.length === 0) {
      return json({ error: "At least one rendered page is required to publish" }, 400);
    }
    if (pages.length > 25) {
      return json({ error: "Too many pages in one publish request" }, 400);
    }
    if (pages.some((p) => !p.html.trim())) {
      return json({ error: "A rendered page was empty" }, 400);
    }
    if (pages.some((p) => p.html.length > MAX_HTML_BYTES)) {
      return json({ error: "Page document is too large to publish" }, 413);
    }

    const supabase = serviceClient();

    // Template and target domain come from server-side configuration only —
    // never from the request body.
    const { data: entitlement } = await supabase
      .from("website_editor_entitlements")
      .select("template_key, custom_domain")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entitlement) {
      return json({ error: "Your account is not set up for website publishing" }, 403);
    }


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

    const previewUrl = `${previewBase()}/${slug}`;
    // The configured domain is adopted the first time the member publishes.
    const customDomain = (entitlement.custom_domain as string | null) ??
      (existing?.custom_domain as string | null) ?? null;

    let attachment: AttachOutcome = {
      status: (existing?.cloudflare_attachment_status as AttachOutcome["status"]) ?? "none",
      workerDomainId: (existing?.cloudflare_worker_domain_id as string | null) ?? null,
      error: null,
    };
    let workerSync: WorkerSyncResult | null = null;
    if (customDomain) {
      // Never point a live domain at a stale Worker: sync the canonical Worker
      // source first, and only attach the domain if that succeeded.
      const cf = cloudflareConfig();
      if (!cf) {
        attachment = { status: "unavailable", workerDomainId: null, error: "Cloudflare credentials are not configured" };
      } else {
        workerSync = await deploySiteWorker(cf.accountId, cf.token);
        if (!workerSync.ok) {
          attachment = { status: "failed", workerDomainId: null, error: `Site host update failed: ${workerSync.error}` };
        } else {
          attachment = await attachCustomDomain(customDomain);
        }
      }
    }


    const domainActive = Boolean(customDomain) && attachment.status === "active";
    const deploymentStatus = customDomain && !domainActive ? "domain_pending" : "published";
    const liveUrl = domainActive ? `https://${customDomain}` : previewUrl;

    const publishedPages: Record<string, string> = {};
    for (const p of pages) {
      publishedPages[p.path.startsWith("/") ? p.path : `/${p.path}`] = p.html;
    }

    const payload = {
      user_id: user.id,
      site_slug: slug,
      template_key: entitlement.template_key,
      custom_domain: customDomain,
      published_pages: publishedPages,
      deployment_status: deploymentStatus,
      published_at: new Date().toISOString(),
      live_url: liveUrl,
      cloudflare_attachment_status: customDomain ? attachment.status : "none",
      cloudflare_worker_domain_id: attachment.workerDomainId ??
        (existing?.cloudflare_worker_domain_id as string | null) ?? null,
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
      previewUrl,
      customDomain: saved.custom_domain,
      deploymentStatus,
      customDomainStatus: customDomain ? (domainActive ? "active" : "pending") : "none",
      customDomainError: attachment.error,
      publishedAt: saved.published_at,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
