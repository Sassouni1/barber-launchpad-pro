// Signed-in user asks: "do I have a completed Barber Launch purchase?"
// Grants access only when a live, paid, non-refunded, non-disputed Stripe
// charge is found for the account's own confirmed email. Signing up or
// signing in never grants anything. Read-only toward Stripe; no messages sent.
import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, rateLimit, requireUser, stripeSecretFor } from "../_shared/affiliate.ts";
import { classifyStripeCharge, normalizeEmailOrNull } from "../_shared/memberAccess.ts";
import { withoutConsumed } from "../_shared/memberPurchaseLookup.ts";

const VERSION = "member-access-claim/2026-11-22-v1";
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const db = adminClient();
  const user = await requireUser(req, db);
  if (!user) return reply({ error: "Unauthorized" }, 401);

  const hasAccess = async () => {
    const { data } = await db.rpc("has_member_access", { _user_id: user.id });
    return data === true;
  };
  if (await hasAccess()) return reply({ version: VERSION, hasAccess: true, checked: false });

  const email = normalizeEmailOrNull(user.email);
  if (!email || email.includes("'")) return reply({ version: VERSION, hasAccess: false, reason: "no_email" });
  if (!user.email_confirmed_at) return reply({ version: VERSION, hasAccess: false, reason: "email_not_confirmed" });
  if (!(await rateLimit(db, `member-access-claim:${user.id}`, 6, 3600))) {
    return reply({ version: VERSION, hasAccess: false, reason: "rate_limited" }, 429);
  }

  const grantRows: Record<string, unknown>[] = [];
  // 1) Already-audited payments for this exact email.
  const { data: ev } = await db.from("member_access_evidence").select("*").eq("qualifies", true).eq("email_normalized", email);
  for (const e of ev ?? []) {
    grantRows.push({ user_id: user.id, email_normalized: email, source: e.source, evidence_ref: e.evidence_ref, amount_cents: e.amount_cents,
      currency: e.currency, paid_at: e.paid_at, description: e.description, status_reason: "self_check_audited_payment" });
  }
  // 2) Fresh read from the platform Stripe account (customers with this email -> their charges).
  if (!grantRows.length) {
    const secret = stripeSecretFor(true);
    if (!secret) return reply({ version: VERSION, hasAccess: false, reason: "check_unavailable" }, 503);
    const { data: ads } = await db.from("ad_payment_transactions").select("stripe_payment_intent_id");
    const adPis = new Set((ads ?? []).map((a: any) => a.stripe_payment_intent_id).filter(Boolean));
    const sr = await fetch(`https://api.stripe.com/v1/customers/search?query=${encodeURIComponent(`email:'${email}'`)}&limit=10`, { headers: { Authorization: `Bearer ${secret}` } });
    if (!sr.ok) return reply({ version: VERSION, hasAccess: false, reason: "check_unavailable" }, 503);
    const customers = (await sr.json()).data ?? [];
    for (const c of customers) {
      const cr = await fetch(`https://api.stripe.com/v1/charges?customer=${encodeURIComponent(c.id)}&limit=100`, { headers: { Authorization: `Bearer ${secret}` } });
      if (!cr.ok) return reply({ version: VERSION, hasAccess: false, reason: "check_unavailable" }, 503);
      for (const ch of (await cr.json()).data ?? []) {
        const d = classifyStripeCharge({ ...ch, customer: c }, adPis);
        await db.from("member_access_evidence").upsert({
          source: "stripe_charge", evidence_ref: ch.id, email_normalized: d.email, amount_cents: d.amountCents, amount_refunded_cents: d.refundedCents,
          currency: ch.currency ?? null, paid_at: d.paidAt, disputed: d.disputed, livemode: d.livemode, qualifies: d.qualifies,
          exclusion_reason: d.reason, description: d.description, audited_at: new Date().toISOString(),
        }, { onConflict: "source,evidence_ref" });
        if (d.qualifies && d.email === email) {
          grantRows.push({ user_id: user.id, email_normalized: email, source: "stripe_charge", evidence_ref: ch.id, amount_cents: d.amountCents,
            currency: ch.currency ?? null, paid_at: d.paidAt, description: d.description, status_reason: "self_check_stripe_payment" });
        }
      }
    }
  }
  // Payments already bound to another account (e.g. claimed via a paid checkout session) never qualify again.
  const unused = await withoutConsumed(db, grantRows);
  if (unused === null) return reply({ version: VERSION, hasAccess: false, reason: "check_unavailable" }, 503);
  grantRows.splice(0, grantRows.length, ...unused);
  if (grantRows.length) {
    const { error } = await db.from("member_access_grants").upsert(grantRows, { onConflict: "source,evidence_ref", ignoreDuplicates: true });
    if (error) return reply({ version: VERSION, hasAccess: false, reason: "check_unavailable" }, 500);
  }
  return reply({ version: VERSION, hasAccess: await hasAccess(), checked: true, found: grantRows.length > 0 });
});
