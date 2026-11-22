// Server-only: does this checkout email have a completed Barber Launch purchase
// (live, paid, not fully refunded, not disputed) or an explicit admin grant?
// Sources: active access records, audited Stripe evidence, and a fresh read of
// the platform Stripe account. Never trusts browser input beyond the email.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { stripeSecretFor } from "./affiliate.ts";
import { classifyStripeCharge } from "./memberAccess.ts";

export type PurchaseLookup =
  | { status: "matched"; freshGrants: Record<string, unknown>[] }
  | { status: "no_match" }
  | { status: "unavailable" };

export async function lookupQualifyingPurchase(db: SupabaseClient, email: string): Promise<PurchaseLookup> {
  const { data: grants, error: gErr } = await db.from("member_access_grants").select("id")
    .eq("status", "active").eq("email_normalized", email).limit(1);
  if (gErr) return { status: "unavailable" };
  if ((grants ?? []).length) return { status: "matched", freshGrants: [] };

  const { data: ev, error: eErr } = await db.from("member_access_evidence").select("*")
    .eq("qualifies", true).eq("email_normalized", email);
  if (eErr) return { status: "unavailable" };
  const freshGrants: Record<string, unknown>[] = (ev ?? []).map((e: any) => ({
    email_normalized: email, source: e.source, evidence_ref: e.evidence_ref, amount_cents: e.amount_cents,
    currency: e.currency, paid_at: e.paid_at, description: e.description, status_reason: "signup_audited_payment",
  }));
  if (freshGrants.length) return { status: "matched", freshGrants };

  // Fresh read: Stripe customers with this exact email -> their charges.
  if (email.includes("'") || email.includes("\\")) return { status: "no_match" };
  const secret = stripeSecretFor(true);
  if (!secret) return { status: "unavailable" };
  const { data: ads } = await db.from("ad_payment_transactions").select("stripe_payment_intent_id");
  const adPis = new Set((ads ?? []).map((a: any) => a.stripe_payment_intent_id).filter(Boolean));
  const sr = await fetch(`https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(`email:'${email}'`)}&limit=10`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!sr.ok) return { status: "unavailable" };
  for (const c of (await sr.json()).data ?? []) {
    const cr = await fetch(`https://api.stripe.com/v1/charges?customer=${encodeURIComponent(c.id)}&limit=100`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!cr.ok) return { status: "unavailable" };
    for (const ch of (await cr.json()).data ?? []) {
      const d = classifyStripeCharge({ ...ch, customer: c }, adPis);
      await db.from("member_access_evidence").upsert({
        source: "stripe_charge", evidence_ref: ch.id, email_normalized: d.email, amount_cents: d.amountCents,
        amount_refunded_cents: d.refundedCents, currency: ch.currency ?? null, paid_at: d.paidAt, disputed: d.disputed,
        livemode: d.livemode, qualifies: d.qualifies, exclusion_reason: d.reason, description: d.description,
        audited_at: new Date().toISOString(),
      }, { onConflict: "source,evidence_ref" });
      if (d.qualifies && d.email === email) {
        freshGrants.push({ email_normalized: email, source: "stripe_charge", evidence_ref: ch.id, amount_cents: d.amountCents,
          currency: ch.currency ?? null, paid_at: d.paidAt, description: d.description, status_reason: "signup_stripe_payment" });
      }
    }
  }
  return freshGrants.length ? { status: "matched", freshGrants } : { status: "no_match" };
}

/** Only these sites may receive the confirmation link. */
export function safeSignupRedirect(value: unknown): string {
  const fallback = "https://member.thebarberlaunch.com/";
  if (typeof value !== "string") return fallback;
  try {
    const u = new URL(value);
    const ok = u.origin === "https://member.thebarberlaunch.com" || u.origin === "https://barber-launchpad-pro.lovable.app" ||
      /^https:\/\/[a-z0-9-]+--fb9f6378-8c5e-42da-91e6-0993cf1fb925\.lovable\.app$/.test(u.origin) ||
      u.origin === "http://localhost:8080";
    return ok ? `${u.origin}/` : fallback;
  } catch {
    return fallback;
  }
}
