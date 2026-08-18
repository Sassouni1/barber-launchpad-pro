import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_TOKEN_URL = `${GHL_BASE}/oauth/token`;

const GENERIC_RESULT = {
  ok: true,
  message:
    "If an account matches that email, reset instructions were sent to the email address and, when a mobile number is on file, by text.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Throttling
const EMAIL_WINDOW_SECONDS = 60;
const IP_WINDOW_MINUTES = 60;
const MAX_PER_IP_PER_HOUR = 20;

const ALLOWED_HOSTS = [
  "member.thebarberlaunch.com",
  "barber-launchpad-pro.lovable.app",
  "find.menshairexpert.com",
  "localhost",
];

type Channel = "email" | "sms";
type Outcome = "attempted" | "sent" | "skipped" | "failed" | "rate_limited";

function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(`prda:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

function appUrl() {
  return (Deno.env.get("APP_URL") ?? "https://member.thebarberlaunch.com").replace(/\/$/, "");
}

function safeRedirect(raw: unknown): string {
  const fallback = `${appUrl()}/reset-password`;
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return fallback;
    const hostAllowed = ALLOWED_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
    if (!hostAllowed) return fallback;
    if (!url.pathname.endsWith("/reset-password")) return fallback;
    return `${url.origin}${url.pathname}`;
  } catch {
    return fallback;
  }
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  if (digits.startsWith("+") && bare.length >= 8) return `+${bare}`;
  return null;
}

async function audit(
  supabase: any,
  row: {
    user_id: string | null;
    email: string;
    channel: Channel;
    outcome: Outcome;
    reason?: string | null;
    ip_hash?: string | null;
  },
) {
  const { error } = await supabase
    .from("password_reset_delivery_attempts")
    .insert(row);
  if (error) console.error("audit insert failed:", error.message);
}

// ── GHL credentials ──────────────────────────────────────────

async function refreshGhlToken(supabase: any, tokenRecord: any, encryptionKey: string) {
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
      refresh_token: currentRefreshToken,
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

async function getGhlAccess(
  supabase: any,
): Promise<{ accessToken: string; locationId: string } | { error: string }> {
  // Direct token fallback (private integration / static access token)
  const directToken = Deno.env.get("GHL_ACCESS_TOKEN") ??
    Deno.env.get("GHL_PRIVATE_INTEGRATION_TOKEN");
  const directLocation = Deno.env.get("GHL_LOCATION_ID");
  if (directToken && directLocation) {
    return { accessToken: directToken, locationId: directLocation };
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

function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-04-15",
  };
}

async function resolveContactId(
  token: string,
  locationId: string,
  profile: { email: string; phone: string; full_name: string | null },
): Promise<string | null> {
  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&email=${encodeURIComponent(profile.email)}`,
      { headers: ghlHeaders(token) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.contact?.id) return data.contact.id;
    }
  } catch (e) {
    console.error("contact lookup failed", e instanceof Error ? e.message : "unknown");
  }

  const parts = (profile.full_name || "").trim().split(/\s+/);
  try {
    const createRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify({
        locationId,
        firstName: parts[0] || "Member",
        lastName: parts.slice(1).join(" ") || "",
        phone: profile.phone,
        email: profile.email,
      }),
    });
    if (createRes.ok) {
      const created = await createRes.json();
      return created?.contact?.id ?? null;
    }
    console.error("contact create failed", createRes.status);
  } catch (e) {
    console.error("contact create error", e instanceof Error ? e.message : "unknown");
  }
  return null;
}

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = () =>
    new Response(JSON.stringify(GENERIC_RESULT), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return respond();

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const redirectTo = safeRedirect(body?.redirectTo);

    if (!email || email.length > 255 || !EMAIL_RE.test(email)) {
      return respond();
    }

    const supabase = service();
    const ipHash = await sha256(clientIp(req));

    const emailSince = new Date(Date.now() - EMAIL_WINDOW_SECONDS * 1000).toISOString();
    const ipSince = new Date(Date.now() - IP_WINDOW_MINUTES * 60 * 1000).toISOString();

    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      supabase
        .from("password_reset_delivery_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("channel", "email")
        .in("outcome", ["attempted", "sent", "failed"])
        .gte("requested_at", emailSince),
      supabase
        .from("password_reset_delivery_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .eq("channel", "email")
        .gte("requested_at", ipSince),
    ]);

    if ((emailCount ?? 0) >= 1 || (ipCount ?? 0) >= MAX_PER_IP_PER_HOUR) {
      await audit(supabase, {
        user_id: null,
        email,
        channel: "email",
        outcome: "rate_limited",
        reason: (emailCount ?? 0) >= 1 ? "email_cooldown" : "ip_hourly_cap",
        ip_hash: ipHash,
      });
      return respond();
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, phone, full_name")
      .ilike("email", email)
      .maybeSingle();

    const userId: string | null = profile?.id ?? null;

    if (!userId) {
      await audit(supabase, {
        user_id: null,
        email,
        channel: "email",
        outcome: "skipped",
        reason: "no_matching_account",
        ip_hash: ipHash,
      });
      return respond();
    }

    // 1) Standard Supabase Auth recovery email
    await audit(supabase, {
      user_id: userId,
      email,
      channel: "email",
      outcome: "attempted",
      reason: null,
      ip_hash: ipHash,
    });

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { error: emailError } = await anon.auth.resetPasswordForEmail(email, { redirectTo });

    await audit(supabase, {
      user_id: userId,
      email,
      channel: "email",
      outcome: emailError ? "failed" : "sent",
      reason: emailError ? "provider_error" : null,
      ip_hash: ipHash,
    });

    // 2) Optional SMS with a server-generated recovery link
    const phone = normalizePhone(profile?.phone);
    if (!phone) {
      await audit(supabase, {
        user_id: userId,
        email,
        channel: "sms",
        outcome: "skipped",
        reason: "no_valid_phone",
        ip_hash: ipHash,
      });
      return respond();
    }

    const access = await getGhlAccess(supabase);
    if ("error" in access) {
      await audit(supabase, {
        user_id: userId,
        email,
        channel: "sms",
        outcome: "skipped",
        reason: access.error,
        ip_hash: ipHash,
      });
      return respond();
    }

    let recoveryLink: string | null = null;
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkError) throw new Error("generate_link_failed");
      recoveryLink = linkData?.properties?.action_link ?? null;
    } catch {
      recoveryLink = null;
    }

    if (!recoveryLink) {
      await audit(supabase, {
        user_id: userId,
        email,
        channel: "sms",
        outcome: "failed",
        reason: "recovery_link_unavailable",
        ip_hash: ipHash,
      });
      return respond();
    }

    const contactId = await resolveContactId(access.accessToken, access.locationId, {
      email,
      phone,
      full_name: profile?.full_name ?? null,
    });

    if (!contactId) {
      await audit(supabase, {
        user_id: userId,
        email,
        channel: "sms",
        outcome: "failed",
        reason: "contact_unresolved",
        ip_hash: ipHash,
      });
      return respond();
    }

    await audit(supabase, {
      user_id: userId,
      email,
      channel: "sms",
      outcome: "attempted",
      reason: null,
      ip_hash: ipHash,
    });

    try {
      const res = await fetch(`${GHL_BASE}/conversations/messages`, {
        method: "POST",
        headers: ghlHeaders(access.accessToken),
        body: JSON.stringify({
          type: "SMS",
          contactId,
          phone,
          message:
            `The Barber Launch: reset your password here: ${recoveryLink}. This link expires and can only be used once.`,
        }),
      });
      await audit(supabase, {
        user_id: userId,
        email,
        channel: "sms",
        outcome: res.ok ? "sent" : "failed",
        reason: res.ok ? null : `ghl_http_${res.status}`,
        ip_hash: ipHash,
      });
    } catch {
      await audit(supabase, {
        user_id: userId,
        email,
        channel: "sms",
        outcome: "failed",
        reason: "ghl_send_error",
        ip_hash: ipHash,
      });
    }

    return respond();
  } catch (e) {
    console.error("request-password-reset error:", e instanceof Error ? e.message : "unknown");
    return respond();
  }
});
