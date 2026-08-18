import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_TOKEN_URL = `${GHL_BASE}/oauth/token`;

// Generic response returned to every caller, always.
const GENERIC_RESULT = {
  ok: true,
  message:
    "If that email matches a Barber Launch account, a secure recovery request has been processed.",
};

const SMS_BODY =
  "A Barber Launch password reset was requested. We sent a reset link to your email. If this wasn't you, contact support.";

// Rate limits (per rolling window)
const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function sha256(value: string) {
  const salt = Deno.env.get("RECOVERY_HASH_SALT") ??
    Deno.env.get("GHL_ENCRYPTION_KEY") ?? "barber-launch-recovery";
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
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

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  if (digits.startsWith("+") && bare.length >= 8) return `+${bare}`;
  return null;
}

type AuditRow = {
  user_id: string | null;
  email_hash: string;
  ip_hash: string | null;
  channel: "email" | "sms";
  status: "sent" | "skipped" | "failed" | "rate_limited";
  reason?: string | null;
  provider_message_id?: string | null;
};

async function audit(supabase: any, row: AuditRow) {
  const { error } = await supabase.from("password_recovery_audit").insert(row);
  if (error) console.error("audit insert failed:", error.message);
}

// ── GHL token handling ───────────────────────────────────────

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

async function getGhlAccess(supabase: any) {
  const encryptionKey = Deno.env.get("GHL_ENCRYPTION_KEY");
  if (!encryptionKey) return { error: "ghl_not_configured" as const };

  const { data: tokenRecord } = await supabase
    .from("ghl_oauth_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRecord) return { error: "ghl_not_connected" as const };

  const expiresAt = new Date(tokenRecord.expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    try {
      const accessToken = await refreshGhlToken(supabase, tokenRecord, encryptionKey);
      return { accessToken, locationId: tokenRecord.location_id as string };
    } catch (e) {
      return { error: (e instanceof Error ? e.message : "ghl_refresh_failed") as string };
    }
  }

  const { data: accessToken } = await supabase.rpc("decrypt_token", {
    token_id: tokenRecord.access_token_id,
    encryption_key: encryptionKey,
  });
  if (!accessToken) return { error: "ghl_token_unreadable" as const };

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
    console.error("contact lookup failed", e);
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
    console.error("contact create error", e);
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

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const redirectTo = typeof body?.redirectTo === "string" ? body.redirectTo : null;

    if (!email || email.length > 255 || !EMAIL_RE.test(email)) {
      return respond();
    }

    const supabase = service();
    const emailHash = await sha256(email);
    const ipHash = await sha256(clientIp(req));
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
      supabase
        .from("password_recovery_audit")
        .select("id", { count: "exact", head: true })
        .eq("email_hash", emailHash)
        .eq("channel", "email")
        .gte("requested_at", since),
      supabase
        .from("password_recovery_audit")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .eq("channel", "email")
        .gte("requested_at", since),
    ]);

    if ((emailCount ?? 0) >= MAX_PER_EMAIL || (ipCount ?? 0) >= MAX_PER_IP) {
      await audit(supabase, {
        user_id: null,
        email_hash: emailHash,
        ip_hash: ipHash,
        channel: "email",
        status: "rate_limited",
        reason: "rate_limit_window",
      });
      return respond();
    }

    // Resolve the member (never disclosed to the caller).
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, phone, full_name")
      .ilike("email", email)
      .maybeSingle();

    const userId: string | null = profile?.id ?? null;

    // 1) Real Supabase password recovery email
    let emailStatus: AuditRow["status"] = "skipped";
    let emailReason: string | null = "no_matching_account";

    if (userId) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      const appUrl = Deno.env.get("APP_URL") ?? "https://member.thebarberlaunch.com";
      const target = redirectTo && /^https?:\/\//.test(redirectTo)
        ? redirectTo
        : `${appUrl.replace(/\/$/, "")}/reset-password`;

      const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo: target });
      if (error) {
        emailStatus = "failed";
        emailReason = error.message.slice(0, 200);
      } else {
        emailStatus = "sent";
        emailReason = null;
      }
    }

    await audit(supabase, {
      user_id: userId,
      email_hash: emailHash,
      ip_hash: ipHash,
      channel: "email",
      status: emailStatus,
      reason: emailReason,
    });

    // 2) Best-effort GHL SMS security notice
    let smsStatus: AuditRow["status"] = "skipped";
    let smsReason: string | null = "no_matching_account";
    let providerMessageId: string | null = null;

    if (userId) {
      const phone = normalizePhone(profile?.phone);
      if (!phone) {
        smsReason = "no_valid_phone";
      } else {
        const access = await getGhlAccess(supabase);
        if ("error" in access) {
          smsStatus = "skipped";
          smsReason = access.error;
        } else {
          const contactId = await resolveContactId(access.accessToken!, access.locationId!, {
            email,
            phone,
            full_name: profile?.full_name ?? null,
          });
          if (!contactId) {
            smsStatus = "failed";
            smsReason = "contact_unresolved";
          } else {
            try {
              const res = await fetch(`${GHL_BASE}/conversations/messages`, {
                method: "POST",
                headers: ghlHeaders(access.accessToken!),
                body: JSON.stringify({
                  type: "SMS",
                  contactId,
                  message: SMS_BODY,
                  phone,
                }),
              });
              if (res.ok) {
                const payload = await res.json().catch(() => ({}));
                providerMessageId = payload?.messageId ?? payload?.msgId ?? payload?.conversationId ?? null;
                smsStatus = "sent";
                smsReason = null;
              } else {
                smsStatus = "failed";
                smsReason = `ghl_http_${res.status}`;
              }
            } catch (e) {
              smsStatus = "failed";
              smsReason = e instanceof Error ? e.message.slice(0, 200) : "ghl_send_error";
            }
          }
        }
      }
    }

    await audit(supabase, {
      user_id: userId,
      email_hash: emailHash,
      ip_hash: ipHash,
      channel: "sms",
      status: smsStatus,
      reason: smsReason,
      provider_message_id: providerMessageId,
    });

    return respond();
  } catch (e) {
    console.error("password-recovery-request error:", e);
    // Never leak internals; response shape is always identical.
    return respond();
  }
});
