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
  enrollment_price_ids: string[];
  sales_call_url: string | null;
  attribution_window_days: number | null;
  payout_timing: string | null;
  terms_text: string | null;
};

export const DEFAULT_SETTINGS: ProgramSettings = {
  live_enabled: false,
  seller_account_confirmed: false,
  enrollment_price_ids: [],
  sales_call_url: null,
  attribution_window_days: null,
  payout_timing: null,
  terms_text: null,
};

export async function loadSettings(db: SupabaseClient): Promise<ProgramSettings> {
  const { data } = await db.from("affiliate_settings").select("value").eq("key", "program").maybeSingle();
  return { ...DEFAULT_SETTINGS, ...((data?.value as Partial<ProgramSettings>) ?? {}) };
}

/** Missing configuration, named explicitly so the team knows what to supply. */
export function missingConfig(s: ProgramSettings): string[] {
  const missing: string[] = [];
  if (!s.seller_account_confirmed) missing.push("Confirmed Barber Launch enrollment seller Stripe account");
  if (!s.enrollment_price_ids.length) missing.push("Approved enrollment Stripe price ID(s)");
  if (!s.sales_call_url) missing.push("Verified sales call booking URL");
  if (!Deno.env.get("AFFILIATE_STRIPE_WEBHOOK_SECRET")) missing.push("AFFILIATE_STRIPE_WEBHOOK_SECRET");
  if (!s.live_enabled) missing.push("Live mode enabled in affiliate setup");
  return missing;
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
