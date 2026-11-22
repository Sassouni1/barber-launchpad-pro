// Pure rules for website hair-system inquiries (no network). Tested in logic_test.ts.

export const CONCERNS = ["Thinning hair", "Receding hairline", "Crown loss", "Bald spots", "Not sure yet"] as const;
export const SERVICE_LABEL = "Hair systems inquiry";
/** Same visitor email on one site within an hour. */
export const PER_EMAIL_HOURLY_LIMIT = 3;
/** All new leads on one site within an hour (protects the member's phone from floods). */
export const PER_SITE_HOURLY_LIMIT = 20;

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export type Inquiry = {
  firstName: string; lastName: string; phone: string; email: string; concern: string; notes: string;
};

export function parseInquiry(data: Record<string, unknown>): { ok: true; inquiry: Inquiry } | { ok: false } {
  const inquiry: Inquiry = {
    firstName: clean(data.firstName, 60),
    lastName: clean(data.lastName, 60),
    phone: clean(data.phone, 30),
    email: clean(data.email, 254),
    concern: clean(data.concern, 80),
    notes: clean(data.notes, 1000),
  };
  const valid = inquiry.firstName && inquiry.lastName &&
    /^[+()\d\s.-]{10,30}$/.test(inquiry.phone) && inquiry.phone.replace(/\D/g, "").length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiry.email) &&
    (CONCERNS as readonly string[]).includes(inquiry.concern) &&
    data.service === SERVICE_LABEL;
  return valid ? { ok: true, inquiry } : { ok: false };
}

/** Honeypot: real visitors never fill the hidden "website" field. */
export const isBot = (data: Record<string, unknown>) => clean(data.website, 100).length > 0;

export function sameInquiry(a: Inquiry, b: Inquiry) {
  return a.firstName === b.firstName && a.lastName === b.lastName && a.phone === b.phone &&
    a.email === b.email && a.concern === b.concern && a.notes === b.notes;
}

/** The page the visitor used: the member's custom domain when set, else the shared preview host. */
export function originatingSiteUrl(site: { site_slug: string; custom_domain: string | null }) {
  const domain = String(site.custom_domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  return domain ? `https://${domain}/hair-loss-solutions/` : `https://sites.thebarberlaunch.com/${site.site_slug}/hair-loss-solutions/`;
}

export function allowedOrigin(origin: string, site: { custom_domain: string | null }) {
  if (origin === "https://sites.thebarberlaunch.com") return true;
  const domain = String(site.custom_domain ?? "").trim().toLowerCase().replace(/^www\./, "");
  return !!domain && (origin === `https://${domain}` || origin === `https://www.${domain}`);
}

/** Text and email body sent to the member. Every visitor field plus the originating site. */
export function inquiryDetails(i: Inquiry, siteUrl: string) {
  return [
    "New hair-system inquiry",
    `Name: ${i.firstName} ${i.lastName}`,
    `Phone: ${i.phone}`,
    `Email: ${i.email}`,
    `Hair-loss concern: ${i.concern}`,
    `Notes: ${i.notes || "None"}`,
    `Site: ${siteUrl}`,
  ].join("\n");
}

/** Statuses that may (re)send. "uncertain" never resends; "sending" is claimed by another request. */
export const SENDABLE = ["pending", "failed"] as const;

export type ChannelOutcome = { status: "sent"; providerMessageId: string | null } | { status: "failed" | "uncertain"; reason: string };

export function classifyGhlSend(status: number, body: string, kind: "email" | "sms"): ChannelOutcome {
  if (status >= 200 && status < 300) {
    let id: string | null = null;
    try { const d = JSON.parse(body); id = d?.messageId ?? d?.emailMessageId ?? d?.message?.id ?? d?.id ?? null; } catch { /* non-json */ }
    return { status: "sent", providerMessageId: id ? String(id) : null };
  }
  const reason = `ghl_${kind}_http_${status}:${body.replace(/\s+/g, " ").slice(0, 200)}`;
  return status >= 400 && status < 500 ? { status: "failed", reason } : { status: "uncertain", reason };
}
