// Shared GoHighLevel messaging helpers.
//
// Uses the SAME OAuth connection/location that password recovery uses:
// ghl_oauth_tokens + GHL_ENCRYPTION_KEY + GHL_CLIENT_ID/GHL_CLIENT_SECRET.
// No phone number or location is hard-coded anywhere here — the connected
// location's approved channel is whatever GHL resolves for the contact.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_TOKEN_URL = `${GHL_BASE}/oauth/token`;

export type GhlAccess = { accessToken: string; locationId: string };
export type GhlAccessResult = GhlAccess | { error: string };

async function refreshGhlToken(
  supabase: SupabaseClient,
  tokenRecord: Record<string, any>,
  encryptionKey: string,
) {
  const clientId = Deno.env.get("GHL_CLIENT_ID");
  const clientSecret = Deno.env.get("GHL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("ghl_credentials_missing");

  const { data: currentRefreshToken } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.refresh_token_id,
    encryption_key: encryptionKey,
  });
  if (!currentRefreshToken) throw new Error("ghl_refresh_token_unreadable");

  const res = await fetch(GHL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: currentRefreshToken as string,
    }),
  });
  if (!res.ok) throw new Error(`ghl_refresh_failed_${res.status}`);
  const tokenData = await res.json();

  await supabase.from("app_secrets").delete().eq("id", tokenRecord.access_token_id);
  await supabase.from("app_secrets").delete().eq("id", tokenRecord.refresh_token_id);

  const { data: newAccessId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.access_token,
    encryption_key: encryptionKey,
  });
  const { data: newRefreshId } = await supabase.rpc("store_encrypted_token", {
    token_value: tokenData.refresh_token,
    encryption_key: encryptionKey,
  });

  await supabase
    .from("ghl_oauth_tokens")
    .update({
      access_token_id: newAccessId,
      refresh_token_id: newRefreshId,
      expires_at: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRecord.id);

  return tokenData.access_token as string;
}

export async function getGhlAccess(supabase: SupabaseClient): Promise<GhlAccessResult> {
  // Same precedence as the other live GHL functions: a directly configured
  // token/location wins, otherwise fall back to the stored OAuth connection.
  const directToken =
    Deno.env.get("GHL_ACCESS_TOKEN") ||
    Deno.env.get("GHL_PRIVATE_INTEGRATION_TOKEN") ||
    Deno.env.get("GHL_API_KEY");
  const directLocationId = Deno.env.get("GHL_LOCATION_ID");
  if (directToken && directLocationId) {
    return { accessToken: directToken, locationId: directLocationId };
  }

  const encryptionKey = Deno.env.get("GHL_ENCRYPTION_KEY");
  if (!encryptionKey) return { error: "ghl_not_configured" };

  const { data: tokenRecord } = await supabase
    .from("ghl_oauth_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRecord) return { error: "ghl_not_connected" };

  const expiresAt = new Date(tokenRecord.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const accessToken = await refreshGhlToken(supabase, tokenRecord, encryptionKey);
      return { accessToken, locationId: tokenRecord.location_id as string };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "ghl_refresh_failed" };
    }
  }

  const { data: accessToken } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.access_token_id,
    encryption_key: encryptionKey,
  });
  if (!accessToken) return { error: "ghl_token_unreadable" };

  return { accessToken: accessToken as string, locationId: tokenRecord.location_id as string };
}

export function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-04-15",
  };
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  if (digits.startsWith("+") && bare.length >= 8) return `+${bare}`;
  return null;
}

/** Find an existing contact by email, otherwise create one in the connected location. */
export async function resolveContactId(
  access: GhlAccess,
  profile: { email: string; phone?: string | null; name?: string | null },
): Promise<string | null> {
  const { accessToken: token, locationId } = access;
  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(profile.email)}`,
      { headers: ghlHeaders(token) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.contact?.id) return data.contact.id as string;
    }
  } catch (e) {
    console.error("ghl contact lookup failed", e instanceof Error ? e.message : e);
  }

  const parts = (profile.name || "").trim().split(/\s+/).filter(Boolean);
  try {
    const createRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify({
        locationId,
        firstName: parts[0] || "Customer",
        lastName: parts.slice(1).join(" ") || "",
        email: profile.email,
        ...(profile.phone ? { phone: profile.phone } : {}),
      }),
    });
    if (createRes.ok) {
      const created = await createRes.json();
      return created?.contact?.id ?? null;
    }
    console.error("ghl contact create failed", createRes.status);
  } catch (e) {
    console.error("ghl contact create error", e instanceof Error ? e.message : e);
  }
  return null;
}

export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: string };

function messageId(payload: any): string | null {
  return payload?.messageId ?? payload?.msgId ?? payload?.conversationId ?? null;
}

export async function sendGhlEmail(
  access: GhlAccess,
  input: { contactId: string; emailFrom?: string; emailTo: string; subject: string; html: string },
): Promise<SendResult> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: ghlHeaders(access.accessToken),
      body: JSON.stringify({
        type: "Email",
        contactId: input.contactId,
        ...(input.emailFrom ? { emailFrom: input.emailFrom } : {}),
        emailTo: input.emailTo,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, reason: `ghl_email_http_${res.status}:${detail}` };
    }
    return { ok: true, messageId: messageId(await res.json().catch(() => ({}))) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 200) : "ghl_email_error" };
  }
}

export async function sendGhlSms(
  access: GhlAccess,
  input: { contactId: string; phone: string; message: string },
): Promise<SendResult> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: ghlHeaders(access.accessToken),
      body: JSON.stringify({
        type: "SMS",
        contactId: input.contactId,
        phone: input.phone,
        message: input.message,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, reason: `ghl_sms_http_${res.status}:${detail}` };
    }
    return { ok: true, messageId: messageId(await res.json().catch(() => ({}))) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 200) : "ghl_sms_error" };
  }
}
