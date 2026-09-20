// TEMPORARY read-only diagnostic: confirms GHL credentials resolve and reports
// the location's configured sender info. Sends nothing. Deleted after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGhlAccess, GHL_BASE, ghlHeaders } from "../_shared/ghlMessaging.ts";

Deno.serve(async (req) => {
  const token = req.headers.get("x-probe-token");
  if (!token || token !== Deno.env.get("GHL_SENDER_PROBE_TOKEN")) {
    return new Response("forbidden", { status: 403 });
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const access = await getGhlAccess(db);
  if ("error" in access) {
    return new Response(JSON.stringify({ credentials: false, error: access.error }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const out: Record<string, unknown> = { credentials: true, locationId: access.locationId };
  try {
    const res = await fetch(`${GHL_BASE}/locations/${access.locationId}`, {
      headers: ghlHeaders(access.accessToken),
    });
    const body = await res.text();
    out.locationStatus = res.status;
    try {
      const loc = JSON.parse(body)?.location ?? {};
      out.locationName = loc.name ?? null;
      out.locationEmail = loc.email ?? null;
      out.domain = loc.domain ?? null;
    } catch {
      out.locationRaw = body.slice(0, 300);
    }
  } catch (e) {
    out.locationError = e instanceof Error ? e.message : String(e);
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
