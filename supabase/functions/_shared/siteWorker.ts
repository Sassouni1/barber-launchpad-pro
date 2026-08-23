/**
 * Canonical source for the shared Cloudflare member-sites Worker
 * (CLOUDFLARE_SITE_WORKER_NAME, default "barber-launch-member-sites").
 *
 * This is the single place the Worker is authored and versioned. It is uploaded
 * to Cloudflare by the admin-only `deploy-site-worker` action in this function,
 * so the deployed script always matches this repository.
 *
 * Contract:
 *  - Reads the public `published_sites` view with the anon key (published page
 *    HTML only; drafts are never exposed there).
 *  - Serves the template's configured published page paths from `published_pages`.
 *  - Every other route/asset passes through to the site's configured
 *    `legacy_origin`, so service pages, booking, robots, sitemap, CSS and images
 *    keep working once the custom domain points at this Worker.
 *
 * NOTE: the worker body below must not use backticks or ${ } so it can live in a
 * String.raw literal.
 */
export const SITE_WORKER_VERSION = "2026-08-23.generic-pages";

export const SITE_WORKER_SOURCE = String.raw`
const SELECT = "site_slug,custom_domain,template_key,published_pages,published_at,legacy_origin";

function normalizePath(pathname) {
  let p = pathname || "/";
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

function pageCandidates(path) {
  const p = normalizePath(path);
  const list = [p];
  if (p !== "/") {
    list.push(p + "/");
    if (p.endsWith(".html")) list.push(p.slice(0, -5));
    else list.push(p + ".html");
  }
  return list;
}

function matchPage(pages, path) {
  if (!pages) return null;
  const candidates = pageCandidates(path);
  for (const c of candidates) {
    const html = pages[c];
    if (typeof html === "string" && html.length > 0) return html;
  }
  const lower = normalizePath(path).toLowerCase();
  for (const key of Object.keys(pages)) {
    if (normalizePath(key).toLowerCase() === lower) {
      const html = pages[key];
      if (typeof html === "string" && html.length > 0) return html;
    }
  }
  return null;
}

async function loadSite(env, filter) {
  const url = env.SUPABASE_URL.replace(/\/+$/, "") +
    "/rest/v1/published_sites?select=" + SELECT + "&" + filter + "&limit=1";
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + env.SUPABASE_ANON_KEY,
      Accept: "application/json",
    },
    cf: { cacheTtl: 15, cacheEverything: true },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(function () { return []; });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function htmlResponse(html) {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Barber-Launch-Site": "published",
    },
  });
}

async function proxyLegacy(request, url, legacyOrigin) {
  const origin = String(legacyOrigin).replace(/\/+$/, "");
  const target = new URL(origin);
  target.pathname = url.pathname;
  target.search = url.search;

  const upstream = new Request(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
  upstream.headers.delete("host");

  const res = await fetch(upstream);
  const headers = new Headers(res.headers);
  headers.set("X-Barber-Launch-Site", "legacy");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const previewHost = (env.PREVIEW_HOST || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");

    let site = null;
    let path = url.pathname;

    if (previewHost && host === previewHost) {
      const parts = url.pathname.split("/").filter(Boolean);
      const slug = parts.shift() || "";
      if (!slug) return new Response("Not found", { status: 404 });
      site = await loadSite(env, "site_slug=eq." + encodeURIComponent(slug));
      path = "/" + parts.join("/");
    } else {
      site = await loadSite(env, "custom_domain=eq." + encodeURIComponent(host));
    }

    if (!site) return new Response("Not found", { status: 404 });

    const html = matchPage(site.published_pages, path);
    if (html) return htmlResponse(html);

    if (site.legacy_origin) return proxyLegacy(request, url, site.legacy_origin);

    return new Response("Not found", { status: 404 });
  },
};
`;
