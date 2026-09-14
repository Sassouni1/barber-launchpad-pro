// Shared helpers for the Barber Launch affiliate program.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const COMMISSION_RATE = 0.2;

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  if (digits.length < 7) return null;
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ProgramSettings = {
  live_enabled: boolean;
  seller_account_confirmed: boolean;
  /** The Stripe seller account the enrollment revenue must land in (verified out of band). */
  expected_seller_account_id: string | null;
  /** The account id actually returned by Stripe for the configured server-side key. */
  verified_stripe_account_id: string | null;
  verified_stripe_account_email: string | null;
  verified_stripe_account_at: string | null;
  /** Existing GHL/FastPayDirect payment link. Informational only — not covered by webhook attribution. */
  external_payment_link_url: string | null;
  external_payment_product_id: string | null;
  external_payment_amount_cents: number | null;
  /** Never flipped on automatically: the existing link is not a Stripe Checkout Session flow. */
  external_flow_attribution_supported: boolean;
  enrollment_price_ids: string[];
  sales_call_url: string | null;
  attribution_window_days: number | null;
  payout_timing: string | null;
  terms_text: string | null;
  /** Automatic Stripe Connect transfers. Never flipped on implicitly. */
  auto_payouts_enabled: boolean;
  /** 'on_verified' | 'after_days' — an explicit choice, never assumed. */
  release_timing: string | null;
  release_delay_days: number | null;
  minimum_transfer_cents: number;
  /** Proven by asking Stripe whether the key's account is a Connect platform. */
  platform_transfer_verified: boolean;
  platform_transfer_checked_at: string | null;
  platform_transfer_note: string | null;
};

export const DEFAULT_SETTINGS: ProgramSettings = {
  live_enabled: false,
  seller_account_confirmed: false,
  expected_seller_account_id: null,
  verified_stripe_account_id: null,
  verified_stripe_account_email: null,
  verified_stripe_account_at: null,
  external_payment_link_url: null,
  external_payment_product_id: null,
  external_payment_amount_cents: null,
  external_flow_attribution_supported: false,
  enrollment_price_ids: [],
  sales_call_url: null,
  attribution_window_days: null,
  payout_timing: null,
  terms_text: null,
  auto_payouts_enabled: false,
  release_timing: null,
  release_delay_days: null,
  minimum_transfer_cents: 100,
  platform_transfer_verified: false,
  platform_transfer_checked_at: null,
  platform_transfer_note: null,
};

export async function loadSettings(db: SupabaseClient): Promise<ProgramSettings> {
  const { data } = await db.from("affiliate_settings").select("value").eq("key", "program").maybeSingle();
  return { ...DEFAULT_SETTINGS, ...((data?.value as Partial<ProgramSettings>) ?? {}) };
}

/** Missing configuration, named explicitly so the team knows what to supply. */
export function missingConfig(s: ProgramSettings): string[] {
  const missing: string[] = [];
  if (!s.expected_seller_account_id) {
    missing.push("Expected Barber Launch enrollment seller Stripe account id");
  } else if (s.verified_stripe_account_id !== s.expected_seller_account_id) {
    missing.push(
      s.verified_stripe_account_id
        ? `Stripe key belongs to ${s.verified_stripe_account_id}, not the expected seller ${s.expected_seller_account_id}`
        : `Stripe key not yet checked against seller ${s.expected_seller_account_id}`,
    );
  }
  if (!s.enrollment_price_ids.length) missing.push("Approved enrollment Stripe price ID(s)");
  if (!s.sales_call_url) missing.push("Verified sales call booking URL");
  if (!Deno.env.get("AFFILIATE_STRIPE_WEBHOOK_SECRET")) missing.push("AFFILIATE_STRIPE_WEBHOOK_SECRET");
  if (!s.live_enabled) missing.push("Live mode enabled in affiliate setup");
  return missing;
}

/**
 * What is still missing before automatic commission transfers may run.
 * Release timing is deliberately not defaulted — the team must pick it.
 */
export function missingPayoutConfig(s: ProgramSettings): string[] {
  const missing: string[] = [];
  if (!s.platform_transfer_verified) {
    missing.push("Stripe Connect platform transfer path not verified yet");
  }
  if (!s.release_timing) missing.push("Automatic release timing choice");
  if (s.release_timing === "after_days" && !s.release_delay_days) {
    missing.push("Number of days to hold a commission before release");
  }
  if (!s.auto_payouts_enabled) missing.push("Automatic payouts switched on in setup");
  return missing;
}

export function stripeForm(params: Record<string, unknown>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export async function stripeCall(
  path: string,
  opts: { method?: string; body?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<{ ok: boolean; status: number; data: any }> {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) return { ok: false, status: 500, data: { error: { message: "No Stripe key configured." } } };
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  if (opts.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body ? stripeForm(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export type AccountEligibility = {
  stripeAccountId: string;
  accountType: string | null;
  country: string | null;
  defaultCurrency: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  transfersCapability: string | null;
  disabledReason: string | null;
  currentlyDue: string[];
  pendingVerification: string[];
  bankLast4: string | null;
  bankName: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
};

/**
 * Live Stripe check of whether a connected account can actually receive a
 * transfer and pay it out to a bank. charges_enabled alone is never enough.
 */
export function evaluateAccount(account: any): AccountEligibility {
  const req = account?.requirements ?? {};
  const external = (account?.external_accounts?.data ?? []).find((e: any) => e?.object === "bank_account");
  const transfers = account?.capabilities?.transfers ?? null;
  const country = account?.country ?? null;
  const currency = (account?.default_currency ?? "").toLowerCase() || null;

  const reasons: string[] = [];
  if (transfers !== "active") reasons.push("Stripe has not activated transfers on this account yet.");
  if (!account?.payouts_enabled) reasons.push("Stripe has not enabled bank payouts on this account yet.");
  if (req?.disabled_reason) reasons.push("Stripe has restricted this account.");
  if (country !== "US") reasons.push("Only US accounts are supported for commission transfers right now.");
  if (currency !== "usd") reasons.push("This account does not pay out in US dollars.");

  return {
    stripeAccountId: String(account?.id ?? ""),
    accountType: account?.type ?? null,
    country,
    defaultCurrency: currency,
    chargesEnabled: Boolean(account?.charges_enabled),
    payoutsEnabled: Boolean(account?.payouts_enabled),
    detailsSubmitted: Boolean(account?.details_submitted),
    transfersCapability: transfers,
    disabledReason: req?.disabled_reason ?? null,
    currentlyDue: Array.isArray(req?.currently_due) ? req.currently_due : [],
    pendingVerification: Array.isArray(req?.pending_verification) ? req.pending_verification : [],
    bankLast4: external?.last4 ?? null,
    bankName: external?.bank_name ?? null,
    eligible: reasons.length === 0,
    ineligibleReason: reasons[0] ?? null,
  };
}

export const CANONICAL_ORIGIN = "https://member.thebarberlaunch.com";

const PREVIEW_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/barber-launchpad-pro\.lovable\.app$/,
  /^https:\/\/preview--barber-launchpad-pro\.lovable\.app$/,
  /^https:\/\/id-preview--[0-9a-f-]{36}\.lovable\.app$/,
  /^https:\/\/[0-9a-f-]{36}\.lovableproject\.com$/,
  /^http:\/\/localhost:\d{2,5}$/,
];

/**
 * Never trust the caller's Origin for redirect URLs. Only the canonical member
 * domain and known preview hosts are allowed; anything else falls back to the
 * canonical domain.
 */
export function safeOrigin(req: Request): string {
  const origin = (req.headers.get("origin") ?? "").trim().replace(/\/+$/, "");
  if (!origin) return CANONICAL_ORIGIN;
  if (origin === CANONICAL_ORIGIN) return origin;
  if (PREVIEW_ORIGIN_PATTERNS.some((re) => re.test(origin))) return origin;
  return CANONICAL_ORIGIN;
}

export async function rateLimit(db: SupabaseClient, key: string, max: number, windowSeconds: number) {
  const now = Date.now();
  const { data } = await db
    .from("affiliate_intake_rate_limits")
    .select("id, attempts, window_started_at")
    .eq("bucket_key", key)
    .maybeSingle();

  if (!data) {
    await db.from("affiliate_intake_rate_limits").insert({ bucket_key: key });
    return true;
  }
  const started = new Date(data.window_started_at as string).getTime();
  if (now - started > windowSeconds * 1000) {
    await db
      .from("affiliate_intake_rate_limits")
      .update({ attempts: 1, window_started_at: new Date().toISOString() })
      .eq("id", data.id);
    return true;
  }
  if ((data.attempts as number) >= max) return false;
  await db.from("affiliate_intake_rate_limits").update({ attempts: (data.attempts as number) + 1 }).eq("id", data.id);
  return true;
}

export async function requireUser(req: Request, db: SupabaseClient) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function isAdmin(db: SupabaseClient, userId: string) {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

/** Deterministic affiliate code from a random seed, human-readable. */
export function newAffiliateCode(seedName?: string | null) {
  const base = (seedName ?? "bl")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 10) || "bl";
  return `${base}${randomToken(3)}`;
}
