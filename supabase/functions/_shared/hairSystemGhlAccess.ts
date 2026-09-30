// GoHighLevel access for the hair-system post-payment pipeline.
// Order: stored Marketplace OAuth (if connected to the approved location),
// else the existing server-side direct credential (GHL_ACCESS_TOKEN /
// GHL_PRIVATE_INTEGRATION_TOKEN / GHL_API_KEY + GHL_LOCATION_ID).
// Fails closed unless the location is exactly JVBUuL3dVwZahuGay9T1.
// Token values are never logged or returned.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GHL_BASE, getGhlAccess, ghlHeaders, type GhlAccess } from "./ghlMessaging.ts";

export const APPROVED_GHL_LOCATION_ID = "JVBUuL3dVwZahuGay9T1";

export type HairGhlAccess = (GhlAccess & { source: string }) | { error: string };

export function directGhlCredential(): { token: string; source: string; locationId: string | null } | null {
  for (const name of ["GHL_ACCESS_TOKEN", "GHL_PRIVATE_INTEGRATION_TOKEN", "GHL_API_KEY"]) {
    const v = (Deno.env.get(name) ?? "").trim();
    if (v) return { token: v, source: name, locationId: (Deno.env.get("GHL_LOCATION_ID") ?? "").trim() || null };
  }
  return null;
}

export async function hairSystemGhlAccess(db: SupabaseClient): Promise<HairGhlAccess> {
  const { data: tok } = await db.from("ghl_oauth_tokens").select("id").limit(1).maybeSingle();
  if (tok) {
    const oauth = await getGhlAccess(db, { oauthOnly: true });
    if ("error" in oauth) return oauth;
    if (oauth.locationId !== APPROVED_GHL_LOCATION_ID) return { error: "ghl_oauth_wrong_location" };
    return { ...oauth, source: "oauth" };
  }
  const direct = directGhlCredential();
  if (!direct) return { error: "ghl_not_configured" };
  if (!direct.locationId) return { error: `ghl_direct_missing_location:${direct.source}` };
  if (direct.locationId !== APPROVED_GHL_LOCATION_ID) return { error: `ghl_direct_wrong_location:${direct.source}` };
  return { accessToken: direct.token, locationId: direct.locationId, source: direct.source };
}

/** Read-only probe. Returns only statuses and booleans. */
export async function probeHairSystemGhl(db: SupabaseClient) {
  const direct = directGhlCredential();
  const out: Record<string, unknown> = {
    directCredentialSource: direct?.source ?? null,
    directLocationConfigured: !!direct?.locationId,
    directLocationMatches: direct?.locationId === APPROVED_GHL_LOCATION_ID,
    tokenShape: direct ? (direct.token.startsWith("pit-") ? "private_integration" : direct.token.split(".").length === 3 ? "jwt" : "other") : null,
  };
  const access = await hairSystemGhlAccess(db);
  if ("error" in access) return { ...out, ready: false, reason: access.error };
  out.accessSource = access.source;
  const call = async (path: string) => {
    try {
      const r = await fetch(`${GHL_BASE}${path}`, { headers: ghlHeaders(access.accessToken) });
      const body = r.ok ? "" : (await r.text().catch(() => "")).slice(0, 160);
      return { status: r.status, ok: r.ok, ...(body ? { detail: body } : {}) };
    } catch (e) {
      return { status: 0, ok: false, detail: e instanceof Error ? e.message.slice(0, 120) : "fetch_error" };
    }
  };
  const loc = APPROVED_GHL_LOCATION_ID;
  out.location = await call(`/locations/${loc}`);
  out.contactsRead = await call(`/contacts/?locationId=${loc}&limit=1`);
  out.conversationsRead = await call(`/conversations/search?locationId=${loc}&limit=1`);
  const ok = (k: string) => (out[k] as any)?.ok === true;
  out.ready = ok("contactsRead") && ok("conversationsRead");
  return out;
}
