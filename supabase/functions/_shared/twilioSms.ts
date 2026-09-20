// Twilio transactional SMS transport, using the shared Vlix Booking A2P
// Messaging Service configuration contract:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID
// No credentials are copied or logged here — they are read from secrets only.

export type SmsSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; reason: string; configured: boolean };

export function twilioConfig() {
  const accountSid = (Deno.env.get("TWILIO_ACCOUNT_SID") ?? "").trim();
  const authToken = (Deno.env.get("TWILIO_AUTH_TOKEN") ?? "").trim();
  const messagingServiceSid = (Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") ?? "").trim();
  const missing: string[] = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!messagingServiceSid) missing.push("TWILIO_MESSAGING_SERVICE_SID");
  return { accountSid, authToken, messagingServiceSid, missing };
}

/** US/E.164 normalisation; returns null when the number is not usable. */
export function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) {
    const rest = digits.slice(1).replace(/\D/g, "");
    return rest.length >= 10 && rest.length <= 15 ? `+${rest}` : null;
  }
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export async function sendTwilioSms(input: { to: string; body: string }): Promise<SmsSendResult> {
  const { accountSid, authToken, messagingServiceSid, missing } = twilioConfig();
  if (missing.length) {
    return { ok: false, configured: false, reason: `sms_provider_not_configured:missing_${missing.join(",")}` };
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: input.to,
          MessagingServiceSid: messagingServiceSid,
          Body: input.body,
        }),
      },
    );
  } catch (e) {
    return { ok: false, configured: true, reason: `twilio_network_error:${e instanceof Error ? e.message : "unknown"}`.slice(0, 400) };
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch { /* non-JSON */ }

  if (!res.ok) {
    return { ok: false, configured: true, reason: `twilio_${res.status}:${body?.code ?? ""} ${body?.message ?? text}`.slice(0, 400) };
  }
  return { ok: true, messageId: body?.sid ?? null };
}
