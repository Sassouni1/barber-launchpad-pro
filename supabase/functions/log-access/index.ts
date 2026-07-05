import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function detectDevice(ua: string | null): string | null {
  if (!ua) return null;
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/iphone|android|mobile/.test(s)) return "mobile";
  return "desktop";
}

async function geolocate(ip: string | null): Promise<{
  country?: string | null;
  region?: string | null;
  city?: string | null;
  isp?: string | null;
  timezone?: string | null;
}> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) return {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,timezone`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    if (!res.ok) return {};
    const j = await res.json();
    if (j.status !== "success") return {};
    return {
      country: j.country ?? null,
      region: j.regionName ?? null,
      city: j.city ?? null,
      isp: j.isp ?? null,
      timezone: j.timezone ?? null,
    };
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const event_type = String(body.event_type || "").slice(0, 64);
    if (!event_type) {
      return new Response(JSON.stringify({ error: "event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resource_type = body.resource_type ? String(body.resource_type).slice(0, 64) : null;
    const resource_id = body.resource_id ? String(body.resource_id).slice(0, 256) : null;
    const route = body.route ? String(body.route).slice(0, 512) : null;
    const session_id = body.session_id ? String(body.session_id).slice(0, 128) : null;
    const referrer = body.referrer ? String(body.referrer).slice(0, 512) : null;
    const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};

    // Server-side capture — cannot be spoofed by client body
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip_address =
      xff.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;
    const user_agent = req.headers.get("user-agent") || null;
    const device_type = detectDevice(user_agent);

    // Prefer Cloudflare geo headers if available (free, instant); fallback to ip-api
    const cfCountry = req.headers.get("cf-ipcountry");
    let geo: Awaited<ReturnType<typeof geolocate>> = {};
    if (cfCountry && cfCountry !== "XX") {
      geo = {
        country: cfCountry,
        region: req.headers.get("cf-region") || null,
        city: req.headers.get("cf-ipcity") || null,
        timezone: req.headers.get("cf-timezone") || null,
      };
    } else {
      geo = await geolocate(ip_address);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await admin.from("access_log").insert({
      user_id: userId,
      event_type,
      resource_type,
      resource_id,
      route,
      ip_address,
      user_agent,
      session_id,
      metadata,
      referrer,
      device_type,
      country: geo.country ?? null,
      region: geo.region ?? null,
      city: geo.city ?? null,
      isp: geo.isp ?? null,
      timezone: geo.timezone ?? null,
    });

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("log-access error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
