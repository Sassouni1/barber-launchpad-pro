import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripeGet, loadExpandedSession } from "./hairSystemFulfillment.ts";
import { HAIR_SYSTEM_SELLER_ACCOUNT } from "./hairSystemFulfillmentLogic.ts";

export const LIVE_VERIFICATION_EMAIL = "chris@invasiondigitalmedia.com";
export const LIVE_VERIFICATION_CONFIRM = "LIVE_ONE_DOLLAR_TEST";
export const LIVE_VERIFICATION_NOTE = "TEST ORDER — DO NOT PRODUCE OR SHIP. Notification verification only.";
export const LIVE_VERIFICATION_ITEM = "Hair System Notification Verification — TEST ONLY, DO NOT PRODUCE";

export function verificationDraft(user: { id: string; email: string }) {
  return {
    user_id: user.id, customer_email: user.email, customer_name: "Chris Sassouni", save_card: false,
    shipping_speed: "TEST ONLY — DO NOT SHIP",
    base_details: {
      source: "barber-launch-native-order-form", order_type: "hair_system", live_verification_test: true,
      full_name: "Chris Sassouni", email: user.email, phone: "7276374672",
      shipping: { method: "TEST ONLY — DO NOT SHIP", address_1: "2259 St. Charles Dr.", address_2: "", city: "Clearwater", state: "FL", zip: "33764" },
      notes: LIVE_VERIFICATION_NOTE,
    },
    systems: [{ "Client Name": "", "Choose Color": "1B", "Lace or Skin": "Lace", "Hair Length": 'Standard 5" hair', "Choose Density": "100% Standard", "Curl Pattern": "Standard" }],
  };
}

export function verificationSessionForm(user: { id: string; email: string }, draftId: string, origin: string) {
  return new URLSearchParams({
    mode: "payment", ui_mode: "embedded", customer_email: user.email, "payment_method_types[0]": "card",
    return_url: `${origin}/order-hair-system?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    "metadata[user_id]": user.id, "metadata[draft_id]": draftId, "metadata[system_count]": "1", "metadata[save_card]": "false", "metadata[live_verification_test]": "true",
    "payment_intent_data[metadata][user_id]": user.id, "payment_intent_data[metadata][draft_id]": draftId, "payment_intent_data[metadata][save_card]": "false",
    "line_items[0][price_data][currency]": "usd", "line_items[0][price_data][unit_amount]": "100", "line_items[0][price_data][product_data][name]": LIVE_VERIFICATION_ITEM,
    "line_items[0][quantity]": "1", "automatic_tax[enabled]": "false", "allow_promotion_codes": "false",
  });
}

/** Existing draft primary key is an atomic one-time reservation across requests. */
export async function verificationReservationId(userId: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`hair-live-verification-v1:${userId}`)));
  hash[6] = (hash[6] & 15) | 80; hash[8] = (hash[8] & 63) | 128;
  const h = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Dependencies = { stripeGet: typeof stripeGet; loadExpandedSession: typeof loadExpandedSession; fetch: typeof fetch };
const defaults: Dependencies = { stripeGet, loadExpandedSession, fetch: (...args) => fetch(...args) };

export async function liveVerificationCheckout(db: SupabaseClient, user: { id: string; email: string; email_confirmed_at?: string }, body: Record<string, unknown>, key: string, origin: string, deps = defaults) {
  if (user.email !== LIVE_VERIFICATION_EMAIL || !user.email_confirmed_at) throw new Error("Verified Chris admin account required.");
  const { data: admin, error: roleError } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleError || admin !== true) throw new Error("Verified Chris admin account required.");
  if (body.confirm !== LIVE_VERIFICATION_CONFIRM) throw new Error("Confirm LIVE_ONE_DOLLAR_TEST before proceeding.");
  if (!/^(sk|rk)_live_/.test(key)) throw new Error("Live verification requires the existing live Stripe key.");
  if ((await deps.stripeGet("/account", key)).id !== HAIR_SYSTEM_SELLER_ACCOUNT) throw new Error("Live hair-system seller mismatch.");
  if (!["https://member.thebarberlaunch.com", "http://localhost:8080", "https://id-preview--fb9f6378-8c5e-42da-91e6-0993cf1fb925.lovable.app"].includes(origin)) throw new Error("Unapproved checkout return origin.");

  const { data: drafts, error: draftError } = await db.from("hair_system_checkout_drafts").select("id, status, stripe_checkout_session_id")
    .eq("user_id", user.id).contains("base_details", { live_verification_test: true });
  const { data: orders, error: orderError } = await db.from("orders").select("id")
    .eq("user_id", user.id).contains("order_details", { live_verification_test: true });
  if (draftError || orderError || !Array.isArray(drafts) || !Array.isArray(orders)) throw new Error("Cannot establish prior verification status; nothing created.");
  if (orders.length || drafts.some((d) => d.status === "paid")) throw new Error("The one-time live verification has already been paid.");
  // Never generate another session, even when a previous attempt is unpaid,
  // expired, canceled, or its status is unknown. Repair can expire only that session.
  if (drafts.length) throw new Error("A live verification is already reserved. Do not create another; inspect or cancel its unpaid session.");
  const { data: hold, error: holdError } = await db.from("app_settings").select("value").eq("key", "hair_system_fulfillment_hold").maybeSingle();
  const { data: cutover, error: cutoverError } = await db.from("app_settings").select("value").eq("key", "hair_system_fulfillment_cutover").maybeSingle();
  const cutoverAt = Date.parse(cutover?.value?.at);
  if (holdError || hold?.value !== false || cutoverError || !Number.isFinite(cutoverAt) || cutoverAt > Date.now()) throw new Error("Production fulfillment safety configuration unavailable or held; nothing created.");

  const id = await verificationReservationId(user.id);
  const { error: reserveError } = await db.from("hair_system_checkout_drafts").insert({ id, ...verificationDraft(user), base_details: { ...verificationDraft(user).base_details, submitted_at: new Date().toISOString() } });
  if (reserveError) throw new Error("Live verification reservation failed or already exists; no additional checkout created.");
  const response = await deps.fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `hair_live_verification_${id}` },
    body: verificationSessionForm(user, id, origin),
  });
  const session = await response.json();
  if (!response.ok || session.livemode !== true || !String(session.id).startsWith("cs_live_") || !session.client_secret || session.amount_total !== 100 || session.currency !== "usd") throw new Error("Live verification session could not be safely prepared; reservation retained.");
  const { error: linkError } = await db.from("hair_system_checkout_drafts").update({ stripe_checkout_session_id: session.id }).eq("id", id).eq("user_id", user.id);
  if (linkError) throw new Error("Unable to link the verification session; reservation retained. Do not retry payment.");
  return { clientSecret: session.client_secret, sessionId: session.id, live: true, total_minor: 100, currency: "usd" };
}

/** Explicit cancel only: no return verification, fulfillment or buyer messages. */
export async function cancelLiveVerification(db: SupabaseClient, user: { id: string; email: string; email_confirmed_at?: string }, body: Record<string, unknown>, key: string, deps = defaults) {
  if (user.email !== LIVE_VERIFICATION_EMAIL || !user.email_confirmed_at || body.confirm !== "CANCEL_UNPAID_LIVE_TEST") throw new Error("Verified Chris account and cancellation confirmation required.");
  const { data: admin, error } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (error || admin !== true || !/^(sk|rk)_live_/.test(key) || (await deps.stripeGet("/account", key)).id !== HAIR_SYSTEM_SELLER_ACCOUNT) throw new Error("Live cancellation authorization unavailable.");
  const id = await verificationReservationId(user.id);
  const { data: draft, error: draftError } = await db.from("hair_system_checkout_drafts").select("id, status, base_details, stripe_checkout_session_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (draftError || !draft || draft.base_details?.live_verification_test !== true || draft.status === "paid" || !/^cs_live_[A-Za-z0-9]+$/.test(draft.stripe_checkout_session_id ?? "")) throw new Error("No confirmed unpaid live verification session to cancel.");
  const session = await deps.loadExpandedSession(draft.stripe_checkout_session_id, key);
  if (session.id !== draft.stripe_checkout_session_id || session.livemode !== true || session.metadata?.draft_id !== id || session.metadata?.user_id !== user.id || session.payment_status !== "unpaid" || session.amount_total !== 100 || session.currency !== "usd") throw new Error("Session is not safely cancelable as this unpaid verification.");
  if (session.status === "open") {
    const r = await deps.fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`, { method: "POST", headers: { Authorization: `Bearer ${key}` } });
    const expired = await r.json();
    if (!r.ok || expired.status !== "expired" || expired.payment_status !== "unpaid") throw new Error("Could not confirm unpaid expiration.");
  } else if (session.status !== "expired") throw new Error("Only an open or expired unpaid session can be canceled.");
  // Retain reservation and draft unchanged: never touch order or payment rows.
  return { canceled: true, sessionId: session.id };
}