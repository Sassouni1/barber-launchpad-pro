import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_V1_BASE = "https://rest.gohighlevel.com/v1";

// Never varies by account state — enumeration protection.
const GENERIC_RESULT = {
  ok: true,
  message:
    "If an account matches that email, reset instructions will be sent through Barber Launch's configured delivery channels.",
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
    const isPreviewHost =
      url.hostname === "barber-launch-pwa-preview.pages.dev" ||
      url.hostname.endsWith(".barber-launch-pwa-preview.pages.dev");
    if (!hostAllowed && !isPreviewHost) return fallback;
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
  // NOTE: reasons must never contain the recovery link or token.
  const { error } = await supabase
    .from("password_reset_delivery_attempts")
    .insert(row);
  if (error) console.error("audit insert failed:", error.message);
}

// ── GHL credentials (secrets only; never returned to the browser) ──
//
// Resolution order:
//   1. GHL_API_KEY        + GHL_LOCATION_ID   (canonical for this project)
//   2. GHL_ACCESS_TOKEN   + GHL_LOCATION_ID   (optional legacy fallback)
//   3. GHL_PRIVATE_INTEGRATION_TOKEN + GHL_LOCATION_ID (optional legacy fallback)
// No OAuth exchange and no ghl_oauth_tokens row is required.

function getGhlCredentials():
  | { token: string; locationId: string; source: string }
  | { error: string } {
  const locationId = Deno.env.get("GHL_LOCATION_ID");
  if (!locationId) return { error: "ghl_location_id_missing" };

  const apiKey = Deno.env.get("GHL_API_KEY");
  if (apiKey) return { token: apiKey, locationId, source: "api_key" };

  const legacy = Deno.env.get("GHL_ACCESS_TOKEN");
  if (legacy) return { token: legacy, locationId, source: "access_token" };

  const pit = Deno.env.get("GHL_PRIVATE_INTEGRATION_TOKEN");
  if (pit) return { token: pit, locationId, source: "private_integration_token" };

  return { error: "ghl_credentials_missing" };
}

function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Version: "2021-04-15",
  };
}

function needsV1Fallback(status: number) {
  return status === 401 || status === 403 || status === 404;
}

/** Resolve an existing GHL contact by email. Returns id + phone on file. */
async function resolveContact(
  token: string,
  locationId: string,
  email: string,
): Promise<{ id: string; phone: string | null } | { error: string }> {
  // v2 duplicate search
  try {
    const res = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${encodeURIComponent(locationId)}&email=${encodeURIComponent(email)}`,
      { headers: ghlHeaders(token) },
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const c = data?.contact;
      if (c?.id) return { id: c.id, phone: c.phone ?? null };
      return { error: "contact_not_found" };
    }
    if (!needsV1Fallback(res.status)) {
      return { error: `ghl_lookup_http_${res.status}` };
    }
  } catch (e) {
    console.error("v2 contact lookup error", e instanceof Error ? e.message : "unknown");
  }

  // v1 lookup (legacy location API keys)
  try {
    const res = await fetch(
      `${GHL_V1_BASE}/contacts/lookup?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const c = Array.isArray(data?.contacts) ? data.contacts[0] : null;
      if (c?.id) return { id: c.id, phone: c.phone ?? null };
      return { error: "contact_not_found" };
    }
    return { error: `ghl_lookup_http_${res.status}` };
  } catch (e) {
    return { error: e instanceof Error ? `ghl_lookup_error` : "ghl_lookup_error" };
  }
}

type SendResult = { ok: true } | { ok: false; reason: string };

async function ghlSend(
  token: string,
  payload: Record<string, unknown>,
): Promise<SendResult> {
  try {
    const res = await fetch(`${GHL_BASE}/conversations/messages`, {
      method: "POST",
      headers: ghlHeaders(token),
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (!needsV1Fallback(res.status)) {
      return { ok: false, reason: `ghl_http_${res.status}` };
    }
  } catch {
    return { ok: false, reason: "ghl_send_error" };
  }

  // v1 conversations endpoint fallback for legacy location API keys
  try {
    const res = await fetch(`${GHL_V1_BASE}/conversations/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: `ghl_v1_http_${res.status}` };
  } catch {
    return { ok: false, reason: "ghl_send_error" };
  }
}

function resetEmailHtml(firstName: string, link: string) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0b0b0b;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:32px;">
        <tr><td style="color:#c9a24a;font-size:20px;font-weight:bold;letter-spacing:1px;padding-bottom:16px;">THE BARBER LAUNCH</td></tr>
        <tr><td style="color:#f5f5f5;font-size:22px;font-weight:bold;padding-bottom:12px;">Reset your password</td></tr>
        <tr><td style="color:#c8c8c8;font-size:15px;line-height:22px;padding-bottom:24px;">
          ${greeting}<br><br>
          We received a request to reset the password for your Barber Launch Academy account.
          Tap the button below to create a new password. This link expires and can only be used once.
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <a href="${link}" style="display:inline-block;background:#c9a24a;color:#111111;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 28px;border-radius:8px;">Create New Password</a>
        </td></tr>
        <tr><td style="color:#8a8a8a;font-size:13px;line-height:20px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <span style="color:#c9a24a;word-break:break-all;">${link}</span><br><br>
          If you didn't request this, you can safely ignore this email — your password will stay the same.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Handler ──────────────────────────────────────────────────

// ── Opaque short-code helpers ────────────────────────────────

const CODE_RE = /^[A-Za-z0-9_-]{32,64}$/;

function generateCode() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashCode(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`prsl:${code}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return respond();


  try {
    const body = await req.json().catch(() => ({}));

    // ── Action: resolve an opaque short code into its recovery token_hash ──
    if (body?.action === "resolve-reset-link") {
      const genericFail = () => json({ ok: false, error: "invalid_or_expired" }, 400);
      const code = String(body?.code ?? "");
      if (!CODE_RE.test(code)) return genericFail();

      const supabase = service();
      const codeHash = await hashCode(code);
      const nowIso = new Date().toISOString();

      // Atomic single-use consumption.
      const { data: consumed, error: consumeError } = await supabase
        .from("password_reset_short_links")
        .update({ used_at: nowIso })
        .eq("code_hash", codeHash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .select("token_hash")
        .maybeSingle();

      if (consumeError || !consumed?.token_hash) return genericFail();
      return json({ ok: true, token_hash: consumed.token_hash });
    }

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

    await audit(supabase, {
      user_id: userId,
      email,
      channel: "email",
      outcome: "attempted",
      reason: null,
      ip_hash: ipHash,
    });

    // 1) Server-side one-time recovery link (no Lovable Auth mail is sent).
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
      for (const channel of ["email", "sms"] as Channel[]) {
        await audit(supabase, {
          user_id: userId,
          email,
          channel,
          outcome: "failed",
          reason: "recovery_link_unavailable",
          ip_hash: ipHash,
        });
      }
      return respond();
    }

    // 2) GHL credentials from secrets only.
    const creds = getGhlCredentials();
    if ("error" in creds) {
      for (const channel of ["email", "sms"] as Channel[]) {
        await audit(supabase, {
          user_id: userId,
          email,
          channel,
          outcome: "failed",
          reason: creds.error,
          ip_hash: ipHash,
        });
      }
      return respond();
    }

    // 3) Resolve the existing GHL contact by email.
    const contact = await resolveContact(creds.token, creds.locationId, email);
    if ("error" in contact) {
      for (const channel of ["email", "sms"] as Channel[]) {
        await audit(supabase, {
          user_id: userId,
          email,
          channel,
          outcome: "failed",
          reason: contact.error,
          ip_hash: ipHash,
        });
      }
      return respond();
    }

    const firstName = (profile?.full_name || "").trim().split(/\s+/)[0] || "";

    // 4) Branded reset email through GHL's configured outbound sender.
    const emailResult = await ghlSend(creds.token, {
      type: "Email",
      contactId: contact.id,
      emailTo: email,
      subject: "Reset your Barber Launch password",
      html: resetEmailHtml(firstName, recoveryLink),
      message:
        `Reset your Barber Launch password here: ${recoveryLink} — this link expires and can only be used once.`,
    });

    await audit(supabase, {
      user_id: userId,
      email,
      channel: "email",
      outcome: emailResult.ok ? "sent" : "failed",
      reason: emailResult.ok ? null : emailResult.reason,
      ip_hash: ipHash,
    });

    // 5) Same link by SMS when a valid phone exists (profile first, then GHL contact).
    const phone = normalizePhone(profile?.phone) ?? normalizePhone(contact.phone);
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

    await audit(supabase, {
      user_id: userId,
      email,
      channel: "sms",
      outcome: "attempted",
      reason: null,
      ip_hash: ipHash,
    });

    const smsResult = await ghlSend(creds.token, {
      type: "SMS",
      contactId: contact.id,
      phone,
      message:
        "The Barber Launch: To reset your password, open https://member.thebarberlaunch.com/auth and select Forgot password. If you didn't request this, you can ignore this text.",
    });

    await audit(supabase, {
      user_id: userId,
      email,
      channel: "sms",
      outcome: smsResult.ok ? "sent" : "failed",
      reason: smsResult.ok ? null : smsResult.reason,
      ip_hash: ipHash,
    });

    return respond();
  } catch (e) {
    console.error("request-password-reset error:", e instanceof Error ? e.message : "unknown");
    return respond();
  }
});
