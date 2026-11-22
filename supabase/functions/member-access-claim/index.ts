// Signed-in user asks: "do I have a completed Barber Launch purchase?"
// Grants access only when a live, paid, non-refunded, non-disputed Stripe
// charge is found for the account's own confirmed email, or when a live
// HighLevel read shows the exact member-access tag on a contact with that exact
// email in the approved location (tag-sourced grant only). action "tag_sync"
// (called at sign-in/status refresh) runs only the tag check, and only for
// accounts that hold a tag grant or lack member access. Signing up or signing in
// alone never grants anything. Read-only toward Stripe and HighLevel; no messages sent.
import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, rateLimit, requireUser, stripeSecretFor } from "../_shared/affiliate.ts";
import { classifyStripeCharge, normalizeEmailOrNull } from "../_shared/memberAccess.ts";
import { withoutConsumed } from "../_shared/memberPurchaseLookup.ts";
import { hairSystemGhlAccess } from "../_shared/hairSystemGhlAccess.ts";
import { hasActiveTagGrant, syncMemberTag, TAG_GRANT_SOURCE, tagEvidenceRef, type TagSyncResult } from "../_shared/memberTagAccess.ts";

const VERSION = "member-access-claim/2026-11-22-v2";
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
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body = purchase check */ }
  const email = normalizeEmailOrNull(user.email);

  // HighLevel tag sync: only for accounts holding a tag grant (may be removed) or
  // lacking member access (may be added). A failed lookup changes nothing.
  type TagOutcome = TagSyncResult | { outcome: "not_needed" | "not_confirmed" | "rate_limited" | "skipped"; changed: false };
  const tagSync = async (): Promise<TagOutcome> => {
    if (!email) return { outcome: "skipped", changed: false };
    if (!user.email_confirmed_at) return { outcome: "not_confirmed", changed: false };
    const active = await hasActiveTagGrant(db, user.id, email);
    if (active === null) return { outcome: "unavailable", reason: "tag_grant_read_failed" };
    if (!active) {
      const { data: allowed, error } = await db.rpc("member_content_allowed_for", { _user_id: user.id });
      if (error) return { outcome: "unavailable", reason: "access_read_failed" };
      if (allowed === true) return { outcome: "not_needed", changed: false };
    }
    if (!(await rateLimit(db, `member-tag-sync:${user.id}`, 20, 3600))) return { outcome: "rate_limited", changed: false };
    const result = await syncMemberTag(db, await hairSystemGhlAccess(db as any), { email, userId: user.id, allowGrant: true });
    if (result.outcome !== "unavailable") {
      // A tag grant follows its exact email: one held under a previous account email ends.
      await db.from("member_access_grants").update({
        status: "revoked", revoked_by_system: true, revoked_at: new Date().toISOString(), status_reason: "ghl_tag_email_changed",
      }).eq("source", TAG_GRANT_SOURCE).eq("user_id", user.id).eq("status", "active").neq("evidence_ref", tagEvidenceRef(email));
    } else {
      console.warn("member-access-claim tag check unavailable", result.reason);
    }
    return result;
  };

  if (body?.action === "tag_sync") {
    const tag = await tagSync();
    return reply({ version: VERSION, tag: tag.outcome, changed: "changed" in tag && tag.changed === true });
  }

  const tag = await tagSync();
  if (await hasAccess()) return reply({ version: VERSION, hasAccess: true, checked: false });

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
  const nowHasAccess = await hasAccess();
  if (!nowHasAccess && tag.outcome === "unavailable") {
    return reply({ version: VERSION, hasAccess: false, checked: true, found: false, reason: "check_unavailable" });
  }
  return reply({ version: VERSION, hasAccess: nowHasAccess, checked: true, found: grantRows.length > 0 });
});
