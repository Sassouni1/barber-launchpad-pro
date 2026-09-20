// Cloudflare Email Service transport (REST API — no Worker binding required).
//
// Docs: POST /accounts/{account_id}/email/sending/send
// Credentials come only from secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.

export type EmailSendResult =
  | { ok: true; messageId: string | null; sender: string }
  | { ok: false; reason: string; configured: boolean };

const API_BASE = "https://api.cloudflare.com/client/v4";

export function cloudflareEmailConfig() {
  const token = (Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "").trim();
  const accountId = (Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "").trim();
  const missing: string[] = [];
  if (!token) missing.push("CLOUDFLARE_API_TOKEN");
  if (!accountId) missing.push("CLOUDFLARE_ACCOUNT_ID");
  return { token, accountId, missing };
}

export async function sendCloudflareEmail(input: {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailSendResult> {
  const { token, accountId, missing } = cloudflareEmailConfig();
  if (missing.length) {
    return { ok: false, configured: false, reason: `email_provider_not_configured:missing_${missing.join(",")}` };
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}/email/sending/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: input.to,
        from: input.fromName ? { address: input.from, name: input.fromName } : input.from,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
    });
  } catch (e) {
    return { ok: false, configured: true, reason: `cloudflare_email_network_error:${e instanceof Error ? e.message : "unknown"}`.slice(0, 400) };
  }

  const bodyText = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(bodyText);
  } catch { /* non-JSON error body */ }

  if (!res.ok || body?.success !== true) {
    const detail = body?.errors?.map((e: any) => `${e.code}:${e.message}`).join(" | ") ?? bodyText;
    return { ok: false, configured: true, reason: `cloudflare_email_${res.status}:${detail}`.slice(0, 400) };
  }

  const result = body?.result ?? {};
  if (Array.isArray(result.permanent_bounces) && result.permanent_bounces.length) {
    return { ok: false, configured: true, reason: `cloudflare_email_bounced:${result.permanent_bounces.join(",")}`.slice(0, 400) };
  }
  if (Array.isArray(result.suppressed_recipients) && result.suppressed_recipients.length) {
    return { ok: false, configured: true, reason: `cloudflare_email_suppressed:${result.suppressed_recipients.join(",")}`.slice(0, 400) };
  }

  return { ok: true, messageId: result.message_id ?? null, sender: input.from };
}
