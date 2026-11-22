// Account creation from a paid on-site Barber Launch checkout. The Stripe
// Checkout Session id is the bearer proof: it is re-fetched from Stripe with the
// server secret and must be a complete, paid, unrefunded, undisputed live
// enrollment on the expected account. One session creates at most one account
// (atomic reservation + binding in member_checkout_claims). The login email is
// chosen freely and never used as payment evidence. The only email sent is the
// standard sign-up confirmation for that login email. No other messages.
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminClient, rateLimit } from "../_shared/affiliate.ts";
import { normalizeEmailOrNull } from "../_shared/memberAccess.ts";
import { safeSignupRedirect } from "../_shared/memberPurchaseLookup.ts";
import { ENROLLMENT, evaluateCheckoutSession, SESSION_ID_PATTERN, type SessionProof } from "../_shared/checkoutClaim.ts";

const VERSION = "member-checkout-signup/2026-11-22-v1";
const ALLOWED_ORIGINS = [
  /^https:\/\/member\.thebarberlaunch\.com$/,
  /^https:\/\/(www\.)?thebarberlaunch\.com$/,
  /^https:\/\/barber-launchpad-pro\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+--fb9f6378-8c5e-42da-91e6-0993cf1fb925\.lovable\.app$/,
  /^http:\/\/localhost:8080$/,
];

function headers(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.some((re) => re.test(origin))) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

let accountVerified = false;

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2026-03-25.dahlia" },
    signal: AbortSignal.timeout(15_000),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

/** Fetch and check the session on the expected live account. Never returns transaction details to callers. */
async function verifySession(sessionId: string): Promise<SessionProof | { ok: false; reason: "unavailable" }> {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!/^(sk|rk)_live_/.test(key)) return { ok: false, reason: "unavailable" };
  try {
    if (!accountVerified) {
      const acct = await stripeGet("account", key);
      if (!acct.ok || acct.data?.id !== ENROLLMENT.account) {
        console.error("member-checkout-signup: Stripe account check failed", acct.status);
        return { ok: false, reason: "unavailable" };
      }
      accountVerified = true;
    }
    const s = await stripeGet(
      `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items&expand[]=payment_intent.latest_charge`, key);
    if (s.status === 404 || s.data?.error?.code === "resource_missing") return { ok: false, reason: "not_found" };
    if (!s.ok) {
      console.error("member-checkout-signup: session read failed", s.status, s.data?.error?.code ?? "");
      return { ok: false, reason: "unavailable" };
    }
    return evaluateCheckoutSession(s.data, sessionId);
  } catch (e) {
    console.error("member-checkout-signup: Stripe error", e instanceof Error ? e.message : String(e));
    return { ok: false, reason: "unavailable" };
  }
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const h = headers(origin);
  const reply = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ version: VERSION, ...body }), { status, headers: h });

  if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) {
    return new Response(JSON.stringify({ ok: false, reason: "origin_not_allowed" }), { status: 403, headers: h });
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ ok: false, reason: "method_not_allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return reply({ ok: false, reason: "invalid_request" }, 400); }

  const action = body?.action === "verify" ? "verify" : body?.action === "create" ? "create" : null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!action || !SESSION_ID_PATTERN.test(sessionId)) return reply({ ok: false, reason: "invalid_request" }, 400);

  let email = "", password = "", firstName = "", lastName = "", phone = "";
  if (action === "create") {
    email = normalizeEmailOrNull(body?.email) ?? "";
    password = typeof body?.password === "string" ? body.password : "";
    firstName = clean(body?.firstName, 80);
    lastName = clean(body?.lastName, 80);
    phone = clean(body?.phone, 30);
    if (!email || email.length > 254) return reply({ ok: false, reason: "invalid_email" }, 400);
    if (password.length < 8 || password.length > 72) return reply({ ok: false, reason: "weak_password" }, 400);
    if (!firstName || !lastName) return reply({ ok: false, reason: "name_required" }, 400);
  }

  const db = adminClient();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const limits = action === "verify"
    ? [[`checkout-signup:verify:ip:${ip}`, 30], [`checkout-signup:verify:session:${sessionId}`, 20]] as const
    : [[`checkout-signup:create:ip:${ip}`, 10], [`checkout-signup:create:session:${sessionId}`, 6], [`checkout-signup:create:email:${email}`, 6]] as const;
  for (const [k, max] of limits) {
    if (!(await rateLimit(db, k, max, 3600))) return reply({ ok: false, reason: "rate_limited" }, 429);
  }

  // Replay check before calling Stripe.
  const { data: existing, error: claimErr } = await db.from("member_checkout_claims")
    .select("status, reserved_until").eq("checkout_session_id", sessionId).maybeSingle();
  if (claimErr) return reply({ ok: false, reason: "check_unavailable" }, 503);
  if (existing && (existing.status === "claimed" || existing.status === "needs_review")) return reply({ ok: false, reason: "already_claimed" }, 409);
  if (existing?.status === "reserved" && new Date(existing.reserved_until).getTime() > Date.now()) {
    return reply({ ok: false, reason: "in_progress" }, 409);
  }

  const proof = await verifySession(sessionId);
  if (!proof.ok) {
    if (proof.reason === "unavailable") return reply({ ok: false, reason: "check_unavailable" }, 503);
    console.warn("member-checkout-signup: session not accepted", proof.reason);
    return reply({ ok: false, reason: "not_verified" });
  }

  // One payment, one account: a buyer who already has an account under the checkout email signs in instead.
  if (proof.checkoutEmail) {
    const { data: has, error } = await db.rpc("member_checkout_email_has_account", { _email: proof.checkoutEmail });
    if (error) return reply({ ok: false, reason: "check_unavailable" }, 503);
    if (has === true) return reply({ ok: false, reason: "account_exists" }, 409);
  }
  if (action === "verify") return reply({ ok: true, status: "verified" });

  const reservation = crypto.randomUUID();
  const { data: reserved, error: resErr } = await db.rpc("member_checkout_claim_reserve", {
    _session_id: sessionId, _reservation: reservation, _payment_intent: proof.paymentIntentId, _charge: proof.chargeId,
    _checkout_email: proof.checkoutEmail, _login_email: email, _amount: proof.amountCents, _currency: proof.currency, _paid_at: proof.paidAt,
  });
  if (resErr) { console.error("member-checkout-signup: reserve failed", resErr.message); return reply({ ok: false, reason: "check_unavailable" }, 503); }
  if (reserved === "already_claimed") return reply({ ok: false, reason: "already_claimed" }, 409);
  if (reserved !== "reserved") return reply({ ok: false, reason: "in_progress" }, 409);

  const release = (why: string) => db.rpc("member_checkout_claim_release", { _session_id: sessionId, _reservation: reservation, _error: why });

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email, password, email_confirm: false,
    user_metadata: { full_name: `${firstName} ${lastName}`.trim(), ...(phone ? { phone } : {}) },
  });
  if (createErr || !created?.user) {
    const inUse = /already|exists|registered/i.test(createErr?.message ?? "");
    await release(inUse ? "login_email_in_use" : "create_failed");
    if (!inUse) console.error("member-checkout-signup: create failed", createErr?.message);
    return reply({ ok: false, reason: inUse ? "email_in_use" : "create_failed" }, inUse ? 409 : 500);
  }
  const userId = created.user.id;
  const undo = async (why: string) => {
    await db.auth.admin.deleteUser(userId).catch(() => null);
    await release(why);
  };

  const { data: attached } = await db.rpc("member_checkout_claim_attach_user", { _session_id: sessionId, _reservation: reservation, _user_id: userId });
  if (attached !== true) { await undo("attach_failed"); return reply({ ok: false, reason: "in_progress" }, 409); }
  if (phone) await db.from("profiles").update({ phone }).eq("id", userId);

  // Standard confirmation email (Cloud Auth "Confirm signup") for the chosen login email.
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
  const { error: resendErr } = await anon.auth.resend({
    type: "signup", email, options: { emailRedirectTo: safeSignupRedirect(body?.redirectTo) },
  });
  if (resendErr) {
    console.error("member-checkout-signup: confirmation failed", resendErr.message);
    await undo("confirmation_failed");
    return reply({ ok: false, reason: /rate|seconds/i.test(resendErr.message) ? "rate_limited" : "confirmation_unavailable" }, 503);
  }

  const { data: done, error: doneErr } = await db.rpc("member_checkout_claim_complete", { _session_id: sessionId, _reservation: reservation, _user_id: userId });
  if (doneErr || done !== "claimed") {
    console.error("member-checkout-signup: bind failed", doneErr?.message ?? done);
    await db.auth.admin.deleteUser(userId).catch(() => null);
    return reply({ ok: false, reason: done === "revoked" ? "not_verified" : "already_claimed" }, 409);
  }
  return reply({ ok: true, status: "check_email" });
});
