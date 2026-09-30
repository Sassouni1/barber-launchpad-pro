// Server-side relay to the existing Vlix Booking GHL Marketplace connector
// installed in The Barber Launch location. The OAuth token never leaves Vlix;
// we authenticate with the existing server-side GHL_API_KEY (never logged or
// returned). Only statuses, contact IDs and message IDs are surfaced.

export const RELAY_URL = "https://prjzhyzgfphiajhguzzu.supabase.co/functions/v1/barber-launch-order-ghl";
export const RELAY_LOCATION_ID = "JVBUuL3dVwZahuGay9T1";

export type RelayResult = { ok: true; contactId?: string | null; messageId?: string | null; data: Record<string, unknown> } | { ok: false; reason: string };

type FetchLike = typeof fetch;
let fetchImpl: FetchLike = (...a) => fetch(...a);
export function __setRelayFetch(f: FetchLike) { fetchImpl = f; }

function scrub(s: string, key: string) {
  return key ? s.split(key).join("[redacted]") : s;
}

export async function relayCall(action: string, payload: Record<string, unknown> = {}): Promise<RelayResult> {
  const key = (Deno.env.get("GHL_API_KEY") ?? "").trim();
  if (!key) return { ok: false, reason: "relay_key_missing" };
  try {
    const res = await fetchImpl(RELAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const text = await res.text().catch(() => "");
    let data: Record<string, any> = {};
    try { data = JSON.parse(text); } catch { /* non-json */ }
    if (!res.ok || data.ok === false || data.error) {
      const detail = scrub(String(data.error ?? text).slice(0, 240), key);
      return { ok: false, reason: `relay_${action}_http_${res.status}:${detail}` };
    }
    delete data.token; delete data.access_token; delete data.accessToken;
    return { ok: true, contactId: data.contactId ?? null, messageId: data.messageId ?? null, data };
  } catch (e) {
    return { ok: false, reason: `relay_${action}_error:${e instanceof Error ? scrub(e.message, key).slice(0, 160) : "fetch"}` };
  }
}

export async function relayProbe() {
  const r = await relayCall("probe");
  if (!r.ok) return { ready: false, reason: r.reason };
  const loc = String((r.data as any).locationId ?? (r.data as any).location?.id ?? (r.data as any).location ?? "");
  const matches = loc === RELAY_LOCATION_ID;
  return { ready: matches, locationId: loc || null, connector: (r.data as any).connector ?? null, ...(matches ? {} : { reason: "relay_wrong_location" }) };
}
