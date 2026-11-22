// Admin-only member access controls: status, account list, grant/revoke/link,
// read-only purchase-source audit (Stripe platform charges, GoHighLevel
// transactions), applying verified evidence, and the guarded access switch.
// Never sends customer messages, never charges, never returns credentials.
import { corsHeaders } from "../_shared/cors.ts";
import { adminClient, isAdmin, requireUser, stripeSecretFor } from "../_shared/affiliate.ts";
import { GHL_BASE, ghlHeaders } from "../_shared/ghlMessaging.ts";
import { hairSystemGhlAccess } from "../_shared/hairSystemGhlAccess.ts";
import {
  classifyGhlTransaction,
  classifyStripeCharge,
  cleanReason,
  enforcementGuard,
  normalizeEmailOrNull,
} from "../_shared/memberAccess.ts";

const VERSION = "member-access-admin/2026-11-22-v2";
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

type Db = ReturnType<typeof adminClient>;

async function allUsers(db: Db) {
  const users: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("user_list_failed");
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function accountSnapshot(db: Db) {
  const [users, rolesR, grantsR, certsR, ordersR, profilesR, cutoverR, isEnforced] = await Promise.all([
    allUsers(db),
    db.from("user_roles").select("user_id, role"),
    db.from("member_access_grants").select("id, user_id, email_normalized, source, status, status_reason, amount_cents, currency, paid_at, created_at, note, revoked_by_system, revoked_at"),
    db.from("certifications").select("user_id"),
    db.from("orders").select("user_id, stripe_checkout_session_id, status"),
    db.from("profiles").select("id, full_name"),
    db.rpc("member_access_new_account_cutover"),
    enforced(db),
  ]);
  for (const r of [rolesR, grantsR, certsR, ordersR, profilesR, cutoverR]) if (r.error) throw new Error("snapshot_failed");
  // Same rule as public.member_legacy_access_allowed(): accounts created before the
  // cutover keep temporary access while the full check is off, unless a purchase was
  // refunded/disputed/revoked after the cutover. Manufacturer-only accounts never do.
  const cutover = new Date(String(cutoverR.data)).getTime();
  if (!Number.isFinite(cutover)) throw new Error("snapshot_failed");
  const roles = new Map<string, string[]>();
  for (const r of rolesR.data ?? []) roles.set(r.user_id, [...(roles.get(r.user_id) ?? []), r.role]);
  const certified = new Set((certsR.data ?? []).map((c: any) => c.user_id));
  const legacyOrders = new Map<string, number>();
  for (const o of ordersR.data ?? []) {
    if (o.user_id && !o.stripe_checkout_session_id && o.status !== "pending_payment") legacyOrders.set(o.user_id, (legacyOrders.get(o.user_id) ?? 0) + 1);
  }
  const names = new Map((profilesR.data ?? []).map((p: any) => [p.id, p.full_name]));
  const grants = grantsR.data ?? [];
  const accounts = users.map((u) => {
    const email = normalizeEmailOrNull(u.email) ?? (u.email ?? "").toLowerCase();
    const own = grants.filter((g: any) => g.user_id === u.id || (!g.user_id && g.email_normalized === email));
    const r = roles.get(u.id) ?? [];
    const isAdminRole = r.includes("admin");
    const activeGrant = own.some((g: any) => g.status === "active");
    const hasAccess = isAdminRole || activeGrant;
    const manufacturerOnly = r.includes("manufacturer") && !isAdminRole;
    const revokedSinceCutover = own.some((g: any) => g.status === "revoked" && g.revoked_at && new Date(g.revoked_at).getTime() >= cutover);
    const temporaryAccess = !isEnforced && !hasAccess && !manufacturerOnly && !revokedSinceCutover && new Date(u.created_at).getTime() < cutover;
    return {
      id: u.id,
      email: u.email,
      name: names.get(u.id) ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      roles: r,
      hasAccess,
      temporaryAccess,
      grants: own,
      signals: { certified: certified.has(u.id), legacyOrders: legacyOrders.get(u.id) ?? 0 },
    };
  });
  const emails = new Set(accounts.map((a) => (a.email ?? "").toLowerCase()));
  const { data: ev } = await db.from("member_access_evidence").select("id, source, email_normalized, amount_cents, paid_at, description").eq("qualifies", true).gte("amount_cents", 9000);
  const orphan = (ev ?? []).filter((e: any) => e.email_normalized && !emails.has(e.email_normalized));
  for (const a of accounts) {
    if (a.hasAccess) continue;
    (a as any).suggestions = suggestEvidence(a.email ?? "", a.name, orphan).slice(0, 5);
  }
  const unmatchedGrants = grants.filter((g: any) => !g.user_id && g.email_normalized && !emails.has(g.email_normalized));
  return { accounts, grants, unmatchedGrants, cutoverAt: new Date(cutover).toISOString() };
}

/** Possible payments made under another email: same last name or same email name. Admin must confirm. */
function suggestEvidence(email: string, name: string | null, orphan: any[]) {
  const local = email.split("@")[0].replace(/[^a-z]/gi, "").toLowerCase();
  const last = (name ?? "").trim().split(/\s+/).slice(1).join("").replace(/[^a-z]/gi, "").toLowerCase();
  return orphan.filter((e) => {
    const el = String(e.email_normalized).split("@")[0].replace(/[^a-z]/gi, "").toLowerCase();
    return (last.length >= 4 && el.includes(last)) || (local.length >= 5 && (el.includes(local) || local.includes(el) && el.length >= 5));
  });
}

function summarize(accounts: any[]) {
  const members = accounts.filter((a) => !a.roles.includes("admin") && !a.roles.includes("manufacturer"));
  return {
    accounts: accounts.length,
    admins: accounts.filter((a) => a.roles.includes("admin")).length,
    manufacturers: accounts.filter((a) => a.roles.includes("manufacturer") && !a.roles.includes("admin")).length,
    membersWithAccess: members.filter((a) => a.hasAccess).length,
    membersWithoutAccess: members.filter((a) => !a.hasAccess).length,
    membersTemporaryAccess: members.filter((a) => !a.hasAccess && a.temporaryAccess).length,
    withoutAccessButCertified: members.filter((a) => !a.hasAccess && a.signals.certified).length,
    withoutAccessButLegacyOrders: members.filter((a) => !a.hasAccess && a.signals.legacyOrders > 0).length,
  };
}

async function enforced(db: Db) {
  const { data } = await db.from("app_settings").select("value").eq("key", "member_access_enforcement").maybeSingle();
  return Boolean((data?.value as any)?.enabled);
}

async function missingStripeGrants(db: Db) {
  const { data: pays } = await db.from("affiliate_payments").select("stripe_object_id, livemode, gross_amount_cents, customer_email_normalized").eq("livemode", true);
  const { data: grants } = await db.from("member_access_grants").select("evidence_ref").eq("source", "stripe_checkout");
  const { data: ads } = await db.from("ad_payment_transactions").select("stripe_checkout_session_id");
  const have = new Set((grants ?? []).map((g: any) => g.evidence_ref));
  const adSet = new Set((ads ?? []).map((a: any) => a.stripe_checkout_session_id).filter(Boolean));
  return (pays ?? []).filter((p: any) => p.gross_amount_cents > 0 && p.customer_email_normalized && !adSet.has(p.stripe_object_id) && !have.has(p.stripe_object_id)).length;
}

async function auditStripe(db: Db, body: any) {
  const secret = stripeSecretFor(true);
  if (!secret) return { ok: false, error: "no_live_stripe_key" };
  const since = Math.floor(new Date(typeof body.since === "string" ? body.since : "2025-01-01T00:00:00Z").getTime() / 1000);
  const { data: ads } = await db.from("ad_payment_transactions").select("stripe_payment_intent_id");
  const adPis = new Set((ads ?? []).map((a: any) => a.stripe_payment_intent_id).filter(Boolean));
  let cursor: string | null = typeof body.cursor === "string" ? body.cursor : null;
  const started = Date.now();
  let pages = 0, seen = 0, stored = 0;
  const reasons: Record<string, number> = {};
  let hasMore = true;
  while (hasMore && Date.now() - started < 90_000 && pages < 60) {
    const qs = new URLSearchParams({ limit: "100", "created[gte]": String(since) });
    qs.append("expand[]", "data.customer");
    if (cursor) qs.set("starting_after", cursor);
    const res = await fetch(`https://api.stripe.com/v1/charges?${qs}`, { headers: { Authorization: `Bearer ${secret}` } });
    if (!res.ok) return { ok: false, error: `stripe_${res.status}`, pages, seen, stored, cursor };
    const page = await res.json();
    pages++;
    const rows = (page.data ?? []).map((c: any) => {
      const d = classifyStripeCharge(c, adPis);
      seen++;
      reasons[d.reason ?? "qualifies"] = (reasons[d.reason ?? "qualifies"] ?? 0) + 1;
      return {
        source: "stripe_charge", evidence_ref: c.id, email_normalized: d.email, amount_cents: d.amountCents,
        amount_refunded_cents: d.refundedCents, currency: c.currency ?? null, paid_at: d.paidAt, disputed: d.disputed,
        livemode: d.livemode, qualifies: d.qualifies, exclusion_reason: d.reason, description: d.description, audited_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const { error } = await db.from("member_access_evidence").upsert(rows, { onConflict: "source,evidence_ref" });
      if (error) return { ok: false, error: "evidence_write_failed", pages, seen, stored, cursor };
      stored += rows.length;
      cursor = page.data[page.data.length - 1].id;
    }
    hasMore = Boolean(page.has_more) && rows.length > 0;
  }
  return { ok: true, pages, seen, stored, reasons, complete: !hasMore, nextCursor: hasMore ? cursor : null };
}

async function auditGhl(db: Db, body: any) {
  const access = await hairSystemGhlAccess(db as any);
  if ("error" in access) return { ok: false, error: access.error };
  const headers = { ...ghlHeaders(access.accessToken), Version: "2021-07-28" };
  let offset = Number.isInteger(body.offset) ? body.offset : 0;
  const started = Date.now();
  let pages = 0, seen = 0, stored = 0, total: number | null = null;
  const reasons: Record<string, number> = {};
  const contactCache = new Map<string, string | null>();
  while (Date.now() - started < 90_000 && pages < 40) {
    const url = `${GHL_BASE}/payments/transactions?altId=${encodeURIComponent(access.locationId)}&altType=location&limit=100&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 160);
      return { ok: false, readable: false, status: res.status, detail, source: access.source, pages, seen, stored };
    }
    const page = await res.json();
    pages++;
    const list: any[] = Array.isArray(page?.data) ? page.data : Array.isArray(page?.transactions) ? page.transactions : [];
    total = typeof page?.totalCount === "number" ? page.totalCount : total;
    const rows = [];
    for (const tx of list) {
      let email: string | null = normalizeEmailOrNull(tx?.contactEmail) ?? normalizeEmailOrNull(tx?.contactSnapshot?.email);
      if (!email && typeof tx?.contactId === "string") {
        if (!contactCache.has(tx.contactId)) {
          const c = await fetch(`${GHL_BASE}/contacts/${encodeURIComponent(tx.contactId)}`, { headers: ghlHeaders(access.accessToken) });
          const cj = c.ok ? await c.json().catch(() => ({})) : {};
          contactCache.set(tx.contactId, normalizeEmailOrNull(cj?.contact?.email));
        }
        email = contactCache.get(tx.contactId) ?? null;
      }
      const d = classifyGhlTransaction(tx, email);
      seen++;
      reasons[d.reason ?? "qualifies"] = (reasons[d.reason ?? "qualifies"] ?? 0) + 1;
      const ref = String(tx?._id ?? tx?.id ?? "");
      if (!ref) continue;
      rows.push({
        source: "ghl_transaction", evidence_ref: ref, email_normalized: d.email, amount_cents: d.amountCents,
        amount_refunded_cents: d.refundedCents, currency: typeof tx?.currency === "string" ? tx.currency.toLowerCase() : null,
        paid_at: d.paidAt, disputed: d.disputed, livemode: d.livemode, qualifies: d.qualifies, exclusion_reason: d.reason,
        description: d.description, audited_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await db.from("member_access_evidence").upsert(rows, { onConflict: "source,evidence_ref" });
      if (error) return { ok: false, error: "evidence_write_failed", pages, seen, stored };
      stored += rows.length;
    }
    offset += list.length;
    if (list.length < 100 || (total !== null && offset >= total)) return { ok: true, readable: true, pages, seen, stored, total, reasons, complete: true };
  }
  return { ok: true, readable: true, pages, seen, stored, total, reasons, complete: false, nextOffset: offset };
}

/** Turn qualifying evidence into access only for existing accounts with the same email. */
async function applyEvidence(db: Db, actor: string, dryRun: boolean) {
  const { accounts } = await accountSnapshot(db);
  const byEmail = new Map(accounts.map((a) => [(a.email ?? "").toLowerCase(), a]));
  const { data: ev, error } = await db.from("member_access_evidence").select("*").eq("qualifies", true);
  if (error) throw new Error("evidence_read_failed");
  const rows = [];
  for (const e of ev ?? []) {
    const acct = e.email_normalized ? byEmail.get(e.email_normalized) : null;
    if (!acct) continue;
    rows.push({
      user_id: acct.id, email_normalized: e.email_normalized, source: e.source, evidence_ref: e.evidence_ref,
      amount_cents: e.amount_cents, currency: e.currency, paid_at: e.paid_at, description: e.description,
      status_reason: e.source === "ghl_transaction" ? "ghl_paid_transaction" : "stripe_paid_charge", granted_by: actor,
    });
  }
  const users = new Set(rows.map((r) => r.user_id));
  const newlyCovered = [...users].filter((id) => !accounts.find((a) => a.id === id)?.hasAccess).length;
  // Payments that were later fully refunded or disputed stop counting.
  const { data: lost, error: lostErr } = await db.from("member_access_evidence").select("source, evidence_ref, exclusion_reason")
    .eq("qualifies", false).in("exclusion_reason", ["refunded", "disputed"]);
  if (lostErr) throw new Error("evidence_read_failed");
  const lostRefs = new Map<string, string[]>();
  for (const e of lost ?? []) lostRefs.set(`${e.source}|${e.exclusion_reason}`, [...(lostRefs.get(`${e.source}|${e.exclusion_reason}`) ?? []), e.evidence_ref]);
  if (dryRun) return { dryRun: true, evidenceRows: rows.length, accounts: users.size, newlyCoveredAccounts: newlyCovered };
  let revokedForRefund = 0;
  for (const [key, refs] of lostRefs) {
    const [source, why] = key.split("|");
    for (let i = 0; i < refs.length; i += 200) {
      const { data: rv, error: rvErr } = await db.from("member_access_grants")
        .update({ status: "revoked", revoked_by_system: true, revoked_at: new Date().toISOString(), status_reason: why })
        .eq("source", source).eq("status", "active").is("revoked_by", null).in("evidence_ref", refs.slice(i, i + 200)).select("id");
      if (rvErr) throw new Error("grant_write_failed");
      revokedForRefund += rv?.length ?? 0;
    }
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error: insErr } = await db.from("member_access_grants")
      .upsert(rows.slice(i, i + 200), { onConflict: "source,evidence_ref", ignoreDuplicates: true }).select("id");
    if (insErr) throw new Error("grant_write_failed");
    inserted += data?.length ?? 0;
  }
  return { dryRun: false, evidenceRows: rows.length, inserted, revokedForRefund, accounts: users.size, newlyCoveredAccounts: newlyCovered };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const db = adminClient();
  const user = await requireUser(req, db);
  if (!user) return reply({ error: "Unauthorized" }, 401);
  if (!(await isAdmin(db, user.id))) return reply({ error: "Forbidden" }, 403);
  let body: any = {};
  try { body = await req.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  const action = String(body?.action ?? "");

  try {
    switch (action) {
      case "status": {
        const { accounts, unmatchedGrants, cutoverAt } = await accountSnapshot(db);
        const { count: evidence } = await db.from("member_access_evidence").select("id", { count: "exact", head: true });
        return reply({
          version: VERSION, enforced: await enforced(db), cutoverAt, summary: summarize(accounts),
          unmatchedPurchases: unmatchedGrants.filter((g: any) => g.status === "active").length,
          missingStripeGrants: await missingStripeGrants(db), evidenceRows: evidence ?? 0,
        });
      }
      case "list": {
        const { accounts, unmatchedGrants, cutoverAt } = await accountSnapshot(db);
        return reply({ enforced: await enforced(db), cutoverAt, summary: summarize(accounts), accounts, unmatchedGrants });
      }
      case "grant": {
        const reason = cleanReason(body.reason);
        if (!reason) return reply({ error: "reason_required" }, 400);
        const { data: target } = await db.auth.admin.getUserById(String(body.userId ?? ""));
        if (!target?.user) return reply({ error: "user_not_found" }, 404);
        const { data, error } = await db.from("member_access_grants").insert({
          user_id: target.user.id, email_normalized: normalizeEmailOrNull(target.user.email), source: "admin_grant",
          evidence_ref: `admin:${crypto.randomUUID()}`, status_reason: "admin_grant", granted_by: user.id, note: reason,
        }).select("id").single();
        if (error) return reply({ error: "grant_failed" }, 500);
        return reply({ ok: true, grantId: data.id });
      }
      case "revoke": {
        const reason = cleanReason(body.reason);
        if (!reason) return reply({ error: "reason_required" }, 400);
        const { data: target } = await db.auth.admin.getUserById(String(body.userId ?? ""));
        if (!target?.user) return reply({ error: "user_not_found" }, 404);
        const email = normalizeEmailOrNull(target.user.email);
        const patch = {
          status: "revoked", revoked_by: user.id, revoked_at: new Date().toISOString(), revoked_by_system: false,
          status_reason: `admin_revoked: ${reason}`,
        };
        const byId = await db.from("member_access_grants").update(patch).eq("status", "active").eq("user_id", target.user.id).select("id");
        if (byId.error) return reply({ error: "revoke_failed" }, 500);
        let byEmailCount = 0;
        if (email) {
          const byEmail = await db.from("member_access_grants").update(patch).eq("status", "active").is("user_id", null).eq("email_normalized", email).select("id");
          if (byEmail.error) return reply({ error: "revoke_failed" }, 500);
          byEmailCount = byEmail.data?.length ?? 0;
        }
        const revoked = (byId.data?.length ?? 0) + byEmailCount;
        let endedTemporaryAccess = false;
        if (revoked === 0) {
          // No purchase on record: record the decision so a pre-cutover account's
          // temporary access ends too (logged in the permanent history by trigger).
          const { error: markErr } = await db.from("member_access_grants").insert({
            user_id: target.user.id, email_normalized: email, source: "admin_grant",
            evidence_ref: `admin-end-temporary:${crypto.randomUUID()}`, ...patch, granted_by: user.id, note: reason,
          });
          if (markErr) return reply({ error: "revoke_failed" }, 500);
          endedTemporaryAccess = true;
        }
        return reply({ ok: true, revoked, endedTemporaryAccess });
      }
      case "link": {
        const reason = cleanReason(body.reason);
        if (!reason) return reply({ error: "reason_required" }, 400);
        const { data: target } = await db.auth.admin.getUserById(String(body.userId ?? ""));
        if (!target?.user) return reply({ error: "user_not_found" }, 404);
        const { data: g } = await db.from("member_access_grants").select("id, user_id").eq("id", String(body.grantId ?? "")).maybeSingle();
        if (!g) return reply({ error: "grant_not_found" }, 404);
        if (g.user_id && g.user_id !== target.user.id) return reply({ error: "grant_already_linked" }, 409);
        const { error } = await db.from("member_access_grants").update({ user_id: target.user.id, granted_by: user.id, note: reason }).eq("id", g.id);
        if (error) return reply({ error: "link_failed" }, 500);
        return reply({ ok: true });
      }
      case "linkEvidence": {
        const reason = cleanReason(body.reason);
        if (!reason) return reply({ error: "reason_required" }, 400);
        const { data: target } = await db.auth.admin.getUserById(String(body.userId ?? ""));
        if (!target?.user) return reply({ error: "user_not_found" }, 404);
        const { data: e } = await db.from("member_access_evidence").select("*").eq("id", String(body.evidenceId ?? "")).eq("qualifies", true).maybeSingle();
        if (!e) return reply({ error: "evidence_not_found" }, 404);
        const { error } = await db.from("member_access_grants").upsert({
          user_id: target.user.id, email_normalized: e.email_normalized, source: e.source, evidence_ref: e.evidence_ref,
          amount_cents: e.amount_cents, currency: e.currency, paid_at: e.paid_at, description: e.description,
          status_reason: "admin_linked_payment_other_email", granted_by: user.id, note: reason,
        }, { onConflict: "source,evidence_ref", ignoreDuplicates: true });
        if (error) return reply({ error: "link_failed" }, 500);
        return reply({ ok: true });
      }
      case "auditStripe":
        return reply(await auditStripe(db, body));
      case "auditGhl":
        return reply(await auditGhl(db, body));
      case "applyEvidence":
        return reply(await applyEvidence(db, user.id, body.dryRun !== false));
      case "setEnforcement": {
        const enable = body.enabled === true;
        const { accounts } = await accountSnapshot(db);
        const s = summarize(accounts);
        const problem = enforcementGuard(enable, s.membersWithoutAccess, body.confirmUnentitledCount);
        if (problem) return reply({ error: problem, membersWithoutAccess: s.membersWithoutAccess }, 409);
        const reason = cleanReason(body.reason);
        if (!reason) return reply({ error: "reason_required" }, 400);
        const { error } = await db.from("app_settings").update({ value: { enabled: enable, changed_by: user.id, changed_at: new Date().toISOString() } }).eq("key", "member_access_enforcement");
        if (error) return reply({ error: "switch_failed" }, 500);
        await db.from("member_access_events").insert({ action: enable ? "enforcement_on" : "enforcement_off", actor: user.id, reason, details: s });
        return reply({ ok: true, enforced: enable, summary: s });
      }
      default:
        return reply({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    console.error("member-access-admin", action, e instanceof Error ? e.message : "error");
    return reply({ error: "server_error" }, 500);
  }
});
